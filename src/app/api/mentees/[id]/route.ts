import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { getMenteeProfile } from "@/server/mentees";

import { errorResponse, unauthorized } from "../../_lib/http";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  try {
    const { id } = await params;

    // The profile carries `canEdit`, so a client knows whether to render write
    // controls without having to re-derive the delegation rules.
    const profile = await getMenteeProfile(user, id);
    return NextResponse.json({ profile });
  } catch (error) {
    return errorResponse(error);
  }
}
