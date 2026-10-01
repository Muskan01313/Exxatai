import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceAccess, jsonError } from "@/lib/api";

type Params = { params: Promise<{ workspaceId: string }> };

async function createInvite(workspaceId: string, userId: string) {
  return prisma.workspaceInvite.create({
    data: { workspaceId, createdById: userId, token: randomBytes(24).toString("base64url") },
  });
}

/** Returns the workspace's active invite link token, creating one if needed. */
export async function GET(_request: Request, { params }: Params) {
  const { workspaceId } = await params;
  const access = await requireWorkspaceAccess(workspaceId);
  if (access instanceof Response) {
    return access;
  }

  const existing = await prisma.workspaceInvite.findFirst({
    where: { workspaceId, revokedAt: null },
    orderBy: { createdAt: "desc" },
  });
  const invite = existing ?? (await createInvite(workspaceId, access.userId));
  return NextResponse.json({ token: invite.token });
}

/** Revokes the current link and issues a new one. */
export async function POST(_request: Request, { params }: Params) {
  const { workspaceId } = await params;
  const access = await requireWorkspaceAccess(workspaceId);
  if (access instanceof Response) {
    return access;
  }
  if (access.role !== "OWNER") {
    return jsonError("Only the workspace owner can reset the invite link", 403);
  }

  await prisma.workspaceInvite.updateMany({
    where: { workspaceId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  const invite = await createInvite(workspaceId, access.userId);
  return NextResponse.json({ token: invite.token });
}
