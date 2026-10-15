import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceAccess, jsonError } from "@/lib/api";
import { listsSchema, readLists } from "@/lib/worklog";

type Params = { params: Promise<{ workspaceId: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { workspaceId } = await params;
  const access = await requireWorkspaceAccess(workspaceId);
  if (access instanceof Response) {
    return access;
  }
  const row = await prisma.workLogOptions.findUnique({ where: { workspaceId } });
  return NextResponse.json({ lists: readLists(row?.lists) });
}

/** Anyone in the workspace can edit the dropdown choices; they're shared by the team. */
export async function PUT(request: Request, { params }: Params) {
  const { workspaceId } = await params;
  const access = await requireWorkspaceAccess(workspaceId);
  if (access instanceof Response) {
    return access;
  }
  const parsed = listsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return jsonError("Invalid input", 400);
  }
  const row = await prisma.workLogOptions.upsert({
    where: { workspaceId },
    create: { workspaceId, lists: parsed.data },
    update: { lists: parsed.data },
  });
  return NextResponse.json({ lists: readLists(row.lists) });
}
