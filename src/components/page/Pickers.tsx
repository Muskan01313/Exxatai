"use client";

import { useState } from "react";
import { Shuffle } from "lucide-react";
import { EMOJI_GROUPS, randomEmoji } from "@/lib/emojis";
import { COVER_PRESETS } from "@/lib/covers";

export function IconPicker({ onPick, onRemove }: { onPick: (emoji: string) => void; onRemove?: () => void }) {
  return (
    <div className="w-[340px] px-2">
      <div className="flex items-center justify-between border-b border-line px-1 pb-1.5">
        <span className="text-sm font-medium">Emoji</span>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => onPick(randomEmoji())}
            className="flex items-center gap-1 rounded px-2 py-1 text-xs text-ink-2 hover:bg-hover"
          >
            <Shuffle size={13} /> Random
          </button>
          {onRemove && (
            <button type="button" onClick={onRemove} className="rounded px-2 py-1 text-xs text-ink-2 hover:bg-hover">
              Remove
            </button>
          )}
        </div>
      </div>
      <div className="max-h-72 overflow-y-auto pt-1">
        {EMOJI_GROUPS.map((group) => (
          <div key={group.name}>
            <p className="px-1 pt-2 pb-1 text-xs text-ink-3">{group.name}</p>
            <div className="grid grid-cols-12 gap-0.5">
              {group.emojis.map((emoji, i) => (
                <button
                  key={`${emoji}-${i}`}
                  type="button"
                  onClick={() => onPick(emoji)}
                  className="flex h-7 w-7 items-center justify-center rounded text-xl hover:bg-hover"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CoverPicker({ onPick, onRemove }: { onPick: (cover: string) => void; onRemove?: () => void }) {
  const [tab, setTab] = useState<"gallery" | "link">("gallery");
  const [url, setUrl] = useState("");
  const validUrl = /^https:\/\/\S+$/.test(url.trim());

  return (
    <div className="w-[400px] px-3">
      <div className="flex items-center gap-3 border-b border-line pb-1.5 text-sm">
        {(["gallery", "link"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`pb-1 capitalize ${tab === t ? "border-b-2 border-ink font-medium" : "text-ink-2"}`}
          >
            {t}
          </button>
        ))}
        {onRemove && (
          <button type="button" onClick={onRemove} className="ml-auto text-xs text-ink-2 hover:text-ink">
            Remove
          </button>
        )}
      </div>
      {tab === "gallery" ? (
        <div className="grid grid-cols-4 gap-2 py-3">
          {COVER_PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              title={p.label}
              onClick={() => onPick(`preset:${p.key}`)}
              className="h-14 rounded-md transition-opacity hover:opacity-80"
              style={{ background: p.background }}
            />
          ))}
        </div>
      ) : (
        <form
          className="space-y-2 py-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (validUrl) {
              onPick(url.trim());
            }
          }}
        >
          <input
            autoFocus
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste an image link (https://…)"
            className="w-full rounded-md border border-line bg-[#f7f7f5] px-2.5 py-1.5 text-sm outline-none focus:border-accent/60"
          />
          <button
            type="submit"
            disabled={!validUrl}
            className="w-full rounded-md bg-accent py-1.5 text-sm font-medium text-white hover:bg-[#0077d4] disabled:opacity-40"
          >
            Submit
          </button>
          <p className="text-center text-xs text-ink-3">Works with any image on the web.</p>
        </form>
      )}
    </div>
  );
}
