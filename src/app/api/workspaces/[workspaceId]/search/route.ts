import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceAccess } from "@/lib/api";

function snippetAround(text: string, query: string): string {
  const index = text.toLowerCase().indexOf(query.toLowerCase());
  if (index === -1) {
    return text.slice(0, 120);
  }
  const start = Math.max(0, index - 50);
  const end = Math.min(text.length, index + query.length + 70);
  return `${start > 0 ? "…" : ""}${text.slice(start, end)}${end < text.length ? "…" : ""}`;
}

export async function GET(request: Request, { params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = await params;
  const access = await requireWorkspaceAccess(workspaceId);
  if (access instanceof Response) {
    return access;
  }

  const query = (new URL(request.url).searchParams.get("q") ?? "").trim().slice(0, 200);

  const pages = await prisma.page.findMany({
    where: {
      workspaceId,
      deletedAt: null,
      ...(query
        ? {
            OR: [
              { title: { contains: query, mode: "insensitive" } },
              { plainText: { contains: query, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: 20,
    select: { id: true, title: true, icon: true, plainText: true, updatedAt: true },
  });

  return NextResponse.json({
    results: pages.map((p) => ({
      id: p.id,
      title: p.title,
      icon: p.icon,
      updatedAt: p.updatedAt,
      snippet: query ? snippetAround(p.plainText, query) : p.plainText.slice(0, 120),
    })),
  });
}
