import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceAccess } from "@/lib/api";

export async function GET(_request: Request, { params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = await params;
  const access = await requireWorkspaceAccess(workspaceId);
  if (access instanceof Response) {
    return access;
  }

  const members = await prisma.workspaceMember.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "asc" },
    select: { role: true, user: { select: { id: true, name: true, email: true } } },
  });

  return NextResponse.json({
    currentUserId: access.userId,
    currentUserRole: access.role,
    members: members.map((m) => ({ ...m.user, role: m.role })),
  });
}
