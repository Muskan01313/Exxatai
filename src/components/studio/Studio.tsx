"use client";

import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Clapperboard,
  Download,
  Film,
  ImagePlus,
  Loader2,
  Music,
  Pause,
  Play,
  RefreshCw,
  Trash2,
  Type,
  Wand2,
  X,
} from "lucide-react";
import clsx from "clsx";
import { drawFrame, totalDuration } from "./renderer";
import { canExport, exportVideo, type ExportResult } from "./exportVideo";
import {
  SIZES,
  type Aspect,
  type CaptionStyle,
  type Effect,
  type Grade,
  type Motion,
  type Scene,
  type Transition,
  type VideoSettings,
} from "./types";

const STYLES = {
  Cinematic: "cinematic film still, dramatic lighting, shallow depth of field, highly detailed",
  Photo: "photorealistic, natural light, 35mm photograph, sharp focus",
  Anime: "anime style, vibrant colors, detailed background, studio quality",
  "3D render": "3D render, octane, soft global illumination, highly detailed",
  Watercolor: "watercolor painting, soft washes, paper texture",
  Neon: "neon cyberpunk, glowing lights, night, moody atmosphere",
  Fantasy: "epic fantasy concept art, magical light, intricate detail",
} as const;
type StyleName = keyof typeof STYLES;

const MOTIONS: Motion[] = ["zoom-in", "pan-right", "zoom-out", "pan-left"];
const PALETTES: [string, string][] = [
  ["#1e3a8a", "#9333ea"],
  ["#0f766e", "#1d4ed8"],
  ["#be185d", "#f59e0b"],
  ["#111827", "#4f46e5"],
  ["#7c2d12", "#db2777"],
  ["#064e3b", "#65a30d"],
];

const EXAMPLES = [
  "A tiny astronaut cat floating through a glowing nebula",
  "Sunrise over misty mountains.\nA lone hiker reaches the summit.\nThe valley below fills with golden light.\nShe smiles, ready for the next adventure.",
  "A cozy coffee shop on a rainy night in Tokyo",
];

let sceneCounter = 0;
function newScene(partial: Partial<Scene>): Scene {
  sceneCounter += 1;
  return {
    id: `scene-${Date.now()}-${sceneCounter}`,
    text: "",
    duration: 3.5,
    motion: MOTIONS[sceneCounter % MOTIONS.length],
    image: null,
    prompt: null,
    seed: Math.floor(Math.random() * 1_000_000),
    colors: PALETTES[sceneCounter % PALETTES.length],
    status: "ready",
    ...partial,
  };
}

function splitScript(text: string) {
  const lines = text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);
  const parts = lines.length > 1 ? lines : text.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
  return parts.slice(0, 12);
}

async function loadImage(src: string) {
  const img = new Image();
  img.src = src;
  await img.decode();
  return img;
}

async function generatePicture(prompt: string, seed: number, aspect: Aspect) {
  const { width, height } = SIZES[aspect];
  // Ask for a smaller picture with the same shape; the motion hides the upscale.
  const scale = 1024 / Math.max(width, height);
  const params = new URLSearchParams({
    prompt,
    seed: String(seed),
    width: String(Math.round(width * scale)),
    height: String(Math.round(height * scale)),
  });
  const res = await fetch(`/api/studio/image?${params}`);
  if (!res.ok) throw new Error(await res.text());
  return loadImage(URL.createObjectURL(await res.blob()));
}

// A soft gradient per look, used for the look picker swatches.
const STYLE_SWATCHES: Record<StyleName, string> = {
  Cinematic: "linear-gradient(135deg, #1f2937, #b45309)",
  Photo: "linear-gradient(135deg, #78716c, #e7e5e4)",
  Anime: "linear-gradient(135deg, #f472b6, #60a5fa)",
  "3D render": "linear-gradient(135deg, #6366f1, #22d3ee)",
  Watercolor: "linear-gradient(135deg, #fda4af, #a7f3d0)",
  Neon: "linear-gradient(135deg, #a21caf, #0ea5e9)",
  Fantasy: "linear-gradient(135deg, #065f46, #fbbf24)",
};

const panelClass =
  "rounded-[28px] border border-white/[0.08] bg-white/[0.035] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl";

function Label({ children }: { children: React.ReactNode }) {
  return <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-white/40">{children}</span>;
}

