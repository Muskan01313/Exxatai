"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Link as LinkIcon, X } from "lucide-react";
import { Modal } from "@/components/ui/Dropdown";

interface Member {
  id: string;
  name: string;
  email: string;
  role: "OWNER" | "EDITOR";
}

export function SettingsModal({
  workspaceId,
  workspaceName,
  onClose,
}: {
  workspaceId: string;
  workspaceName: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>([]);
  const [me, setMe] = useState<{ id: string; role: string } | null>(null);
  const [inviteUrl, setInviteUrl] = useState("");
  const [copied, setCopied] = useState(false);

  async function loadMembers() {
    const res = await fetch(`/api/workspaces/${workspaceId}/members`, { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      setMembers(data.members);
      setMe({ id: data.currentUserId, role: data.currentUserRole });
    }
  }

  function setToken(token: string) {
    setInviteUrl(`${window.location.origin}/invite/${token}`);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load when the dialog opens
    void loadMembers();
    void fetch(`/api/workspaces/${workspaceId}/invite`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => data && setToken(data.token));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt("Copy this invite link", inviteUrl);
    }
  }

  async function resetInvite() {
    if (!window.confirm("Reset the invite link? The current link will stop working.")) {
      return;
    }
    const res = await fetch(`/api/workspaces/${workspaceId}/invite`, { method: "POST" });
    if (res.ok) {
      setToken((await res.json()).token);
    }
  }

  async function remove(member: Member) {
    const leaving = member.id === me?.id;
    const question = leaving ? `Leave ${workspaceName}?` : `Remove ${member.name} from ${workspaceName}?`;
    if (!window.confirm(question)) {
      return;
    }
    const res = await fetch(`/api/workspaces/${workspaceId}/members/${member.id}`, { method: "DELETE" });
    if (!res.ok) {
      return;
    }
    if (leaving) {
      router.push("/");
      router.refresh();
    } else {
      await loadMembers();
    }
  }

  const isOwner = me?.role === "OWNER";

  return (
    <Modal onClose={onClose} className="max-w-[560px]">
      <div className="flex items-center justify-between border-b border-line px-5 py-3">
        <h2 className="text-sm font-semibold">{workspaceName} · Settings & members</h2>
        <button type="button" onClick={onClose} className="rounded p-1 text-ink-3 hover:bg-hover" aria-label="Close">
          <X size={16} />
        </button>
      </div>

      <div className="space-y-6 px-5 py-4">
        <section>
          <h3 className="text-sm font-medium">Invite people</h3>
          <p className="mt-0.5 text-xs text-ink-2">
            Anyone with this link can join this workspace after signing in, and can view and edit its pages.
          </p>
          <div className="mt-2 flex gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-2 rounded-md border border-line bg-[#f7f7f5] px-2.5">
              <LinkIcon size={14} className="shrink-0 text-ink-3" />
              <input readOnly value={inviteUrl} className="h-8 min-w-0 flex-1 bg-transparent text-xs text-ink-2 outline-none" />
            </div>
            <button
              type="button"
              onClick={() => void copyInvite()}
              disabled={!inviteUrl}
              className="rounded-md bg-accent px-3 text-sm font-medium text-white hover:bg-[#0077d4] disabled:opacity-50"
            >
              {copied ? "Copied" : "Copy link"}
            </button>
          </div>
          {isOwner && (
            <button type="button" onClick={() => void resetInvite()} className="mt-1.5 text-xs text-ink-3 underline hover:text-ink-2">
              Reset link
            </button>
          )}
        </section>

        <section>
          <h3 className="text-sm font-medium">Members ({members.length})</h3>
          <div className="mt-2 divide-y divide-line">
            {members.map((m) => (
              <div key={m.id} className="flex items-center gap-3 py-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#e3e2e0] text-xs font-semibold text-ink-2">
                  {m.name.charAt(0).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">
                    {m.name} {m.id === me?.id && <span className="text-ink-3">(you)</span>}
                  </span>
                  <span className="block truncate text-xs text-ink-3">{m.email}</span>
                </span>
                <span className="text-xs text-ink-2">{m.role === "OWNER" ? "Owner" : "Member"}</span>
                {m.role !== "OWNER" && (isOwner || m.id === me?.id) && (
                  <button
                    type="button"
                    onClick={() => void remove(m)}
                    className="rounded px-2 py-1 text-xs text-ink-3 hover:bg-hover hover:text-danger"
                  >
                    {m.id === me?.id ? "Leave" : "Remove"}
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    </Modal>
  );
}
