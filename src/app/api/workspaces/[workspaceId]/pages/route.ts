import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";
import { isWorkspaceMember } from "@/lib/workspace";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { workspaceId } = await params;
  if (!(await isWorkspaceMember(workspaceId, userId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const pages = await prisma.page.findMany({
    where: { workspaceId },
    select: { id: true, title: true, icon: true, parentId: true, order: true },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  });

  return NextResponse.json({ pages });
}

const createPageSchema = z.object({
  title: z.string().max(200).optional(),
  parentId: z.string().uuid().nullable().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { workspaceId } = await params;
  if (!(await isWorkspaceMember(workspaceId, userId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = createPageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  if (parsed.data.parentId) {
    const parent = await prisma.page.findUnique({ where: { id: parsed.data.parentId } });
    if (!parent || parent.workspaceId !== workspaceId) {
      return NextResponse.json({ error: "Invalid parent page" }, { status: 400 });
    }
  }

  const siblingCount = await prisma.page.count({
    where: { workspaceId, parentId: parsed.data.parentId ?? null },
  });

  const page = await prisma.page.create({
    data: {
      workspaceId,
      parentId: parsed.data.parentId ?? null,
      title: parsed.data.title || "Untitled",
      createdById: userId,
      order: siblingCount,
      content: [],
    },
  });

  return NextResponse.json({ page }, { status: 201 });
}
