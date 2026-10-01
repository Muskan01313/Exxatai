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

  const ids = [pageId, ...(await getDescendantIds(pageId))];
  await prisma.page.updateMany({
    where: { id: { in: ids }, deletedAt: null },
    data: { deletedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
