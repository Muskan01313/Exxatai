"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { ArrowUp, Trash2 } from "lucide-react";

interface CommentItem {
  id: string;
  body: string;
  createdAt: string;
  authorId: string;
  author: { name: string };
}

export interface CommentsHandle {
  focus: () => void;
}

export const CommentsSection = forwardRef<CommentsHandle, { pageId: string }>(function CommentsSection({ pageId }, ref) {
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const sectionRef = useRef<HTMLElement>(null);

  useImperativeHandle(ref, () => ({
    focus: () => {
      sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      inputRef.current?.focus();
    },
  }));

  useEffect(() => {
    void fetch(`/api/pages/${pageId}/comments`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setComments(data.comments);
          setCurrentUserId(data.currentUserId);
        }
      });
  }, [pageId]);

  async function post() {
    const body = draft.trim();
    if (!body || posting) {
      return;
    }
    setPosting(true);
    const res = await fetch(`/api/pages/${pageId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });
    setPosting(false);
    if (res.ok) {
      const { comment } = await res.json();
      setComments((prev) => [...prev, comment]);
      setDraft("");
    }
  }

  async function remove(id: string) {
    const res = await fetch(`/api/comments/${id}`, { method: "DELETE" });
    if (res.ok) {
      setComments((prev) => prev.filter((c) => c.id !== id));
    }
  }

  return (
    <section ref={sectionRef} className="mt-16 border-t border-line pt-4">
      <h2 className="mb-3 text-sm font-medium text-ink-2">Comments {comments.length > 0 && `(${comments.length})`}</h2>
      <div className="space-y-4">
        {comments.map((c) => (
          <div key={c.id} className="group flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#e3e2e0] text-[11px] font-semibold text-ink-2">
              {c.author.name.charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm">
                <span className="font-medium">{c.author.name}</span>{" "}
                <span className="text-xs text-ink-3">{new Date(c.createdAt).toLocaleString()}</span>
              </p>
              <p className="mt-0.5 text-sm whitespace-pre-wrap">{c.body}</p>
            </div>
            {c.authorId === currentUserId && (
              <button
                type="button"
                onClick={() => void remove(c.id)}
                title="Delete comment"
                className="self-start rounded p-1 text-ink-3 opacity-0 group-hover:opacity-100 hover:bg-hover hover:text-danger"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-end gap-2 rounded-lg border border-line px-3 py-2 focus-within:border-ink-3">
        <textarea
          ref={inputRef}
          rows={1}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void post();
            }
          }}
          placeholder="Add a comment…"
          className="max-h-40 min-h-6 flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-ink-3"
        />
        <button
          type="button"
          onClick={() => void post()}
          disabled={!draft.trim() || posting}
          aria-label="Post comment"
          className="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-white disabled:bg-ink-3/40"
        >
          <ArrowUp size={14} />
        </button>
      </div>
    </section>
  );
});
