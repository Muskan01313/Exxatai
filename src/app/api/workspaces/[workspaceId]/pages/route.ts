import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceAccess, jsonError } from "@/lib/api";

type Params = { params: Promise<{ workspaceId: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { workspaceId } = await params;
  const access = await requireWorkspaceAccess(workspaceId);
  if (access instanceof Response) {
    return access;
  }

  const [pages, favorites] = await Promise.all([
    prisma.page.findMany({
      where: { workspaceId, deletedAt: null },
      select: { id: true, title: true, icon: true, parentId: true, order: true },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    }),
    prisma.favorite.findMany({
      where: { userId: access.userId, page: { workspaceId, deletedAt: null } },
      orderBy: { createdAt: "asc" },
      select: { pageId: true },
    }),
  ]);

  return NextResponse.json({ pages, favoritePageIds: favorites.map((f) => f.pageId) });
}

const createPageSchema = z.object({
  title: z.string().max(200).optional(),
  parentId: z.string().uuid().nullable().optional(),
});

export async function POST(request: Request, { params }: Params) {
  const { workspaceId } = await params;
  const access = await requireWorkspaceAccess(workspaceId);
  if (access instanceof Response) {
    return access;
  }

  const parsed = createPageSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return jsonError("Invalid input", 400);
  }
  const parentId = parsed.data.parentId ?? null;

  if (parentId) {
    const parent = await prisma.page.findUnique({ where: { id: parentId } });
    if (!parent || parent.workspaceId !== workspaceId || parent.deletedAt) {
      return jsonError("Invalid parent page", 400);
    }
  }

  const last = await prisma.page.findFirst({
    where: { workspaceId, parentId, deletedAt: null },
    orderBy: { order: "desc" },
    select: { order: true },
  });

  const page = await prisma.page.create({
    data: {
      workspaceId,
      parentId,
      title: parsed.data.title?.trim() || "Untitled",
      createdById: access.userId,
      order: (last?.order ?? -1) + 1,
      content: [],
    },
  });

  return NextResponse.json({ page }, { status: 201 });
}
