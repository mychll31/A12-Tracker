import "server-only";

import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/auth";
import {
  ForbiddenError,
  assertCanViewUser,
  canReadNote,
  canWriteNoteAbout,
} from "@/lib/rbac";
import { asNoteVisibility, type NoteVisibility } from "@/lib/domain";
import { addDays, today } from "@/lib/dates";

import { notify } from "./notifications";

/**
 * Coaching notes.
 *
 * A note is the one thing a coach may write about a mentee they do not own — an
 * observation is not an edit — so authorship, not ownership, is what governs
 * changing one afterwards.
 */

export type NotePerson = {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
};

export type NoteActionItemDetail = {
  id: string;
  title: string;
  isDone: boolean;
  dueDate: Date | null;
  assigneeId: string | null;
};

export type NoteDetail = {
  id: string;
  title: string;
  body: string;
  visibility: NoteVisibility;
  followUpDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
  coach: NotePerson;
  mentee: NotePerson;
  actionItems: NoteActionItemDetail[];
};

export type FollowUp = {
  id: string;
  title: string;
  followUpDate: Date;
  mentee: NotePerson;
};

const DEFAULT_FOLLOW_UP_DAYS = 7;

const person = {
  select: { id: true, firstName: true, lastName: true, avatarUrl: true },
} as const;

const noteInclude = {
  coach: person,
  mentee: person,
  actionItems: {
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      title: true,
      isDone: true,
      dueDate: true,
      assigneeId: true,
    },
  },
} as const;

type NoteRow = {
  id: string;
  coachId: string;
  menteeId: string;
  title: string;
  body: string;
  visibility: string;
  followUpDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
  coach: NotePerson;
  mentee: NotePerson;
  actionItems: NoteActionItemDetail[];
};

function toDetail(row: NoteRow): NoteDetail {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    visibility: asNoteVisibility(row.visibility),
    followUpDate: row.followUpDate,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    coach: row.coach,
    mentee: row.mentee,
    actionItems: row.actionItems,
  };
}

// ---------------------------------------------------------------------------
// Sanitising rich text
// ---------------------------------------------------------------------------

const ALLOWED_TAGS = new Set([
  "p",
  "br",
  "strong",
  "em",
  "u",
  "ul",
  "ol",
  "li",
  "h3",
  "h4",
  "blockquote",
  "code",
  "a",
]);

const VOID_TAGS = new Set(["br"]);

/**
 * A link must *literally* begin with a safe scheme. Requiring the prefix as raw
 * characters is what defeats `javascript:` smuggled in as an entity
 * (`&#106;avascript:`) — an entity cannot change the first eight characters.
 */
