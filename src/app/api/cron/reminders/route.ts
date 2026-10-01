import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { appUrl, emailConfigured, sendEmail } from "@/lib/email";
import { buildDigest, isEmptyDigest, renderDigestEmail } from "@/lib/digest";
import { isValidTimeZone } from "@/lib/tracker";

/**
 * Sends each person a morning email with deliveries that are overdue, due today or due tomorrow.
 * Vercel Cron calls this once a day (see vercel.json) with `Authorization: Bearer $CRON_SECRET`.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!emailConfigured()) {
    return NextResponse.json({ sent: 0, skipped: "RESEND_API_KEY is not set" });
  }

  const now = new Date();
  const horizon = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const users = await prisma.user.findMany({
    where: { emailReminders: true, tasks: { some: { status: { not: "DONE" }, dueAt: { not: null, lte: horizon } } } },
    select: { id: true, email: true, name: true, timezone: true, lastDigestOn: true },
  });

  let sent = 0;
  const failures: string[] = [];
  const baseUrl = appUrl();

  for (const user of users) {
    const timeZone = isValidTimeZone(user.timezone) ? user.timezone : "UTC";
    const tasks = await prisma.task.findMany({
      where: {
        userId: user.id,
        status: { not: "DONE" },
        dueAt: { not: null, lte: horizon, gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) },
        workspace: { members: { some: { userId: user.id } } },
      },
      select: { id: true, title: true, workspaceId: true, dueAt: true },
    });
    const digest = buildDigest(
      tasks.map((t) => ({ ...t, dueAt: t.dueAt! })),
      now,
      timeZone,
    );
    if (user.lastDigestOn === digest.today || isEmptyDigest(digest)) {
      continue;
    }
    try {
      await sendEmail({ to: user.email, ...renderDigestEmail(digest, user.name, timeZone, baseUrl) });
      await prisma.user.update({ where: { id: user.id }, data: { lastDigestOn: digest.today } });
      sent += 1;
    } catch (error) {
      console.error("Reminder email failed", user.id, error);
      failures.push(user.id);
    }
  }

  return NextResponse.json({ sent, failed: failures.length });
}
