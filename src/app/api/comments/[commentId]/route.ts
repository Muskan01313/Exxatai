import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, jsonError } from "@/lib/api";

export async function DELETE(_request: Request, { params }: { params: Promise<{ commentId: string }> }) {
  const auth = await requireUser();
  if (auth instanceof Response) {
    return auth;
  }
  const { commentId } = await params;
  const result = await prisma.comment.deleteMany({ where: { id: commentId, authorId: auth.userId } });
  if (result.count === 0) {
    return jsonError("Not found", 404);
  }
  return NextResponse.json({ ok: true });
}
