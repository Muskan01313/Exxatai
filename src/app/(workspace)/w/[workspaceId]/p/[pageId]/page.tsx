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
      pageId={page.id}
      workspaceId={workspaceId}
      initialTitle={page.title}
      initialIcon={page.icon}
      initialContent={page.content}
    />
  );
}
