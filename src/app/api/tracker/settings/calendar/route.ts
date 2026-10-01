import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/api";

/** Creates (or replaces) your private calendar link. Replacing it stops the old link working. */
export async function POST() {
  const auth = await requireUser();
  if (auth instanceof Response) {
    return auth;
  }
  const token = randomBytes(24).toString("base64url");
  await prisma.user.update({ where: { id: auth.userId }, data: { calendarToken: token } });
  return NextResponse.json({ calendarPath: `/api/calendar/${token}.ics` });
}
