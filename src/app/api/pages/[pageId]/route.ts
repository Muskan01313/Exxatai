import { NextResponse, after } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { requirePageAccess, jsonError } from "@/lib/api";
import { blocksToPlainText, indexPage } from "@/lib/ai/rag";

type Params = { params: Promise<{ pageId: string }> };

export async function GET(_request: Request, { params }: Params) {
  const access = await requirePageAccess((await params).pageId);
  if (access instanceof Response) {
    return access;
  }
  return NextResponse.json({ page: access.page });
}

const coverSchema = z
  .string()
  .max(2048)
  .refine((v) => v.startsWith("preset:") || v.startsWith("https://"), "Cover must be a preset or an https URL");

const updatePageSchema = z
  .object({
    title: z.string().max(200).optional(),
    icon: z.string().max(16).nullable().optional(),
    cover: coverSchema.nullable().optional(),
    isPublic: z.boolean().optional(),
    content: z.array(z.record(z.string(), z.unknown())).optional(),
    baseVersion: z.number().int().optional(),
  })
  .refine((d) => d.content === undefined || d.baseVersion !== undefined, "baseVersion is required with content");

export async function PATCH(request: Request, { params }: Params) {
  const { pageId } = await params;
  const access = await requirePageAccess(pageId);
  if (access instanceof Response) {
    return access;
  }

  const parsed = updatePageSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return jsonError("Invalid input", 400);
  }
  const { title, icon, cover, isPublic, content, baseVersion } = parsed.data;

  const data: Prisma.PageUpdateManyMutationInput = {
    ...(title !== undefined ? { title: title.trim() || "Untitled" } : {}),
    ...(icon !== undefined ? { icon } : {}),
    ...(cover !== undefined ? { cover } : {}),
    ...(isPublic !== undefined ? { isPublic } : {}),
  };

  if (content !== undefined) {
    data.content = content as Prisma.InputJsonValue;
    data.plainText = blocksToPlainText(content);
    data.contentVersion = { increment: 1 };
  }

  // Only apply a content save if nobody else saved since this client loaded the page.
  const result = await prisma.page.updateMany({
    where: { id: pageId, ...(content !== undefined ? { contentVersion: baseVersion } : {}) },
    data,
  });

  const page = await prisma.page.findUniqueOrThrow({ where: { id: pageId } });

  if (result.count === 0) {
    return NextResponse.json(
      { error: "This page was changed by someone else.", contentVersion: page.contentVersion },
      { status: 409 },
    );
  }

  if (content !== undefined) {
    after(() =>
      indexPage(pageId).catch((error) => {
        console.error("Failed to index page for AI search", pageId, error);
      }),
    );
  }

  return NextResponse.json({ page });
}

export async function DELETE(_request: Request, { params }: Params) {
  const { pageId } = await params;
  const access = await requirePageAccess(pageId);
  if (access instanceof Response) {
    return access;
  }
  await prisma.page.delete({ where: { id: pageId } });
  return NextResponse.json({ ok: true });
}
