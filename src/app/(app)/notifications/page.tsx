import type { Metadata } from "next";

import { requireUser } from "@/lib/auth";
import { addDays, dayKey, formatRelative, today } from "@/lib/dates";
import { NOTIFICATION_LABELS, NOTIFICATION_TYPES } from "@/lib/domain";
import { getPreferences, listNotifications } from "@/server/notifications";

import {
  NotificationsView,
  type NotificationGroup,
  type PreferenceView,
} from "./view";

export const metadata: Metadata = { title: "Notifications" };

const INBOX_LIMIT = 50;

/** The three buckets, in the order they are shown. */
const GROUPS = ["Today", "Yesterday", "Earlier"] as const;
type GroupLabel = (typeof GROUPS)[number];

export default async function NotificationsPage() {
  const user = await requireUser();

  // Both of these take a userId rather than an actor: a notification is already
  // private to its recipient, and we only ever pass our own id.
  const [items, preferences] = await Promise.all([
    listNotifications(user.id, { limit: INBOX_LIMIT }),
    getPreferences(user.id),
  ]);

  // Bucketed against the UTC day key — the same boundary every daily record in
  // Abundance Hub uses, so "Today" here means the same day a streak does.
  const day = today();
  const yesterday = addDays(day, -1);

  const bucketOf = (date: Date): GroupLabel => {
    const key = dayKey(date).getTime();
    if (key === day.getTime()) return "Today";
    if (key === yesterday.getTime()) return "Yesterday";
    return "Earlier";
  };

  const groups: NotificationGroup[] = GROUPS.map((label) => ({
    label,
    items: items
      .filter((item) => bucketOf(item.createdAt) === label)
      .map((item) => ({
        id: item.id,
        type: item.type,
        title: item.title,
        body: item.body,
        link: item.link,
        isRead: item.isRead,
        timeLabel: formatRelative(item.createdAt),
      })),
  }));

  const prefs: PreferenceView[] = NOTIFICATION_TYPES.map((type) => ({
    type,
    label: NOTIFICATION_LABELS[type],
    inApp: preferences[type].inApp,
  }));

  return (
    <div className="animate-slide-up">
      <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
      <p className="mt-1 text-sm text-muted">
        Everything worth your attention — and the switches to decide what is.
      </p>

      <NotificationsView groups={groups} preferences={prefs} />
    </div>
  );
}
