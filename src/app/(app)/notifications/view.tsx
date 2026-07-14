"use client";

import { useOptimistic, useTransition } from "react";
import type { ComponentType } from "react";
import { useRouter } from "next/navigation";
import {
  Award,
  Bell,
  CalendarClock,
  CircleAlert,
  CircleCheckBig,
  MessageSquareQuote,
  NotebookPen,
  TrendingUp,
  UsersRound,
} from "lucide-react";

import {
  Button,
  Card,
  EmptyState,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  useToast,
} from "@/components/ui";
import type { NotificationType } from "@/lib/domain";
import { cn } from "@/lib/utils";

import {
  markAllReadAction,
  markReadAction,
  setPreferenceAction,
} from "./actions";

/** Times are pre-formatted on the server — see the page, not this island. */
export type NotificationView = {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  link: string | null;
  isRead: boolean;
  timeLabel: string;
};

export type NotificationGroup = {
  label: string;
  items: NotificationView[];
};

export type PreferenceView = {
  type: NotificationType;
  label: string;
  inApp: boolean;
};

const ICONS: Record<NotificationType, ComponentType<{ className?: string }>> = {
  CORE_TASK_REMINDER: CircleCheckBig,
  MISSED_TASK: CircleAlert,
  GOAL_DEADLINE: CalendarClock,
  COACH_FEEDBACK: MessageSquareQuote,
  CHECK_IN_REMINDER: NotebookPen,
  LEADERBOARD_CHANGE: TrendingUp,
  ACHIEVEMENT_UNLOCKED: Award,
  GROUP_UPDATE: UsersRound,
};

const TONES: Record<NotificationType, string> = {
  CORE_TASK_REMINDER: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  MISSED_TASK: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  GOAL_DEADLINE: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  COACH_FEEDBACK: "bg-primary-soft text-primary",
  CHECK_IN_REMINDER: "bg-surface-sunken text-muted-strong",
  LEADERBOARD_CHANGE:
    "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  ACHIEVEMENT_UNLOCKED: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  GROUP_UPDATE: "bg-surface-sunken text-muted-strong",
};

