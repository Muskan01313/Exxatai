import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { blocksToPlainText } from "@/lib/ai/rag";

const signupSchema = z.object({
  name: z.string().min(1).max(80),
  email: z.string().email(),
  password: z.string().min(8).max(200),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { name, email, password } = parsed.data;
  const normalizedEmail = email.toLowerCase();

  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { name, email: normalizedEmail, passwordHash },
    });
    const workspace = await tx.workspace.create({
      data: { name: `${name}'s Workspace`, ownerId: user.id },
    });
    await tx.workspaceMember.create({
      data: { workspaceId: workspace.id, userId: user.id, role: "OWNER" },
    });
    await tx.page.create({
      data: {
        workspaceId: workspace.id,
        title: "Getting started",
        icon: "👋",
        createdById: user.id,
        content: WELCOME_CONTENT,
        plainText: blocksToPlainText(WELCOME_CONTENT),
      },
    });
  });

  return NextResponse.json({ ok: true });
}

const WELCOME_CONTENT = [
  {
    type: "paragraph",
    content: [{ type: "text", text: "This is your first page. A few things to try:", styles: {} }],
  },
  {
    type: "bulletListItem",
    content: [{ type: "text", text: "Press space on an empty line to ask AI to write for you.", styles: {} }],
  },
  {
    type: "bulletListItem",
    content: [{ type: "text", text: "Select some text and click ✨ Ask AI to rewrite, shorten or translate it.", styles: {} }],
  },
  {
    type: "bulletListItem",
    content: [{ type: "text", text: "Type '/' to add headings, to-do lists, tables, images and more.", styles: {} }],
  },
  {
    type: "bulletListItem",
    content: [{ type: "text", text: "Press Ctrl+K to search, and drag pages in the sidebar to reorganize them.", styles: {} }],
  },
];
