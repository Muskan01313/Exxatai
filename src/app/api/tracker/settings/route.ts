import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/api";

export async function GET() {
  const auth = await requireUser();
  if (auth instanceof Response) {
    return auth;
  }
  const user = await prisma.user.findUniqueOrThrow({ where: { id: auth.userId }, select: { calendarToken: true } });
  return NextResponse.json({ calendarPath: user.calendarToken ? `/api/calendar/${user.calendarToken}.ics` : null });
}
