import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";

/**
 * The root is a router, not a page.
 *
 * A coach-only account has no mentee dashboard to land on, so it goes straight
 * to the coaching view. Someone who is both — the spec's dual-role case — lands
 * on their personal dashboard and reaches coaching from the sidebar, because
 * their own goals are what they signed in to see.
 */
export default async function RootPage() {
  const user = await getCurrentUser();

  if (!user) redirect("/login");
  if (!user.isMentee && (user.isCoach || user.isAdmin)) redirect("/coach");

  redirect("/dashboard");
}
