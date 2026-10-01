import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceAccess, jsonError } from "@/lib/api";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ workspaceId: string; userId: string }> },
) {
  const { workspaceId, userId: targetUserId } = await params;
  const access = await requireWorkspaceAccess(workspaceId);
  if (access instanceof Response) {
    return access;
  }

  const target = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: targetUserId } },
  });
  if (!target) {
    return jsonError("Not found", 404);
  }
  if (target.role === "OWNER") {
    return jsonError("The workspace owner can't be removed", 400);
  }
  const isSelf = targetUserId === access.userId;
  if (!isSelf && access.role !== "OWNER") {
    return jsonError("Only the workspace owner can remove members", 403);
  }

  await prisma.workspaceMember.delete({ where: { id: target.id } });
  return NextResponse.json({ ok: true });
}
