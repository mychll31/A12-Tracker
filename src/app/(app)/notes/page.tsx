import type { Metadata } from "next";
import { CalendarClock, MessageSquareQuote } from "lucide-react";

import { Avatar, Badge, Card, EmptyState } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { formatDate, formatRelative } from "@/lib/dates";
import { listNotesForMentee } from "@/server/notes";

import { AccessNotice, guard } from "../_components/guard";
import { ActionItems, type ActionItemView } from "./action-items";

export const metadata: Metadata = { title: "My Notes" };

/**
 * The note body is rendered as HTML on purpose. It is *not* raw input: it was
 * run through `sanitizeNoteHtml` (src/server/notes.ts) on every write path,
 * which keeps a strict tag allow-list, drops every attribute except a safe
 * `href`, and escapes the rest to visible text. Sanitising on write rather than
 * on read means the database can never hold a payload that some future reader
 * would have to be trusted to neutralise.
 */
const PROSE = [
  "text-sm leading-relaxed text-muted-strong",
  "[&_p]:mb-3 [&_p:last-child]:mb-0",
  "[&_h3]:mb-2 [&_h3]:mt-4 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-foreground",
  "[&_h4]:mb-2 [&_h4]:mt-4 [&_h4]:text-sm [&_h4]:font-semibold [&_h4]:text-foreground",
  "[&_ul]:mb-3 [&_ul]:list-disc [&_ul]:pl-5",
  "[&_ol]:mb-3 [&_ol]:list-decimal [&_ol]:pl-5",
  "[&_li]:mb-1",
  "[&_strong]:font-semibold [&_strong]:text-foreground",
  "[&_em]:italic",
  "[&_blockquote]:my-3 [&_blockquote]:border-l-2 [&_blockquote]:border-border-strong [&_blockquote]:pl-3 [&_blockquote]:italic",
  "[&_code]:rounded [&_code]:bg-surface-sunken [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-xs",
  "[&_a]:font-medium [&_a]:text-primary [&_a]:underline",
].join(" ");

function Header() {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">My Notes</h1>
      <p className="mt-1 text-sm text-muted">
        What your coach wrote down, and what you agreed to do next.
      </p>
    </div>
  );
}

export default async function NotesPage() {
  const user = await requireUser();

  // The viewer is the mentee, so `canReadNote` inside the server layer keeps
  // this to SHARED notes only — a coach's private thinking never reaches here.
  const loaded = await guard(() => listNotesForMentee(user, user.id));

  if (!loaded.ok) {
    return (
      <div className="animate-slide-up">
        <Header />
        <div className="mt-8">
          <AccessNotice message={loaded.message} />
        </div>
      </div>
    );
  }

  const notes = loaded.data;

  return (
    <div className="animate-slide-up">
      <Header />

      {notes.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            icon={MessageSquareQuote}
            title="No notes yet"
            description="When your coach shares a note from a session it will appear here — along with anything you agreed to do next."
          />
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {notes.map((note) => {
            const items: ActionItemView[] = note.actionItems.map((item) => ({
              id: item.id,
              title: item.title,
              isDone: item.isDone,
              dueLabel: item.dueDate ? formatDate(item.dueDate) : null,
            }));

            return (
              <Card key={note.id} className="p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <h2 className="text-base font-semibold tracking-tight">
                    {note.title}
                  </h2>

                  {note.followUpDate ? (
                    <Badge variant="info">
                      <CalendarClock aria-hidden="true" />
                      Follow-up {formatDate(note.followUpDate)}
                    </Badge>
                  ) : null}
                </div>

                <div className="mt-3 flex items-center gap-2.5">
                  <Avatar
                    src={note.coach.avatarUrl}
                    firstName={note.coach.firstName}
                    lastName={note.coach.lastName}
                    size="xs"
                  />
                  <span className="text-xs text-muted">
                    <span className="font-medium text-muted-strong">
                      {note.coach.firstName} {note.coach.lastName}
                    </span>
                    {" · "}
                    {formatRelative(note.createdAt)}
                  </span>
                </div>

                {/* Already allow-list sanitized on write by sanitizeNoteHtml. */}
                <div
                  className={`mt-4 ${PROSE}`}
                  dangerouslySetInnerHTML={{ __html: note.body }}
                />

                <ActionItems items={items} />
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