const SAFE_HREF = /^(?:https?:\/\/|mailto:)[^\s"'<>`]*$/i;

/**
 * `&` is deliberately left alone: an entity inside a text node decodes to a
 * character, never to markup, so `&#60;script&#62;` renders as visible text.
 * Escaping it would double-encode every legitimate `&amp;` an editor emits.
 */
function escapeText(value: string): string {
  return value.replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttr(value: string): string {
  return value
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function extractHref(attrs: string): string | null {
  const match = /(?:^|\s)href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(
    attrs,
  );
  if (!match) return null;

  const value = (match[1] ?? match[2] ?? match[3] ?? "").trim();
  return SAFE_HREF.test(value) ? value : null;
}

function renderTag(raw: string): string {
  // Comments and doctypes carry no content worth keeping.
  if (raw.startsWith("<!")) return "";

  const match = /^<\s*(\/?)\s*([a-zA-Z][a-zA-Z0-9]*)([\s\S]*?)\/?\s*>$/.exec(
    raw,
  );
  if (!match) return "";

  const closing = match[1] === "/";
  const name = (match[2] ?? "").toLowerCase();
  const attrs = match[3] ?? "";

  // Unknown tag: drop the tag, keep whatever text sat inside it.
  if (!ALLOWED_TAGS.has(name)) return "";

  if (VOID_TAGS.has(name)) return closing ? "" : "<br />";
  if (closing) return `</${name}>`;

  if (name === "a") {
    const href = extractHref(attrs);
    // An anchor with a rejected href still emits, so its closing tag stays
    // balanced — it simply no longer goes anywhere.
    return href ? `<a href="${escapeAttr(href)}">` : "<a>";
  }

  // Every other attribute — style, onclick, srcset — is dropped outright.
  return `<${name}>`;
}

/**
 * Strict allow-list sanitiser for note bodies. Deliberately not a parser: it
 * keeps only the handful of tags the editor can produce and escapes everything
 * else, so anything it fails to understand ends up as visible text rather than
 * as markup. Synchronous, so it can run inline on every write path.
 */
export function sanitizeNoteHtml(html: string): string {
  if (!html) return "";

  const stripped = html
    .replace(/<!--[\s\S]*?-->/g, "")
    // Script and style must lose their *contents* too — dropping only the tags
    // would leave the payload behind as text.
    .replace(/<\s*(script|style)\b[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    // An unclosed <script ...> otherwise swallows the rest of the document.
    .replace(/<\s*(?:script|style)\b[\s\S]*$/gi, "");

  let out = "";
  let index = 0;

  while (index < stripped.length) {
    const open = stripped.indexOf("<", index);
    if (open === -1) {
      out += escapeText(stripped.slice(index));
      break;
    }

    out += escapeText(stripped.slice(index, open));

    const close = stripped.indexOf(">", open);
    if (close === -1) {
      // A dangling "<" with no ">" — escape it, so the browser cannot close the
      // tag on our behalf at end of input.
      out += escapeText(stripped.slice(open));
      break;
    }

    out += renderTag(stripped.slice(open, close + 1));
    index = close + 1;
  }

  return out;
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

export async function listNotesForMentee(
  actor: SessionUser,
  menteeId: string,
): Promise<NoteDetail[]> {
  await assertCanViewUser(actor, menteeId);

  const rows = await db.coachingNote.findMany({
    where: { menteeId, mentee: { isActive: true } },
    orderBy: { createdAt: "desc" },
    include: noteInclude,
  });

  // Visibility is per-note, not per-query: a coach reading another coach's
  // mentee sees the shared notes and none of the private ones.
  return rows.filter((row) => canReadNote(actor, row)).map(toDetail);
}

export async function listNotesByCoach(
  actor: SessionUser,
  coachId: string,
): Promise<NoteDetail[]> {
  await assertCanViewUser(actor, coachId);

  const rows = await db.coachingNote.findMany({
    where: { coachId, mentee: { isActive: true } },
    orderBy: { createdAt: "desc" },
    include: noteInclude,
  });

  return rows.filter((row) => canReadNote(actor, row)).map(toDetail);
}

export async function getNote(
  actor: SessionUser,
  noteId: string,
): Promise<NoteDetail> {
  const row = await db.coachingNote.findUnique({
    where: { id: noteId },
    include: noteInclude,
  });

  if (!row || !canReadNote(actor, row)) {
    throw new ForbiddenError("That note is not visible to you.");
  }

  return toDetail(row);
}

export async function upcomingFollowUps(
  actor: SessionUser,
  coachId: string,
  withinDays: number = DEFAULT_FOLLOW_UP_DAYS,
): Promise<FollowUp[]> {
  await assertCanViewUser(actor, coachId);

  const start = today();
  const end = addDays(start, withinDays);

  const rows = await db.coachingNote.findMany({
    where: {
      coachId,
      followUpDate: { gte: start, lte: end },
      mentee: { isActive: true },
    },
    orderBy: { followUpDate: "asc" },
    include: { mentee: person },
  });

  const items: FollowUp[] = [];
  for (const row of rows) {
    if (!row.followUpDate) continue;
    if (!canReadNote(actor, row)) continue;
    items.push({
      id: row.id,
      title: row.title,
      followUpDate: row.followUpDate,
      mentee: row.mentee,
    });
  }

  return items;
}

// ---------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------

/** Editing and deleting are the author's alone — a colleague may read, not rewrite. */
async function requireAuthor(
  actor: SessionUser,
  noteId: string,
): Promise<{ coachId: string; menteeId: string; title: string }> {
  const note = await db.coachingNote.findUnique({
    where: { id: noteId },
    select: { coachId: true, menteeId: true, title: true },
  });

  if (!note) throw new ForbiddenError("That note is not visible to you.");
  if (!actor.isAdmin && note.coachId !== actor.id) {
    throw new ForbiddenError("Only the author may change this note.");
  }

  return note;
}

export async function createNote(
  actor: SessionUser,
  input: {
    menteeId: string;
    title: string;
    body: string;
    visibility: NoteVisibility;
    followUpDate?: Date | null;
    actionItems?: { title: string; dueDate?: Date | null }[];
  },
): Promise<string> {
  if (!canWriteNoteAbout(actor)) {
    throw new ForbiddenError("Only coaches may write notes about a mentee.");
  }
  await assertCanViewUser(actor, input.menteeId);

  const items = input.actionItems ?? [];

  const note = await db.coachingNote.create({
    data: {
      coachId: actor.id,
      menteeId: input.menteeId,
      title: input.title.trim(),
      body: sanitizeNoteHtml(input.body),
      visibility: input.visibility,
      followUpDate: input.followUpDate ?? null,
      // An action item on a coaching note is work for the mentee, so it is
      // assigned to them rather than left unowned.
      actionItems: {
        create: items.map((item, index) => ({
          title: item.title.trim(),
          dueDate: item.dueDate ?? null,
          assigneeId: input.menteeId,
          sortOrder: index,
        })),
      },
    },
    select: { id: true },
  });

  // A private note with no action items is the coach thinking out loud. The
  // mentee hears about a shared note, or about work landing on their plate.
  const shouldNotify = input.visibility === "SHARED" || items.length > 0;
  if (shouldNotify && input.menteeId !== actor.id) {
    await notify({
      userId: input.menteeId,
      type: "COACH_FEEDBACK",
      title: `${actor.fullName} left you a note`,
      body: input.title.trim(),
      link: `/notes/${note.id}`,
    });
  }

  return note.id;
}

export async function updateNote(
  actor: SessionUser,
  noteId: string,
  input: {
    title?: string;
    body?: string;
    visibility?: NoteVisibility;
    followUpDate?: Date | null;
  },
): Promise<void> {
  await requireAuthor(actor, noteId);

  await db.coachingNote.update({
    where: { id: noteId },
    data: {
      ...(input.title === undefined ? {} : { title: input.title.trim() }),
      ...(input.body === undefined
        ? {}
        : { body: sanitizeNoteHtml(input.body) }),
      ...(input.visibility === undefined
        ? {}
        : { visibility: input.visibility }),
      ...(input.followUpDate === undefined
        ? {}
        : { followUpDate: input.followUpDate }),
    },
  });
}

export async function deleteNote(
  actor: SessionUser,
  noteId: string,
): Promise<void> {
  await requireAuthor(actor, noteId);
  await db.coachingNote.delete({ where: { id: noteId } });
}

// ---------------------------------------------------------------------------
// Action items
// ---------------------------------------------------------------------------

export async function addActionItem(
  actor: SessionUser,
  noteId: string,
  title: string,
  dueDate?: Date | null,
): Promise<void> {
  const note = await requireAuthor(actor, noteId);

  const sortOrder = await db.noteActionItem.count({ where: { noteId } });

  await db.noteActionItem.create({
    data: {
      noteId,
      title: title.trim(),
      dueDate: dueDate ?? null,
      assigneeId: note.menteeId,
      sortOrder,
    },
  });

  if (note.menteeId !== actor.id) {
    await notify({
      userId: note.menteeId,
      type: "COACH_FEEDBACK",
      title: `${actor.fullName} assigned you an action item`,
      body: title.trim(),
      link: `/notes/${noteId}`,
    });
  }
}

/**
 * The mentee doing the work closes their own item; the coach who set it may
 * close it too, having watched it happen.
 */
export async function toggleActionItem(
  actor: SessionUser,
  itemId: string,
): Promise<void> {
  const item = await db.noteActionItem.findUnique({
    where: { id: itemId },
    select: {
      isDone: true,
      assigneeId: true,
      note: { select: { coachId: true } },
    },
  });

  if (!item) {
    throw new ForbiddenError("That action item is not visible to you.");
  }

  const allowed =
    actor.isAdmin ||
    item.assigneeId === actor.id ||
    item.note.coachId === actor.id;

  if (!allowed) {
    throw new ForbiddenError("You cannot change this action item.");
  }

  const isDone = !item.isDone;

  await db.noteActionItem.update({
    where: { id: itemId },
    data: { isDone, completedAt: isDone ? new Date() : null },
  });
}