export function NotificationsView({
  groups,
  preferences,
}: {
  groups: NotificationGroup[];
  preferences: PreferenceView[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();

  // "*" marks the whole inbox read in one pass, so "Mark all read" settles
  // instantly instead of waiting for the round trip.
  const [inbox, markSeen] = useOptimistic(groups, (state, id: string) =>
    state.map((group) => ({
      ...group,
      items: group.items.map((item) =>
        id === "*" || item.id === id ? { ...item, isRead: true } : item,
      ),
    })),
  );

  const [prefs, applyPref] = useOptimistic(
    preferences,
    (state, patch: { type: NotificationType; inApp: boolean }) =>
      state.map((pref) =>
        pref.type === patch.type ? { ...pref, inApp: patch.inApp } : pref,
      ),
  );

  const unread = inbox.reduce(
    (sum, group) => sum + group.items.filter((item) => !item.isRead).length,
    0,
  );

  function onOpen(item: NotificationView) {
    startTransition(async () => {
      if (!item.isRead) {
        markSeen(item.id);
        const result = await markReadAction(item.id);
        if (result.error) {
          toast({
            title: "Couldn't mark that read",
            description: result.error,
            variant: "danger",
          });
          return;
        }
      }
      if (item.link) router.push(item.link);
    });
  }

  function onMarkAll() {
    startTransition(async () => {
      markSeen("*");
      const result = await markAllReadAction();
      if (result.error) {
        toast({
          title: "Couldn't mark everything read",
          description: result.error,
          variant: "danger",
        });
      }
    });
  }

  function onTogglePreference(type: NotificationType, inApp: boolean) {
    startTransition(async () => {
      applyPref({ type, inApp });
      const result = await setPreferenceAction(type, inApp);
      if (result.error) {
        toast({
          title: "Couldn't save that preference",
          description: result.error,
          variant: "danger",
        });
      }
    });
  }

  const isEmpty = inbox.every((group) => group.items.length === 0);

  return (
    <Tabs defaultValue="inbox" className="mt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <TabsList aria-label="Notifications">
          <TabsTrigger value="inbox">
            Inbox
            {unread > 0 ? (
              <span className="ml-1 rounded-full bg-primary px-1.5 text-[0.625rem] font-semibold tabular-nums text-primary-foreground">
                {unread}
              </span>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
        </TabsList>

        {unread > 0 ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={onMarkAll}
            disabled={pending}
          >
            Mark all read
          </Button>
        ) : null}
      </div>

      <TabsContent value="inbox">
        {isEmpty ? (
          <EmptyState
            icon={Bell}
            title="You're all caught up"
            description="Reminders, coach feedback and leaderboard moves will land here."
          />
        ) : (
          <div className="space-y-6">
            {inbox
              .filter((group) => group.items.length > 0)
              .map((group) => (
                <section key={group.label}>
                  <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
                    {group.label}
                  </h2>

                  <Card>
                    <ul className="divide-y divide-border">
                      {group.items.map((item) => {
                        const Icon = ICONS[item.type];

                        return (
                          <li key={item.id}>
                            <button
                              type="button"
                              onClick={() => onOpen(item)}
                              className={cn(
                                "flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors",
                                "hover:bg-surface-sunken focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
                                !item.isRead && "bg-primary-soft/40",
                              )}
                            >
                              <span
                                className={cn(
                                  "flex size-9 shrink-0 items-center justify-center rounded-lg",
                                  TONES[item.type],
                                )}
                                aria-hidden="true"
                              >
                                <Icon className="size-4" />
                              </span>

                              <span className="min-w-0 flex-1">
                                <span className="flex items-center gap-2">
                                  <span
                                    className={cn(
                                      "truncate text-sm",
                                      item.isRead
                                        ? "font-medium text-muted-strong"
                                        : "font-semibold text-foreground",
                                    )}
                                  >
                                    {item.title}
                                  </span>
                                  {!item.isRead ? (
                                    <span
                                      className="size-2 shrink-0 rounded-full bg-primary"
                                      aria-label="Unread"
                                    />
                                  ) : null}
                                </span>
                                <span className="mt-0.5 block text-xs text-muted">
                                  {item.body}
                                </span>
                              </span>

                              <span className="shrink-0 whitespace-nowrap text-xs text-muted">
                                {item.timeLabel}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </Card>
                </section>
              ))}
          </div>
        )}
      </TabsContent>

      <TabsContent value="preferences">
        <Card>
          <ul className="divide-y divide-border">
            {prefs.map((pref) => {
              const Icon = ICONS[pref.type];

              return (
                <li
                  key={pref.type}
                  className="flex items-center gap-3 px-4 py-3.5"
                >
                  <span
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-lg",
                      TONES[pref.type],
                    )}
                    aria-hidden="true"
                  >
                    <Icon className="size-4" />
                  </span>

                  <label
                    htmlFor={`pref-${pref.type}`}
                    className="min-w-0 flex-1 cursor-pointer text-sm font-medium"
                  >
                    {pref.label}
                    <span className="mt-0.5 block text-xs font-normal text-muted">
                      Show these in your inbox
                    </span>
                  </label>

                  {/* A native checkbox painted as a switch: the browser gives us
                      the keyboard and screen-reader behaviour for free. */}
                  <input
                    id={`pref-${pref.type}`}
                    type="checkbox"
                    role="switch"
                    checked={pref.inApp}
                    disabled={pending}
                    onChange={(event) =>
                      onTogglePreference(pref.type, event.target.checked)
                    }
                    className={cn(
                      "relative h-6 w-11 shrink-0 cursor-pointer appearance-none rounded-full",
                      "bg-border-strong transition-colors checked:bg-primary",
                      "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                      "disabled:cursor-not-allowed disabled:opacity-50",
                      "before:absolute before:left-0.5 before:top-0.5 before:size-5 before:rounded-full",
                      "before:bg-white before:shadow-sm before:transition-transform",
                      "checked:before:translate-x-5",
                    )}
                  />
                </li>
              );
            })}
          </ul>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
