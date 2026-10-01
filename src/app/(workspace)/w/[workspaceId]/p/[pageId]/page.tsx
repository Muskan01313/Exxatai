import { notFound } from "next/navigation";
import { getCurrentUserId } from "@/lib/session";
import { getPageForUser } from "@/lib/workspace";
import { PageEditorClient } from "@/components/editor/PageEditorClient";

export default async function PageView({
  params,
}: {
  params: Promise<{ workspaceId: string; pageId: string }>;
}) {
  const { workspaceId, pageId } = await params;
  const userId = await getCurrentUserId();
  if (!userId) {
    notFound();
  }

  const page = await getPageForUser(pageId, userId);
  if (!page || page.workspaceId !== workspaceId) {
    notFound();
  }

  return (
    <PageEditorClient
      key={page.id}
      page={{
        id: page.id,
        title: page.title,
        icon: page.icon,
        cover: page.cover,
        content: page.content,
        contentVersion: page.contentVersion,
        isPublic: page.isPublic,
        updatedAt: page.updatedAt.toISOString(),
        deletedAt: page.deletedAt?.toISOString() ?? null,
      }}
    />
  );
}
