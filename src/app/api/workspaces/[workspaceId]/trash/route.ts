import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceAccess } from "@/lib/api";

export async function GET(_request: Request, { params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = await params;
  const access = await requireWorkspaceAccess(workspaceId);
  if (access instanceof Response) {
    return access;
  }

  const trashed = await prisma.page.findMany({
    where: { workspaceId, deletedAt: { not: null } },
    orderBy: { deletedAt: "desc" },
    select: { id: true, title: true, icon: true, deletedAt: true, parent: { select: { deletedAt: true } } },
  });

  // Show only the page the user actually trashed, not each of its sub-pages.
  const roots = trashed
    .filter((p) => !p.parent || p.parent.deletedAt === null)
    .map((p) => ({ id: p.id, title: p.title, icon: p.icon, deletedAt: p.deletedAt }));

  return NextResponse.json({ pages: roots });
}
