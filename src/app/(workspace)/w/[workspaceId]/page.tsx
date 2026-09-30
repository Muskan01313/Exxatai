import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { EmptyWorkspaceState } from "@/components/sidebar/EmptyWorkspaceState";

export default async function WorkspaceHomePage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;

  const firstPage = await prisma.page.findFirst({
    where: { workspaceId, parentId: null },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  });

  if (firstPage) {
    redirect(`/w/${workspaceId}/p/${firstPage.id}`);
  }

  return <EmptyWorkspaceState workspaceId={workspaceId} />;
}
