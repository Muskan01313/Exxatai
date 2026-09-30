import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { getCurrentUserId } from "@/lib/session";
import { getPageForUser } from "@/lib/workspace";
import { indexPage } from "@/lib/ai/rag";

export async function GET(_request: Request, { params }: { params: Promise<{ pageId: string }> }) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { pageId } = await params;
  const page = await getPageForUser(pageId, userId);
  if (!page) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ page });
}

const updatePageSchema = z.object({
  title: z.string().max(200).optional(),
  icon: z.string().max(16).nullable().optional(),
  content: z.array(z.record(z.string(), z.unknown())).optional(),
  parentId: z.string().uuid().nullable().optional(),
  order: z.number().int().optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ pageId: string }> }) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { pageId } = await params;
  const page = await getPageForUser(pageId, userId);
  if (!page) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = updatePageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { title, icon, content, parentId, order } = parsed.data;

  if (parentId !== undefined && parentId !== null) {
    if (parentId === pageId) {
      return NextResponse.json({ error: "A page cannot be its own parent" }, { status: 400 });
    }
    const parent = await prisma.page.findUnique({ where: { id: parentId } });
    if (!parent || parent.workspaceId !== page.workspaceId) {
      return NextResponse.json({ error: "Invalid parent page" }, { status: 400 });
    }
  }

  const data: Prisma.PageUncheckedUpdateInput = {
    ...(title !== undefined ? { title: title || "Untitled" } : {}),
    ...(icon !== undefined ? { icon } : {}),
    ...(content !== undefined ? { content: content as Prisma.InputJsonValue } : {}),
    ...(parentId !== undefined ? { parentId } : {}),
    ...(order !== undefined ? { order } : {}),
  };

  const updated = await prisma.page.update({
    where: { id: pageId },
    data,
  });

  if (content !== undefined) {
    void indexPage(pageId).catch((error) => {
      console.error("Failed to index page for AI search", pageId, error);
    });
  }

  return NextResponse.json({ page: updated });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ pageId: string }> }) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { pageId } = await params;
  const page = await getPageForUser(pageId, userId);
  if (!page) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.page.delete({ where: { id: pageId } });

  return NextResponse.json({ ok: true });
}
