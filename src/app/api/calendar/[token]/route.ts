import { prisma } from "@/lib/prisma";
import { buildCalendar } from "@/lib/ics";

/**
 * Private calendar feed of your open deliveries. The secret token in the URL is the only access
 * control, because calendar apps can't log in; it can be replaced from the tracker settings.
 */
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const token = (await params).token.replace(/\.ics$/, "");
  const user = token ? await prisma.user.findUnique({ where: { calendarToken: token }, select: { id: true } }) : null;
  if (!user) {
    return new Response("Calendar not found", { status: 404 });
  }

  const since = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
  const tasks = await prisma.task.findMany({
    where: {
      userId: user.id,
      status: { not: "DONE" },
      dueAt: { not: null, gte: since },
      workspace: { members: { some: { userId: user.id } } },
    },
    orderBy: { dueAt: "asc" },
    take: 1000,
  });

  const origin = new URL(request.url).origin;
  const ics = buildCalendar(
    "My deliveries",
    tasks.map((t) => {
      const url = `${origin}/w/${t.workspaceId}/tracker`;
      return {
        uid: `${t.id}@notion-ai-clone`,
        start: t.dueAt!,
        end: new Date(t.dueAt!.getTime() + 30 * 60 * 1000),
        summary: `Delivery: ${t.title}`,
        description: [t.notes, `Open in your tracker: ${url}`].filter(Boolean).join("\n\n"),
        url,
        lastModified: t.updatedAt,
        alarmMinutesBefore: t.reminderMinutes,
      };
    }),
  );

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="deliveries.ics"',
      "Cache-Control": "private, max-age=300",
    },
  });
}