function Chips<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: [T, string][];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(([v, label]) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={clsx(
            "rounded-full px-3 py-1.5 text-xs transition",
            value === v
              ? "bg-white text-neutral-950 shadow-[0_0_20px_rgba(255,255,255,0.15)]"
              : "border border-white/[0.08] bg-white/[0.03] text-white/65 hover:border-white/20 hover:text-white",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function Setting({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

const ASPECTS: [Aspect, string, string][] = [
  ["16:9", "Wide", "h-3.5 w-6"],
  ["9:16", "Vertical", "h-6 w-3.5"],
  ["1:1", "Square", "h-5 w-5"],
];

function formatTime(t: number) {
  const s = Math.max(0, t);
  return `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, "0")}`;
}

export function Studio() {
  const [mode, setMode] = useState<"text" | "pictures">("text");
  const [script, setScript] = useState("");
  const [style, setStyle] = useState<StyleName>("Cinematic");
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [settings, setSettings] = useState<VideoSettings>({
    aspect: "16:9",
    captions: "subtitle",
    transition: "fade",
    effect: "none",
    grade: "none",
    letterbox: false,
  });
  const [music, setMusic] = useState<File | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [exportProgress, setExportProgress] = useState<number | null>(null);
  const [result, setResult] = useState<(ExportResult & { url: string }) | null>(null);
  const [dragging, setDragging] = useState(false);
  const [exportSupported, setExportSupported] = useState(true);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const total = totalDuration(scenes);
  const size = SIZES[settings.aspect];
  const busy = generating || exportProgress !== null;

  useEffect(() => {
    // Feature detection has to wait until we're in the browser.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setExportSupported(canExport());
  }, []);

  // Draw the current frame whenever something changes while paused.
  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx || playing || exportProgress !== null) return;
    // At 0:00 the video is still fading in from black, so show a moment in instead.
    drawFrame(ctx, scenes, time === 0 ? Math.min(1, total / 2) : time, settings);
  }, [total, scenes, settings, time, playing, exportProgress, size.width, size.height]);

  // Preview playback loop.
  useEffect(() => {
    if (!playing) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    let frame = 0;
    const from = time >= total ? 0 : time;
    const startedAt = performance.now();
    const tick = () => {
      const t = from + (performance.now() - startedAt) / 1000;
      if (t >= total) {
        setTime(total);
        setPlaying(false);
        return;
      }
      drawFrame(ctx, scenes, t, settings);
      setTime(t);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // Restart only when play is toggled or the video itself changes, not on every tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, scenes, settings]);

  // Free the downloaded video's memory when it is replaced.
  useEffect(() => () => {
    if (result) URL.revokeObjectURL(result.url);
  }, [result]);

  function updateScene(id: string, patch: Partial<Scene>) {
    setScenes((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  async function fillPicture(scene: Scene, aspect: Aspect) {
    if (!scene.prompt) return;
    updateScene(scene.id, { status: "loading" });
    try {
      const image = await generatePicture(scene.prompt, scene.seed, aspect);
      updateScene(scene.id, { image, status: "ready" });
    } catch {
      updateScene(scene.id, { status: "error" });
    }
  }

  async function generateFromText() {
    const text = script.trim();
    if (!text) return;
    setError(null);
    setPlaying(false);
    setTime(0);
    setResult(null);

    const parts = splitScript(text);
    const suffix = STYLES[style];
    // A single prompt becomes a short clip of several shots; a script becomes one shot per line.
    const created =
      parts.length === 1
        ? [0, 1, 2, 3].map((i) =>
            newScene({ prompt: `${parts[0]}, ${suffix}${i ? `, shot ${i + 1}` : ""}`, duration: 3 }),
          )
        : parts.map((p) => newScene({ text: p, prompt: `${p}, ${suffix}` }));
    created.forEach((s) => (s.status = "loading"));
    setScenes(created);
    setGenerating(true);

    // Two at a time, to be gentle on the free picture service.
    const queue = [...created];
    let failures = 0;
    await Promise.all(
      [0, 1].map(async () => {
        while (queue.length) {
          const scene = queue.shift()!;
          try {
            const image = await generatePicture(scene.prompt!, scene.seed, settings.aspect);
            updateScene(scene.id, { image, status: "ready" });
          } catch {
            failures += 1;
            updateScene(scene.id, { status: "error" });
          }
        }
      }),
    );
    setGenerating(false);
    if (failures) {
      setError(
        failures === created.length
          ? "The free picture service didn't answer, so animated backgrounds are used instead. You can retry each scene or add your own pictures."
          : `${failures} picture(s) couldn't be made. Use ↻ on those scenes to try again.`,
      );
    }
  }

  async function addPictures(files: FileList | File[]) {
    const images = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (!images.length) return;
    setError(null);
    setResult(null);
    const loaded = await Promise.all(
      images.map(async (file) => {
        try {
          return newScene({ image: await loadImage(URL.createObjectURL(file)) });
        } catch {
          return null;
        }
      }),
    );
    const added = loaded.filter((s): s is Scene => s !== null);
    if (added.length < images.length) setError("Some pictures couldn't be opened.");
    setScenes((prev) => [...prev, ...added]);
  }

  async function replacePicture(id: string, file: File | undefined) {
    if (!file) return;
    try {
      updateScene(id, { image: await loadImage(URL.createObjectURL(file)), status: "ready", prompt: null });
    } catch {
      setError("That picture couldn't be opened.");
    }
  }

  function moveScene(index: number, delta: number) {
    setScenes((prev) => {
      const next = [...prev];
      const target = index + delta;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function startExport() {
    const canvas = canvasRef.current;
    if (!canvas || !scenes.length) return;
    setPlaying(false);
    setResult(null);
    setError(null);
    setExportProgress(0);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const out = await exportVideo(canvas, scenes, settings, music, setExportProgress, controller.signal);
      setResult({ ...out, url: URL.createObjectURL(out.blob) });
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError((e as Error).message || "Export failed.");
    } finally {
      setExportProgress(null);
      abortRef.current = null;
      setTime(0);
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) {
      setMode("pictures");
      void addPictures(e.dataTransfer.files);
    }
  }

  const set = <K extends keyof VideoSettings>(key: K, value: VideoSettings[K]) =>
    setSettings((s) => ({ ...s, [key]: value }));

  const showPlayOverlay = scenes.length > 0 && !playing && exportProgress === null && !generating;

  return (
    <div
      className="relative min-h-screen overflow-hidden bg-[#09080d] text-white selection:bg-fuchsia-500/40"
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDragging(false);
      }}
      onDrop={onDrop}
    >
      {/* Ambient aurora and film grain */}
      <div aria-hidden className="pointer-events-none fixed inset-0">
        <div className="studio-aurora absolute -left-[10%] -top-[20%] h-[60vh] w-[60vw] rounded-full bg-violet-600/25 blur-[120px]" />
        <div
          className="studio-aurora absolute -right-[10%] top-[10%] h-[50vh] w-[45vw] rounded-full bg-fuchsia-500/15 blur-[120px]"
          style={{ animationDelay: "-6s" }}
        />
        <div
          className="studio-aurora absolute bottom-[-20%] left-[25%] h-[50vh] w-[50vw] rounded-full bg-amber-500/10 blur-[140px]"
          style={{ animationDelay: "-12s" }}
        />
        <div className="studio-grain absolute inset-0 opacity-[0.07] mix-blend-overlay" />
      </div>

      <div className="relative">
        <header className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 pt-6 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="relative flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-violet-400 via-fuchsia-400 to-amber-300 shadow-[0_0_30px_rgba(217,70,239,0.45)]">
              <Clapperboard size={16} className="text-neutral-950" />
            </div>
            <span className="font-display text-2xl tracking-tight">
              Reel<span className="italic text-white/60">studio</span>
            </span>
          </div>
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-xs text-white/70 backdrop-blur">
            <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 align-middle shadow-[0_0_8px_#34d399]" />
            Free forever · no sign-up
          </span>
        </header>

        <section className="mx-auto max-w-3xl px-4 pb-10 pt-14 text-center sm:pt-20">
          <h1 className="font-display text-[44px] leading-[1.02] tracking-tight sm:text-7xl">
            Turn words &amp; pictures
            <br />
            into{" "}
            <span className="studio-shimmer bg-gradient-to-r from-violet-300 via-fuchsia-300 to-amber-200 bg-clip-text italic text-transparent">
              moving stories
            </span>
          </h1>
          <p className="mx-auto mt-5 max-w-lg text-[15px] leading-relaxed text-white/55">
            Describe a scene or drop in your photos. We add the motion, music and captions, and you take home a video. Made
            right in your browser, free for everyone.
          </p>
        </section>

        <main className="mx-auto grid max-w-7xl gap-5 px-4 pb-16 sm:px-6 lg:grid-cols-[400px_1fr]">
          {/* Left: create + settings */}
          {/* On phones the preview sits between "create" and the settings. */}
          <section className="contents lg:flex lg:flex-col lg:gap-5">
            <div className={clsx(panelClass, "order-1 p-5")}>
              <div className="relative mb-5 grid grid-cols-2 rounded-full border border-white/[0.08] bg-black/30 p-1 text-sm">
                <span
                  aria-hidden
                  className={clsx(
                    "absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-full bg-white transition-transform duration-300 ease-out",
                    mode === "pictures" && "translate-x-full",
                  )}
                />
                {(
                  [
                    ["text", "Text", Type],
                    ["pictures", "Pictures", ImagePlus],
                  ] as const
                ).map(([value, label, Icon]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setMode(value)}
                    className={clsx(
                      "relative flex items-center justify-center gap-1.5 rounded-full px-3 py-2 transition-colors",
                      mode === value ? "text-neutral-950" : "text-white/60 hover:text-white",
                    )}
                  >
                    <Icon size={14} />
                    {label}
                    <span className="hidden sm:inline">to video</span>
                  </button>
                ))}
              </div>

              {mode === "text" ? (
                <div className="flex flex-col gap-5">
                  <div className="group relative">
                    <div className="absolute -inset-px rounded-[20px] bg-gradient-to-br from-violet-500/50 via-fuchsia-500/30 to-amber-400/40 opacity-0 blur-sm transition group-focus-within:opacity-100" />
                    <textarea
                      value={script}
                      onChange={(e) => setScript(e.target.value)}
                      rows={6}
                      maxLength={3000}
                      placeholder={"A lighthouse in a storm, waves crashing…\n\nOne line = one scene."}
                      className="relative w-full resize-y rounded-[20px] border border-white/[0.08] bg-[#0d0c12]/90 p-4 text-[15px] leading-relaxed outline-none placeholder:text-white/25"
                    />
                  </div>
                  <div className="-mt-2 flex flex-wrap gap-1.5">
                    {EXAMPLES.map((ex) => (
                      <button
                        key={ex}
                        type="button"
                        onClick={() => setScript(ex)}
                        className="max-w-full truncate rounded-full border border-dashed border-white/15 px-2.5 py-1 text-[11px] text-white/50 transition hover:border-white/35 hover:text-white"
                      >
                        ✦ {ex.split("\n")[0]}
                      </button>
                    ))}
                  </div>

                  <Setting label="Look">
                    <div className="grid grid-cols-4 gap-2">
                      {(Object.keys(STYLES) as StyleName[]).map((name) => (
                        <button
                          key={name}
                          type="button"
                          onClick={() => setStyle(name)}
                          className="group flex flex-col items-center gap-1.5"
                        >
                          <span
                            className={clsx(
                              "h-11 w-full rounded-xl ring-offset-2 ring-offset-[#0f0e14] transition",
                              style === name ? "ring-2 ring-white" : "opacity-70 group-hover:opacity-100",
                            )}
                            style={{ background: STYLE_SWATCHES[name] }}
                          />
                          <span className={clsx("text-[11px]", style === name ? "text-white" : "text-white/45")}>
                            {name}
                          </span>
                        </button>
                      ))}
                    </div>
                  </Setting>

                  <button
                    type="button"
                    disabled={!script.trim() || busy}
                    onClick={generateFromText}
                    className="studio-shimmer group relative flex items-center justify-center gap-2 overflow-hidden rounded-full bg-[linear-gradient(90deg,#8b5cf6,#d946ef,#f59e0b,#d946ef,#8b5cf6)] px-5 py-3.5 text-sm font-semibold text-white shadow-[0_10px_40px_-10px_rgba(217,70,239,0.7)] transition hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
                  >
                    {generating ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
                    {generating ? "Dreaming up your scenes…" : "Generate video"}
                  </button>
                </div>
              ) : (
                <label
                  className={clsx(
                    "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-[20px] border border-dashed px-4 py-14 text-center text-sm transition",
                    dragging
                      ? "border-fuchsia-300 bg-fuchsia-400/10"
                      : "border-white/15 bg-black/20 hover:border-white/30 hover:bg-white/[0.03]",
                  )}
                >
                  <span className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-white/15 to-white/5">
                    <ImagePlus size={22} className="text-white/80" />
                  </span>
                  <span className="font-display text-2xl">Drop your photos</span>
                  <span className="max-w-[16rem] text-xs leading-relaxed text-white/45">
                    or click to choose. Each picture becomes a softly moving scene.
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e: ChangeEvent<HTMLInputElement>) => {
                      if (e.target.files) void addPictures(e.target.files);
                      e.target.value = "";
                    }}
                  />
                </label>
              )}
            </div>

            <div className={clsx(panelClass, "order-3 flex flex-col gap-6 p-5")}>
              <Setting label="Shape">
                <div className="grid grid-cols-3 gap-2">
                  {ASPECTS.map(([value, label, box]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => set("aspect", value)}
                      className={clsx(
                        "flex flex-col items-center gap-2 rounded-2xl border px-2 py-3 text-xs transition",
                        settings.aspect === value
                          ? "border-white/60 bg-white/[0.08] text-white"
                          : "border-white/[0.08] text-white/50 hover:border-white/20 hover:text-white",
                      )}
                    >
                      <span className="flex h-6 items-center">
                        <span className={clsx("rounded-[4px] border-[1.5px] border-current", box)} />
                      </span>
                      {label} <span className="-mt-1.5 text-[10px] opacity-60">{value}</span>
                    </button>
                  ))}
                </div>
              </Setting>
              <Setting label="Captions">
                <Chips<CaptionStyle>
                  value={settings.captions}
                  options={[
                    ["subtitle", "Subtitles"],
                    ["title", "Big titles"],
                    ["none", "None"],
                  ]}
                  onChange={(v) => set("captions", v)}
                />
              </Setting>
              <Setting label="Transition">
                <Chips<Transition>
                  value={settings.transition}
                  options={[
                    ["fade", "Fade"],
                    ["slide", "Slide"],
                    ["zoom", "Zoom"],
                    ["cut", "Cut"],
                  ]}
                  onChange={(v) => set("transition", v)}
                />
              </Setting>
              <Setting label="Atmosphere">
                <Chips<Effect>
                  value={settings.effect}
                  options={[
                    ["none", "None"],
                    ["snow", "❄ Snow"],
                    ["sparkles", "✦ Sparkles"],
                    ["rain", "☂ Rain"],
                    ["dust", "· Dust"],
                  ]}
                  onChange={(v) => set("effect", v)}
                />
              </Setting>
              <Setting label="Color">
                <Chips<Grade>
                  value={settings.grade}
                  options={[
                    ["none", "Natural"],
                    ["warm", "Warm"],
                    ["cool", "Cool"],
                    ["vivid", "Vivid"],
                    ["vintage", "Vintage"],
                    ["mono", "B&W"],
                  ]}
                  onChange={(v) => set("grade", v)}
                />
              </Setting>
              <button
                type="button"
                onClick={() => set("letterbox", !settings.letterbox)}
                className="flex items-center justify-between gap-3 text-left"
              >
                <span className="flex flex-col gap-0.5">
                  <Label>Cinema bars</Label>
                  <span className="text-xs text-white/45">Black bars for a widescreen film look</span>
                </span>
                <span
                  className={clsx(
                    "relative h-6 w-11 shrink-0 rounded-full transition",
                    settings.letterbox ? "bg-white" : "bg-white/15",
                  )}
                >
                  <span
                    className={clsx(
                      "absolute top-1 h-4 w-4 rounded-full transition-all",
                      settings.letterbox ? "left-6 bg-neutral-950" : "left-1 bg-white",
                    )}
                  />
                </span>
              </button>
              <Setting label="Soundtrack">
                {music ? (
                  <div className="flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.04] px-3 py-2.5 text-sm">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-violet-400 to-fuchsia-400">
                      <Music size={14} className="text-neutral-950" />
                    </span>
                    <span className="flex-1 truncate">{music.name}</span>
                    <button
                      type="button"
                      onClick={() => setMusic(null)}
                      aria-label="Remove music"
                      className="rounded-full p-1 text-white/50 hover:bg-white/10 hover:text-white"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-white/15 px-3 py-2.5 text-sm text-white/55 transition hover:border-white/30 hover:text-white">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.06]">
                      <Music size={14} />
                    </span>
                    Add background music
                    <input
                      type="file"
                      accept="audio/*"
                      className="hidden"
                      onChange={(e) => setMusic(e.target.files?.[0] ?? null)}
                    />
                  </label>
                )}
              </Setting>
            </div>
          </section>

          {/* Right: preview, export, scenes */}
          <section className="order-2 flex min-w-0 flex-col gap-5">
            <div className={clsx(panelClass, "p-3 sm:p-4")}>
              <div className="relative overflow-hidden rounded-[20px] bg-black ring-1 ring-white/[0.06]">
                <div className="flex justify-center bg-[radial-gradient(ellipse_at_center,#1a1823,#000)]">
                  <canvas
                    ref={canvasRef}
                    width={size.width}
                    height={size.height}
                    className={clsx("h-auto max-h-[62vh] w-auto max-w-full", settings.aspect === "16:9" && "w-full")}
                  />
                </div>
                {!scenes.length && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[radial-gradient(ellipse_at_center,rgba(139,92,246,0.18),transparent_65%)] px-6 text-center">
                    <Film size={22} className="text-white/30" />
                    <p className="font-display text-3xl text-white/85 sm:text-4xl">
                      Your film starts <span className="italic">here</span>
                    </p>
                    <p className="text-sm text-white/40">Describe a scene or add a few photos to begin.</p>
                  </div>
                )}
                {showPlayOverlay && (
                  <button
                    type="button"
                    onClick={() => {
                      if (time >= total) setTime(0);
                      setPlaying(true);
                    }}
                    aria-label="Play"
                    className="group absolute inset-0 flex items-center justify-center bg-black/10 transition hover:bg-black/25"
                  >
                    <span className="flex h-16 w-16 items-center justify-center rounded-full border border-white/30 bg-white/15 shadow-2xl backdrop-blur-md transition group-hover:scale-105 group-hover:bg-white/25">
                      <Play size={24} className="ml-1 fill-white" />
                    </span>
                  </button>
                )}
                {playing && (
                  <button
                    type="button"
                    onClick={() => setPlaying(false)}
                    aria-label="Pause"
                    className="absolute inset-0"
                  />
                )}
                {exportProgress !== null && (
                  <span className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-red-500/90 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" /> Rec
                  </span>
                )}
              </div>

              {/* Filmstrip timeline */}
              <div className="mt-3 flex items-center gap-3 px-1">
                <button
                  type="button"
                  disabled={!scenes.length || exportProgress !== null}
                  onClick={() => {
                    if (!playing && time >= total) setTime(0);
                    setPlaying((p) => !p);
                  }}
                  aria-label={playing ? "Pause" : "Play"}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-neutral-950 transition hover:scale-105 disabled:opacity-25 disabled:hover:scale-100"
                >
                  {playing ? <Pause size={16} className="fill-current" /> : <Play size={16} className="ml-0.5 fill-current" />}
                </button>
                <div className="relative h-10 flex-1">
                  <div className="absolute inset-0 flex gap-[3px] overflow-hidden rounded-xl">
                    {scenes.length ? (
                      scenes.map((scene) => (
                        <div
                          key={scene.id}
                          className="relative h-full min-w-0 overflow-hidden rounded-[5px]"
                          style={{
                            flexGrow: scene.duration,
                            flexBasis: 0,
                            background: `linear-gradient(135deg, ${scene.colors[0]}, ${scene.colors[1]})`,
                          }}
                        >
                          {scene.image && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={scene.image.src} alt="" className="h-full w-full object-cover" />
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="h-full w-full rounded-xl border border-dashed border-white/10" />
                    )}
                  </div>
                  {scenes.length > 0 && (
                    <>
                      <div
                        className="pointer-events-none absolute inset-y-0 bg-black/45"
                        style={{ width: `${100 - (Math.min(time, total) / (total || 1)) * 100}%`, left: `${(Math.min(time, total) / (total || 1)) * 100}%` }}
                      />
                      <div
                        className="pointer-events-none absolute -inset-y-1 w-0.5 rounded-full bg-white shadow-[0_0_10px_white]"
                        style={{ left: `calc(${(Math.min(time, total) / (total || 1)) * 100}% - 1px)` }}
                      />
                    </>
                  )}
                  <input
                    type="range"
                    aria-label="Seek"
                    min={0}
                    max={total || 1}
                    step={0.01}
                    value={Math.min(time, total)}
                    disabled={!scenes.length || exportProgress !== null}
                    onChange={(e) => {
                      setPlaying(false);
                      setTime(Number(e.target.value));
                    }}
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-default"
                  />
                </div>
                <span className="hidden shrink-0 whitespace-nowrap text-right font-mono text-[11px] text-white/45 sm:block">
                  {formatTime(time)} / {formatTime(total)}
                </span>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3 px-1">
                {exportProgress === null ? (
                  <button
                    type="button"
                    disabled={!scenes.length || generating || !exportSupported}
                    onClick={startExport}
                    className="flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-neutral-950 shadow-[0_8px_30px_-8px_rgba(255,255,255,0.4)] transition hover:scale-[1.02] disabled:opacity-25 disabled:shadow-none disabled:hover:scale-100"
                  >
                    <Download size={15} /> Export video
                  </button>
                ) : (
                  <>
                    <div className="h-1.5 min-w-40 flex-1 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-violet-400 via-fuchsia-400 to-amber-300 transition-[width]"
                        style={{ width: `${exportProgress * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-white/55">
                      {Math.round(exportProgress * 100)}% · keep this tab open
                    </span>
                    <button
                      type="button"
                      onClick={() => abortRef.current?.abort()}
                      className="rounded-full border border-white/15 px-3.5 py-1.5 text-xs text-white/70 hover:text-white"
                    >
                      Cancel
                    </button>
                  </>
                )}
                {!exportSupported && (
                  <span className="text-xs text-amber-200/80">
                    This browser can&apos;t save video. Try the latest Chrome, Edge or Firefox.
                  </span>
                )}
              </div>

              {error && (
                <p className="mx-1 mt-4 rounded-2xl border border-amber-300/15 bg-amber-300/[0.06] px-4 py-3 text-sm leading-relaxed text-amber-100/85">
                  {error}
                </p>
              )}

              {result && (
                <div className="mx-1 mt-4 flex flex-col gap-4 rounded-[20px] border border-emerald-300/15 bg-gradient-to-br from-emerald-400/[0.08] to-transparent p-4 sm:flex-row sm:items-center">
                  <video src={result.url} controls className="max-h-52 rounded-xl bg-black sm:w-72" />
                  <div className="flex flex-col gap-2">
                    <p className="font-display text-3xl">
                      It&apos;s a <span className="italic">wrap.</span>
                    </p>
                    <p className="text-xs text-white/45">
                      {result.extension.toUpperCase()} · {(result.blob.size / 1024 / 1024).toFixed(1)} MB
                    </p>
                    <a
                      href={result.url}
                      download={`video.${result.extension}`}
                      className="mt-1 flex w-fit items-center gap-2 rounded-full bg-emerald-300 px-5 py-2.5 text-sm font-semibold text-neutral-950 transition hover:scale-[1.02]"
                    >
                      <Download size={15} /> Download
                    </a>
                  </div>
                </div>
              )}
            </div>

            {scenes.length > 0 && (
              <div className={clsx(panelClass, "p-5")}>
                <div className="mb-4 flex items-baseline justify-between">
                  <h2 className="font-display text-3xl">
                    Scenes <span className="text-white/35">{scenes.length}</span>
                  </h2>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setScenes([]);
                      setTime(0);
                      setResult(null);
                    }}
                    className="text-xs text-white/40 transition hover:text-white disabled:opacity-30"
                  >
                    Clear all
                  </button>
                </div>
                <ol className="grid gap-3 sm:grid-cols-2">
                  {scenes.map((scene, i) => (
                    <li
                      key={scene.id}
                      className="group overflow-hidden rounded-[20px] border border-white/[0.07] bg-black/25 transition hover:border-white/15"
                    >
                      <label
                        className="relative flex aspect-video cursor-pointer items-center justify-center overflow-hidden"
                        style={{ background: `linear-gradient(135deg, ${scene.colors[0]}, ${scene.colors[1]})` }}
                        title="Replace picture"
                      >
                        {scene.image && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={scene.image.src}
                            alt=""
                            className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105"
                          />
                        )}
                        <span className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />
                        {scene.status === "loading" && (
                          <span className="relative flex items-center gap-2 rounded-full bg-black/40 px-3 py-1.5 text-xs backdrop-blur">
                            <Loader2 size={13} className="animate-spin" /> Painting…
                          </span>
                        )}
                        {scene.status === "error" && (
                          <span className="relative rounded-full bg-black/40 px-3 py-1 text-[11px] text-white/80 backdrop-blur">
                            Using a gradient · tap to add a photo
                          </span>
                        )}
                        <span className="font-display absolute bottom-2 left-3 text-3xl leading-none text-white/90">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            void replacePicture(scene.id, e.target.files?.[0]);
                            e.target.value = "";
                          }}
                        />
                      </label>
                      <div className="flex flex-col gap-2.5 p-3">
                        <input
                          value={scene.text}
                          onChange={(e) => updateScene(scene.id, { text: e.target.value })}
                          placeholder="Add a caption…"
                          className="w-full rounded-xl border border-transparent bg-white/[0.04] px-3 py-2 text-sm outline-none transition placeholder:text-white/25 focus:border-white/15"
                        />
                        <div className="flex items-center gap-2">
                          <select
                            value={scene.motion}
                            onChange={(e) => updateScene(scene.id, { motion: e.target.value as Motion })}
                            aria-label="Camera motion"
                            className="min-w-0 rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-xs text-white/75 outline-none"
                          >
                            {(
                              [
                                ["zoom-in", "Zoom in"],
                                ["zoom-out", "Zoom out"],
                                ["pan-left", "Pan left"],
                                ["pan-right", "Pan right"],
                                ["still", "Still"],
                              ] as const
                            ).map(([v, l]) => (
                              <option key={v} value={v} className="bg-neutral-900">
                                {l}
                              </option>
                            ))}
                          </select>
                          <label className="flex items-center gap-1 rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-xs text-white/50">
                            <input
                              type="number"
                              min={1}
                              max={15}
                              step={0.5}
                              value={scene.duration}
                              aria-label="Seconds"
                              onChange={(e) =>
                                updateScene(scene.id, { duration: Math.min(15, Math.max(1, Number(e.target.value) || 1)) })
                              }
                              className="w-8 bg-transparent text-white/80 outline-none"
                            />
                            s
                          </label>
                          <div className="ml-auto flex items-center text-white/45">
                            {scene.prompt && (
                              <button
                                type="button"
                                title="New picture"
                                disabled={scene.status === "loading" || exportProgress !== null}
                                onClick={() => {
                                  const seed = Math.floor(Math.random() * 1_000_000);
                                  updateScene(scene.id, { seed });
                                  void fillPicture({ ...scene, seed }, settings.aspect);
                                }}
                                className="rounded-full p-1.5 transition hover:bg-white/10 hover:text-white disabled:opacity-30"
                              >
                                <RefreshCw size={13} />
                              </button>
                            )}
                            <button
                              type="button"
                              title="Move earlier"
                              disabled={i === 0 || busy}
                              onClick={() => moveScene(i, -1)}
                              className="rounded-full p-1.5 transition hover:bg-white/10 hover:text-white disabled:opacity-25"
                            >
                              <ArrowLeft size={13} />
                            </button>
                            <button
                              type="button"
                              title="Move later"
                              disabled={i === scenes.length - 1 || busy}
                              onClick={() => moveScene(i, 1)}
                              className="rounded-full p-1.5 transition hover:bg-white/10 hover:text-white disabled:opacity-25"
                            >
                              <ArrowRight size={13} />
                            </button>
                            <button
                              type="button"
                              title="Delete scene"
                              disabled={busy}
                              onClick={() => setScenes((prev) => prev.filter((s) => s.id !== scene.id))}
                              className="rounded-full p-1.5 transition hover:bg-red-400/15 hover:text-red-300 disabled:opacity-25"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                  <li className="flex min-h-40 flex-col gap-2 sm:min-h-0">
                    <label className="flex flex-1 cursor-pointer flex-col items-center justify-center gap-2 rounded-[20px] border border-dashed border-white/12 text-xs text-white/45 transition hover:border-white/30 hover:text-white">
                      <ImagePlus size={18} /> Add pictures
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files) void addPictures(e.target.files);
                          e.target.value = "";
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => setScenes((prev) => [...prev, newScene({ text: "Your text here" })])}
                      className="flex flex-1 flex-col items-center justify-center gap-2 rounded-[20px] border border-dashed border-white/12 py-4 text-xs text-white/45 transition hover:border-white/30 hover:text-white"
                    >
                      <Type size={18} /> Add a title card
                    </button>
                  </li>
                </ol>
              </div>
            )}
          </section>
        </main>

        <footer className="mx-auto max-w-2xl px-4 pb-10 text-center text-xs leading-relaxed text-white/30">
          Pictures for text prompts come from a free public image generator. Your photos, music and videos never leave
          your device. Everything is put together in your browser, so it&apos;s free for everyone.
        </footer>
      </div>
    </div>
  );
}
