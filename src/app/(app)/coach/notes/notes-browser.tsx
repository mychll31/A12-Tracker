"use client";

import { useActionState, useMemo, useState } from "react";
import { Eye, Lock, NotebookPen, Pencil, Plus, Trash2 } from "lucide-react";

import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  Modal,
  Select,
  useToast,
} from "@/components/ui";
import type { NoteDetail } from "@/server/notes";
import { formatDate, formatRelative } from "@/lib/dates";
import { cn, stripHtml, truncate } from "@/lib/utils";

import { deleteNoteAction } from "../actions";
import { INITIAL_ACTION_STATE } from "../../_lib/form-state";
import { NoteComposer, type ComposerMentee } from "../note-composer";
import type { ActionState } from "../../_lib/form-state";

/**
 * The coach's own notes, across every mentee they have written about.
 *
 * Filtering happens here rather than on the server: the coach's own notes are a
 * bounded list already fetched, so a round trip per filter change would buy
 * nothing.
 */

const PREVIEW_CHARS = 180;

export interface NotesBrowserProps {
  notes: NoteDetail[];
  mentees: ComposerMentee[];
  /** Only the author may edit or delete a note. */
  coachId: string;
}

function VisibilityBadge({
  visibility,
}: {
  visibility: NoteDetail["visibility"];
}) {
  const shared = visibility === "SHARED";
  return (
    <Badge variant={shared ? "success" : "neutral"} size="sm">
      {shared ? <Eye aria-hidden="true" /> : <Lock aria-hidden="true" />}
      {shared ? "Shared" : "Private"}
    </Badge>
  );
}

function ActionItemProgress({ note }: { note: NoteDetail }) {
  if (note.actionItems.length === 0) return null;
  const done = note.actionItems.filter((item) => item.isDone).length;

  return (
    <Badge
      variant={done === note.actionItems.length ? "success" : "warning"}
      size="sm"
    >
      {done}/{note.actionItems.length} done
    </Badge>
  );
}

