"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function JoinButton({ token }: { token: string }) {
  const router = useRouter();
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function join() {
    setJoining(true);
    setError(null);
    const res = await fetch(`/api/invites/${token}/accept`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Couldn't join the workspace.");
      setJoining(false);
      return;
    }
    router.push(`/w/${data.workspaceId}`);
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => void join()}
        disabled={joining}
        className="mt-6 w-full rounded-md bg-accent py-2 text-sm font-medium text-white hover:bg-[#0077d4] disabled:opacity-50"
      >
        {joining ? "Joining…" : "Join workspace"}
      </button>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </>
  );
}
