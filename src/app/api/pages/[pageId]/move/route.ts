import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePageAccess, jsonError } from "@/lib/api";
import { wouldCreateCycle } from "@/lib/workspace";

const moveSchema = z.object({
  parentId: z.string().uuid().nullable(),
  index: z.number().int().min(0),
});

export async function POST(request: Request, { params }: { params: Promise<{ pageId: string }> }) {
  const { pageId } = await params;
  const access = await requirePageAccess(pageId);
  if (access instanceof Response) {
    return access;
  }
  const { page } = access;

  const parsed = moveSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return jsonError("Invalid input", 400);
  }
  const { parentId, index } = parsed.data;

  if (parentId) {
    const parent = await prisma.page.findUnique({ where: { id: parentId } });
    if (!parent || parent.workspaceId !== page.workspaceId || parent.deletedAt) {
      return jsonError("Invalid parent page", 400);
    }
    if (await wouldCreateCycle(pageId, parentId)) {
      return jsonError("A page can't be moved inside itself", 400);
    }
  }

  await prisma.$transaction(async (tx) => {
    const siblings = await tx.page.findMany({
      where: { workspaceId: page.workspaceId, parentId, deletedAt: null, id: { not: pageId } },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      select: { id: true },
    });
    const ordered = siblings.map((s) => s.id);
    ordered.splice(Math.min(index, ordered.length), 0, pageId);

    await tx.page.update({ where: { id: pageId }, data: { parentId } });
    for (const [order, id] of ordered.entries()) {
      await tx.page.update({ where: { id }, data: { order } });
    }
  });

  return NextResponse.json({ ok: true });
}