export function NotesBrowser({ notes, mentees, coachId }: NotesBrowserProps) {
  const [menteeFilter, setMenteeFilter] = useState("");
  const [composing, setComposing] = useState(false);
  const [openNote, setOpenNote] = useState<NoteDetail | null>(null);
  const [editing, setEditing] = useState<NoteDetail | null>(null);

  const { toast } = useToast();

  // Dismissing the modal on success happens inside the action rather than in an
  // effect watching it — see the note in note-composer.tsx.
  const [deleteState, deleteAction, deleting] = useActionState(
    async (prev: ActionState, formData: FormData): Promise<ActionState> => {
      const result = await deleteNoteAction(prev, formData);

      if (result.ok) {
        toast({ title: "Note deleted", variant: "success" });
        setOpenNote(null);
      }

      return result;
    },
    INITIAL_ACTION_STATE,
  );

  const visible = useMemo(
    () =>
      menteeFilter
        ? notes.filter((note) => note.mentee.id === menteeFilter)
        : notes,
    [notes, menteeFilter],
  );

  const menteeOptions = [
    { value: "", label: "All mentees" },
    // Only mentees this coach has actually written about are worth offering.
    ...[...new Map(notes.map((n) => [n.mentee.id, n.mentee])).values()].map(
      (mentee) => ({
        value: mentee.id,
        label: `${mentee.firstName} ${mentee.lastName}`,
      }),
    ),
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex w-full flex-col gap-1.5 sm:w-72">
          <label
            htmlFor="note-mentee-filter"
            className="text-sm font-medium text-muted-strong"
          >
            Filter by mentee
          </label>
          <Select
            id="note-mentee-filter"
            options={menteeOptions}
            value={menteeFilter}
            onChange={(event) => setMenteeFilter(event.target.value)}
          />
        </div>

        <Button icon={<Plus />} onClick={() => setComposing(true)}>
          New note
        </Button>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={NotebookPen}
          title={
            notes.length === 0 ? "No notes yet" : "No notes for that mentee"
          }
          description={
            notes.length === 0
              ? "Write your first coaching note — an observation, and what you want them to do about it."
              : "Clear the filter to see the rest of your notes."
          }
          action={
            notes.length === 0 ? (
              <Button icon={<Plus />} onClick={() => setComposing(true)}>
                New note
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((note) => (
            <li key={note.id}>
              <Card className="flex h-full flex-col gap-3 p-5">
                <div className="flex items-center gap-2">
                  <Avatar
                    src={note.mentee.avatarUrl}
                    firstName={note.mentee.firstName}
                    lastName={note.mentee.lastName}
                    size="xs"
                  />
                  <span className="truncate text-xs text-muted">
                    {note.mentee.firstName} {note.mentee.lastName}
                  </span>
                  <span className="ml-auto shrink-0 text-xs text-muted">
                    {formatRelative(note.createdAt)}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setOpenNote(note)}
                  className="text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  <p className="font-medium text-foreground hover:text-primary">
                    {note.title}
                  </p>
                  {note.body ? (
                    <p className="mt-1 text-sm leading-relaxed text-muted">
                      {truncate(stripHtml(note.body), PREVIEW_CHARS)}
                    </p>
                  ) : null}
                </button>

                <div className="mt-auto flex flex-wrap items-center gap-1.5 border-t border-border pt-3">
                  <VisibilityBadge visibility={note.visibility} />
                  <ActionItemProgress note={note} />
                  {note.followUpDate ? (
                    <Badge variant="info" size="sm">
                      Follow up {formatDate(note.followUpDate)}
                    </Badge>
                  ) : null}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {/* Expand ---------------------------------------------------------- */}
      <Modal
        open={openNote !== null}
        onClose={() => setOpenNote(null)}
        size="lg"
        title={openNote?.title ?? ""}
        description={
          openNote
            ? `About ${openNote.mentee.firstName} ${openNote.mentee.lastName} · ${formatDate(openNote.createdAt)}`
            : undefined
        }
        footer={
          openNote && openNote.coach.id === coachId ? (
            <>
              <form action={deleteAction}>
                <input type="hidden" name="noteId" value={openNote.id} />
                <input
                  type="hidden"
                  name="menteeId"
                  value={openNote.mentee.id}
                />
                <Button
                  type="submit"
                  variant="danger"
                  icon={<Trash2 />}
                  isLoading={deleting}
                >
                  Delete
                </Button>
              </form>

              <Button
                variant="outline"
                icon={<Pencil />}
                onClick={() => {
                  setEditing(openNote);
                  setOpenNote(null);
                }}
              >
                Edit
              </Button>
            </>
          ) : undefined
        }
      >
        {openNote ? (
          <div className="flex flex-col gap-5">
            <div className="flex flex-wrap items-center gap-1.5">
              <VisibilityBadge visibility={openNote.visibility} />
              <ActionItemProgress note={openNote} />
              {openNote.followUpDate ? (
                <Badge variant="info" size="sm">
                  Follow up {formatDate(openNote.followUpDate)}
                </Badge>
              ) : null}
            </div>

            {openNote.body ? (
              // Allow-list sanitized on write by sanitizeNoteHtml() in
              // src/server/notes.ts — the stored body is already safe markup.
              <div
                className="text-sm leading-relaxed text-muted-strong [&_a]:text-primary [&_a]:underline [&_li]:ml-4 [&_li]:list-disc"
                dangerouslySetInnerHTML={{ __html: openNote.body }}
              />
            ) : (
              <p className="text-sm text-muted">This note has no body.</p>
            )}

            {openNote.actionItems.length > 0 ? (
              <ul className="flex flex-col gap-2 border-t border-border pt-4">
                {openNote.actionItems.map((item) => (
                  <li key={item.id} className="flex items-center gap-2 text-sm">
                    <span
                      className={cn(
                        "size-4 shrink-0 rounded border",
                        item.isDone
                          ? "border-emerald-500 bg-emerald-500"
                          : "border-border",
                      )}
                      aria-hidden="true"
                    />
                    <span
                      className={cn(
                        item.isDone
                          ? "text-muted line-through"
                          : "text-foreground",
                      )}
                    >
                      {item.title}
                    </span>
                    {item.dueDate ? (
                      <span className="ml-auto text-xs text-muted">
                        {formatDate(item.dueDate)}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}

            {deleteState.error ? (
              <p
                role="alert"
                className="text-sm text-rose-600 dark:text-rose-400"
              >
                {deleteState.error}
              </p>
            ) : null}
          </div>
        ) : null}
      </Modal>

      {/* Compose / edit --------------------------------------------------- */}
      <NoteComposer
        open={composing}
        onClose={() => setComposing(false)}
        mentees={mentees}
      />

      {editing ? (
        <NoteComposer
          open
          onClose={() => setEditing(null)}
          mentees={mentees}
          note={{
            id: editing.id,
            menteeId: editing.mentee.id,
            title: editing.title,
            body: editing.body,
            visibility: editing.visibility,
            followUpDate: editing.followUpDate,
          }}
        />
      ) : null}
    </div>
  );
}
