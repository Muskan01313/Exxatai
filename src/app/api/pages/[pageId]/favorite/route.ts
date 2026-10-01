import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePageAccess } from "@/lib/api";

type Params = { params: Promise<{ pageId: string }> };

export async function PUT(_request: Request, { params }: Params) {
  const { pageId } = await params;
  const access = await requirePageAccess(pageId);
  if (access instanceof Response) {
    return access;
  }
  await prisma.favorite.upsert({
    where: { userId_pageId: { userId: access.userId, pageId } },
    create: { userId: access.userId, pageId },
    update: {},
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: Params) {
  const { pageId } = await params;
  const access = await requirePageAccess(pageId);
  if (access instanceof Response) {
    return access;
  }
  await prisma.favorite.deleteMany({ where: { userId: access.userId, pageId } });
  return NextResponse.json({ ok: true });
}
