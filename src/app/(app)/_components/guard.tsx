import { ShieldAlert } from "lucide-react";

import { EmptyState } from "@/components/ui";
import { ForbiddenError } from "@/lib/rbac";

/**
 * The server layer refuses rather than narrows — a mentee who asks for the
 * organization board has asked for something real that they may not have, and
 * quietly handing back their own group would misrepresent what they are reading.
 * So `src/server/**` throws. A refusal is an answer, not a fault: it must reach
 * the reader as a sentence instead of a 500.
 */
export async function guard<T>(
  load: () => Promise<T>,
): Promise<{ ok: true; data: T } | { ok: false; message: string }> {
  try {
    return { ok: true, data: await load() };
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return { ok: false, message: error.message };
    }
    throw error;
  }
}

export function AccessNotice({ message }: { message: string }) {
  return (
    <EmptyState
      icon={ShieldAlert}
      title="You don't have access to this"
      description={message}
    />
  );
}
