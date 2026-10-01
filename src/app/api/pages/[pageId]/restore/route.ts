import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePageAccess } from "@/lib/api";
import { getDescendantIds } from "@/lib/workspace";

export async function POST(_request: Request, { params }: { params: Promise<{ pageId: string }> }) {
  const { pageId } = await params;
  const access = await requirePageAccess(pageId);
  if (access instanceof Response) {
    return access;
  }
  const { page } = access;

  const parent = page.parentId ? await prisma.page.findUnique({ where: { id: page.parentId } }) : null;
  const parentGone = page.parentId !== null && (!parent || parent.deletedAt !== null);

  const ids = [pageId, ...(await getDescendantIds(pageId))];
  await prisma.$transaction([
    prisma.page.updateMany({ where: { id: { in: ids } }, data: { deletedAt: null } }),
    ...(parentGone ? [prisma.page.update({ where: { id: pageId }, data: { parentId: null } })] : []),
  ]);

  return NextResponse.json({ ok: true });
}
