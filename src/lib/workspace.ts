import { prisma } from "@/lib/prisma";
import type { WorkspaceRole } from "@/generated/prisma/client";

export async function getMembership(workspaceId: string, userId: string) {
  return prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
  });
}

export async function isWorkspaceMember(workspaceId: string, userId: string): Promise<boolean> {
  return (await getMembership(workspaceId, userId)) !== null;
}

export async function getWorkspaceRole(workspaceId: string, userId: string): Promise<WorkspaceRole | null> {
  return (await getMembership(workspaceId, userId))?.role ?? null;
}

export async function getPageForUser(pageId: string, userId: string) {
  const page = await prisma.page.findUnique({ where: { id: pageId } });
  if (!page) {
    return null;
  }
  if (!(await isWorkspaceMember(page.workspaceId, userId))) {
    return null;
  }
  return page;
}

export async function getDescendantIds(pageId: string): Promise<string[]> {
  const result: string[] = [];
  let frontier = [pageId];
  while (frontier.length > 0) {
    const children = await prisma.page.findMany({
      where: { parentId: { in: frontier } },
      select: { id: true },
    });
    frontier = children.map((c) => c.id);
    result.push(...frontier);
  }
  return result;
}

export async function getAncestors(pageId: string) {
  const ancestors: { id: string; title: string; icon: string | null }[] = [];
  let current = await prisma.page.findUnique({
    where: { id: pageId },
    select: { parentId: true },
  });
  const seen = new Set<string>([pageId]);
  while (current?.parentId && !seen.has(current.parentId)) {
    seen.add(current.parentId);
    const parent = await prisma.page.findUnique({
      where: { id: current.parentId },
      select: { id: true, title: true, icon: true, parentId: true },
    });
    if (!parent) {
      break;
    }
    ancestors.unshift({ id: parent.id, title: parent.title, icon: parent.icon });
    current = parent;
  }
  return ancestors;
}

/** True when moving `pageId` under `newParentId` would create a cycle. */
export async function wouldCreateCycle(pageId: string, newParentId: string): Promise<boolean> {
  if (newParentId === pageId) {
    return true;
  }
  const ancestors = await getAncestors(newParentId);
  return ancestors.some((a) => a.id === pageId);
}
