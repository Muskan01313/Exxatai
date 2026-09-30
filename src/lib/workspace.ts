import { prisma } from "@/lib/prisma";

export async function isWorkspaceMember(workspaceId: string, userId: string): Promise<boolean> {
  const membership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
  });
  return membership !== null;
}

export async function getPageForUser(pageId: string, userId: string) {
  const page = await prisma.page.findUnique({ where: { id: pageId } });
  if (!page) {
    return null;
  }
  const member = await isWorkspaceMember(page.workspaceId, userId);
  if (!member) {
    return null;
  }
  return page;
}
