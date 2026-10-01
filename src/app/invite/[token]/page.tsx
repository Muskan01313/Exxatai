import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";
import { JoinButton } from "./JoinButton";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const userId = await getCurrentUserId();
  if (!userId) {
    redirect(`/login?callbackUrl=${encodeURIComponent(`/invite/${token}`)}`);
  }

  const invite = await prisma.workspaceInvite.findUnique({
    where: { token },
    include: { workspace: { select: { id: true, name: true, _count: { select: { members: true } } } } },
  });

  if (invite && !invite.revokedAt) {
    const member = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: invite.workspaceId, userId } },
    });
    if (member) {
      redirect(`/w/${invite.workspaceId}`);
    }
  }

  return (
    <div className="flex flex-1 items-center justify-center bg-sidebar px-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-8 text-center shadow-menu">
        {invite && !invite.revokedAt ? (
          <>
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-ink-3 text-xl font-semibold text-white">
              {invite.workspace.name.charAt(0).toUpperCase()}
            </span>
            <h1 className="mt-4 text-lg font-semibold">Join {invite.workspace.name}</h1>
            <p className="mt-1 text-sm text-ink-2">
              You&apos;ve been invited to a workspace with {invite.workspace._count.members}{" "}
              {invite.workspace._count.members === 1 ? "member" : "members"}.
            </p>
            <JoinButton token={token} />
          </>
        ) : (
          <>
            <h1 className="text-lg font-semibold">This invite link isn&apos;t valid</h1>
            <p className="mt-1 text-sm text-ink-2">It may have been reset. Ask the person who sent it for a new link.</p>
            <Link href="/" className="mt-6 inline-block text-sm text-accent underline">
              Go to your workspace
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
