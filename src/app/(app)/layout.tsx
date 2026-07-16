import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth";
import { unreadCount } from "@/server/notifications";
import { Sidebar } from "@/components/app-shell/sidebar";
import { Topbar } from "@/components/app-shell/topbar";
import { navFor } from "@/components/app-shell/nav-config";

/**
 * The authenticated shell. Every route in the (app) group passes through
 * requireUser(), which verifies the session JWT and re-reads roles. Middleware
 * only checks that a cookie exists, so this — not middleware — is the boundary.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  // A new account has no goals, no circle and no first check-in. Letting them
  // straight in would show an app full of empty states and a score of zero; the
  // wizard is what gives them something to come back to.
  if (user.needsOnboarding) redirect("/onboarding");

  const unread = await unreadCount(user.id);
  const sections = navFor(user);

  return (
    <div className="flex min-h-dvh">
      <Sidebar sections={sections} />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          sections={sections}
          unreadCount={unread}
          user={{
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            avatarUrl: user.avatarUrl,
            roles: user.roles,
          }}
        />

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
