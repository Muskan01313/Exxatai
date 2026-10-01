import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/session";
import { getMembership, getPageForUser } from "@/lib/workspace";

export function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

export async function requireUser(): Promise<{ userId: string } | Response> {
  const userId = await getCurrentUserId();
  return userId ? { userId } : jsonError("Unauthorized", 401);
}

export async function requireWorkspaceAccess(workspaceId: string) {
  const auth = await requireUser();
  if (auth instanceof Response) {
    return auth;
  }
  const membership = await getMembership(workspaceId, auth.userId);
  if (!membership) {
    return jsonError("Not found", 404);
  }
  return { userId: auth.userId, role: membership.role };
}

export async function requirePageAccess(pageId: string) {
  const auth = await requireUser();
  if (auth instanceof Response) {
    return auth;
  }
  const page = await getPageForUser(pageId, auth.userId);
  if (!page) {
    return jsonError("Not found", 404);
  }
  return { userId: auth.userId, page };
}
