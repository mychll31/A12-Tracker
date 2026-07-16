"use client";

import { useActionState, useId, useState } from "react";
import { UsersRound } from "lucide-react";

import { Badge, Button, Card, Modal, useToast } from "@/components/ui";
import { cn, formatScore, scoreTone, TONE_TEXT } from "@/lib/utils";
import type { CouncilOption } from "@/server/mentees";

import { changeCouncilAction } from "./actions";
import { initialProfileState, type ProfileState } from "../_lib/form-state";

/**
 * A member moving themselves between councils. The picker lists every active
 * council with its coach, size and average score — the same figures the mentee
 * meets the moment they land in one — so the choice is informed. The move is a
 * free self-switch: any current membership is closed server-side.
 */
export function CouncilPicker({ councils }: { councils: CouncilOption[] }) {
  const current = councils.find((council) => council.isCurrent) ?? null;

  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(current?.id ?? "");
  const formId = useId();
  const { toast } = useToast();

  const [state, formAction, pending] = useActionState(
    async (prev: ProfileState, formData: FormData): Promise<ProfileState> => {
      const result = await changeCouncilAction(prev, formData);
      if (result.success) {
        toast({
          title: "Council changed",
          description: result.success,
          variant: "success",
        });
        setOpen(false);
      }
      return result;
    },
    initialProfileState,
  );

  return (
    <Card className="p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-base font-semibold tracking-tight">
            Your council
          </h2>
          <p className="mt-0.5 text-sm text-muted">
            The council you climb with, and the coach who leads it.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          icon={<UsersRound />}
          onClick={() => {
            setSelected(current?.id ?? "");
            setOpen(true);
          }}
          disabled={councils.length === 0}
        >
          {current ? "Change" : "Join a council"}
        </Button>
      </div>

      <div className="mt-4">
        {current ? (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-sunken p-4">
            <div className="min-w-0">
              <p className="truncate font-medium text-foreground">
                {current.name}
              </p>
              <p className="mt-0.5 truncate text-xs text-muted">
                Coached by {current.coachName} · {current.memberCount}{" "}
                {current.memberCount === 1 ? "member" : "members"}
              </p>
            </div>
            <span
              className={cn(
                "shrink-0 text-lg font-semibold tabular-nums",
                TONE_TEXT[scoreTone(current.averageScore)],
              )}
            >
              {formatScore(current.averageScore)}
            </span>
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-border bg-surface-sunken p-4 text-sm text-muted">
            You&apos;re not in a council yet. Join one to be ranked alongside
            them and share a coach.
          </p>
        )}
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Choose your council"
        description="You belong to one council at a time — joining a new one moves you out of your current one."
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form={formId}
              isLoading={pending}
              disabled={!selected || selected === current?.id}
            >
              Join council
            </Button>
          </>
        }
      >
        <form id={formId} action={formAction} className="flex flex-col gap-2.5">
          {councils.map((council) => {
            const active = selected === council.id;
            return (
              <label
                key={council.id}
                className={cn(
                  "flex cursor-pointer items-center justify-between gap-3 rounded-xl border p-4 transition-colors",
                  active
                    ? "border-primary bg-primary-soft"
                    : "border-border bg-surface hover:border-border-strong",
                )}
              >
                <span className="min-w-0">
                  <span className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="councilId"
                      value={council.id}
                      checked={active}
                      onChange={() => setSelected(council.id)}
                      className="size-4 accent-primary"
                    />
                    <span className="truncate font-medium text-foreground">
                      {council.name}
                    </span>
                    {council.isCurrent ? (
                      <Badge variant="neutral" size="sm">
                        Current
                      </Badge>
                    ) : null}
                  </span>
                  <span className="mt-1 block truncate pl-6 text-xs text-muted">
                    {council.coachName} · {council.memberCount}{" "}
                    {council.memberCount === 1 ? "member" : "members"}
                  </span>
                </span>
                <span
                  className={cn(
                    "shrink-0 text-sm font-semibold tabular-nums",
                    TONE_TEXT[scoreTone(council.averageScore)],
                  )}
                >
                  {formatScore(council.averageScore)}
                </span>
              </label>
            );
          })}

          {state.error ? (
            <p
              role="alert"
              className="rounded-xl bg-rose-500/10 px-4 py-3 text-sm text-rose-600 ring-1 ring-inset ring-rose-500/20 dark:text-rose-400"
            >
              {state.error}
            </p>
          ) : null}
        </form>
      </Modal>
    </Card>
  );
}
