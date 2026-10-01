import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePageAccess, jsonError } from "@/lib/api";

type Params = { params: Promise<{ pageId: string }> };

const commentSelect = {
  id: true,
  body: true,
  createdAt: true,
  authorId: true,
  author: { select: { name: true } },
} as const;

export async function GET(_request: Request, { params }: Params) {
  const { pageId } = await params;
  const access = await requirePageAccess(pageId);
  if (access instanceof Response) {
    return access;
  }
  const comments = await prisma.comment.findMany({
    where: { pageId },
    orderBy: { createdAt: "asc" },
    select: commentSelect,
  });
  return NextResponse.json({ comments, currentUserId: access.userId });
}

const createSchema = z.object({ body: z.string().trim().min(1).max(5000) });

export async function POST(request: Request, { params }: Params) {
  const { pageId } = await params;
  const access = await requirePageAccess(pageId);
  if (access instanceof Response) {
    return access;
  }
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return jsonError("Comment can't be empty", 400);
  }
  const comment = await prisma.comment.create({
    data: { pageId, authorId: access.userId, body: parsed.data.body },
    select: commentSelect,
  });
  return NextResponse.json({ comment }, { status: 201 });
}
