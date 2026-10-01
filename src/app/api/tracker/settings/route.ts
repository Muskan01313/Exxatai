import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, jsonError } from "@/lib/api";
import { isValidTimeZone } from "@/lib/tracker";
import { emailConfigured } from "@/lib/email";

async function settingsFor(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { email: true, timezone: true, emailReminders: true, calendarToken: true },
  });
  return {
    email: user.email,
    timezone: user.timezone,
    emailReminders: user.emailReminders,
    calendarPath: user.calendarToken ? `/api/calendar/${user.calendarToken}.ics` : null,
    emailConfigured: emailConfigured(),
  };
}

export async function GET() {
  const auth = await requireUser();
  if (auth instanceof Response) {
    return auth;
  }
  return NextResponse.json(await settingsFor(auth.userId));
}

const updateSchema = z.object({
  timezone: z.string().max(64).refine(isValidTimeZone, "Unknown time zone").optional(),
  emailReminders: z.boolean().optional(),
});

export async function PATCH(request: Request) {
  const auth = await requireUser();
  if (auth instanceof Response) {
    return auth;
  }
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return jsonError("Invalid input", 400);
  }
  await prisma.user.update({ where: { id: auth.userId }, data: parsed.data });
  return NextResponse.json(await settingsFor(auth.userId));
}
