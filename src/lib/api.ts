import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";

// Returns the authenticated user, or a NextResponse with a 401 status.
export async function requireUser(): Promise<
  | { user: { id: string; email: string } }
  | { response: NextResponse }
> {
  const user = await getCurrentUser();
  if (!user) {
    return {
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  return { user };
}
