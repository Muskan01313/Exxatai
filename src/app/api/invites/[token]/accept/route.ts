import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, jsonError } from "@/lib/api";

export async function POST(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const auth = await requireUser();
  if (auth instanceof Response) {
    return auth;
  }
  const { token } = await params;

  const invite = await prisma.workspaceInvite.findUnique({ where: { token } });
  if (!invite || invite.revokedAt) {
    return jsonError("This invite link is no longer valid. Ask for a new one.", 404);
  }

  await prisma.workspaceMember.upsert({
    where: { workspaceId_userId: { workspaceId: invite.workspaceId, userId: auth.userId } },
    create: { workspaceId: invite.workspaceId, userId: auth.userId, role: invite.role },
    update: {},
  });

  return NextResponse.json({ workspaceId: invite.workspaceId });
}
