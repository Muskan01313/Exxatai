import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceAccess, jsonError } from "@/lib/api";
import { DAY_PATTERN } from "@/lib/tracker";
import { createWorkLogSchema, serializeWorkLog, workLogInclude } from "@/lib/worklog";

type Params = { params: Promise<{ workspaceId: string }> };

/**
 * `?view=drafts` (default): your rows that aren't submitted yet, whatever their date.
 * `?view=submitted&from=&to=&who=me|all`: submitted rows with a work date in [from, to].
 */
export async function GET(request: Request, { params }: Params) {
  const { workspaceId } = await params;
  const access = await requireWorkspaceAccess(workspaceId);
  if (access instanceof Response) {
    return access;
  }
  const q = new URL(request.url).searchParams;

  if (q.get("view") !== "submitted") {
    const entries = await prisma.workLogEntry.findMany({
      where: { workspaceId, userId: access.userId, submittedAt: null },
      orderBy: { createdAt: "asc" },
      include: workLogInclude,
    });
    return NextResponse.json({ entries: entries.map(serializeWorkLog) });
  }

  const from = q.get("from") ?? "";
  const to = q.get("to") ?? "";
  if (!DAY_PATTERN.test(from) || !DAY_PATTERN.test(to)) {
    return jsonError("Missing or invalid date range", 400);
  }
  const entries = await prisma.workLogEntry.findMany({
    where: {
      workspaceId,
      submittedAt: { not: null },
      workDate: { gte: from, lte: to },
      ...(q.get("who") === "all" ? {} : { userId: access.userId }),
    },
    orderBy: [{ workDate: "desc" }, { submittedAt: "desc" }],
    take: 2000,
    include: workLogInclude,
  });
  return NextResponse.json({ entries: entries.map(serializeWorkLog) });
}

export async function POST(request: Request, { params }: Params) {
  const { workspaceId } = await params;
  const access = await requireWorkspaceAccess(workspaceId);
  if (access instanceof Response) {
    return access;
  }
  const parsed = createWorkLogSchema.safeParse((await request.json().catch(() => ({}))) ?? {});
  if (!parsed.success) {
    return jsonError("Invalid input", 400);
  }
  const { workDate, ...rest } = parsed.data;
  const entry = await prisma.workLogEntry.create({
    data: {
      ...rest,
      // The client sends its own "today"; the server's day can differ by time zone.
      workDate: workDate ?? new Date().toISOString().slice(0, 10),
      userId: access.userId,
      workspaceId,
    },
    include: workLogInclude,
  });
  return NextResponse.json({ entry: serializeWorkLog(entry) }, { status: 201 });
}
