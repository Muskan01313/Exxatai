import { NextResponse, after } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { requirePageAccess } from "@/lib/api";
import { indexPage } from "@/lib/ai/rag";

export async function POST(_request: Request, { params }: { params: Promise<{ pageId: string }> }) {
  const { pageId } = await params;
  const access = await requirePageAccess(pageId);
  if (access instanceof Response) {
    return access;
  }
  const { page, userId } = access;

  const created = await prisma.$transaction(async (tx) => {
    await tx.page.updateMany({
      where: { workspaceId: page.workspaceId, parentId: page.parentId, order: { gt: page.order } },
      data: { order: { increment: 1 } },
    });

    const newIds: string[] = [];
    // Copy breadth-first so every parent exists before its children.
    let queue: { sourceId: string; newParentId: string | null; order: number; title?: string }[] = [
      { sourceId: page.id, newParentId: page.parentId, order: page.order + 1, title: `${page.title} (copy)` },
    ];
    while (queue.length > 0) {
      const next: typeof queue = [];
      for (const item of queue) {
        const source = await tx.page.findUniqueOrThrow({ where: { id: item.sourceId } });
        const copy = await tx.page.create({
          data: {
            workspaceId: source.workspaceId,
            parentId: item.newParentId,
            title: item.title ?? source.title,
            icon: source.icon,
            cover: source.cover,
            content: source.content as Prisma.InputJsonValue,
            plainText: source.plainText,
            order: item.order,
            createdById: userId,
          },
        });
        newIds.push(copy.id);
        const children = await tx.page.findMany({
          where: { parentId: source.id, deletedAt: null },
          orderBy: [{ order: "asc" }, { createdAt: "asc" }],
        });
        children.forEach((child, i) => next.push({ sourceId: child.id, newParentId: copy.id, order: i }));
      }
      queue = next;
    }
    return newIds;
  });

  after(async () => {
    for (const id of created) {
      await indexPage(id).catch((error) => console.error("Failed to index duplicated page", id, error));
    }
  });

  return NextResponse.json({ page: { id: created[0] } }, { status: 201 });
}
