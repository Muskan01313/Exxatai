"use client";

import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import {
  ArrowDown,
  ArrowUp,
  Download,
  Film,
  ImagePlus,
  Loader2,
  Music,
  Pause,
  Play,
  RefreshCw,
  Sparkles,
  Trash2,
  Type,
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

const selectClass =
  "w-full rounded-lg border border-white/10 bg-white/5 px-2.5 py-2 text-sm text-white outline-none focus:border-violet-400/60";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-xs font-medium text-white/60">
      {label}
      {children}
    </label>
  );
}

function Select<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: readonly T[] | Record<T, string>;
  onChange: (v: T) => void;
}) {
  const entries = Array.isArray(options)
    ? (options as readonly T[]).map((o) => [o, o] as const)
    : (Object.entries(options) as [T, string][]);
  return (
    <select className={selectClass} value={value} onChange={(e) => onChange(e.target.value as T)}>
      {entries.map(([v, label]) => (
        <option key={v} value={v} className="bg-neutral-900">
          {label}
        </option>
      ))}
    </select>
  );
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
    drawFrame(ctx, scenes, time, settings);
  }, [scenes, settings, time, playing, exportProgress, size.width, size.height]);

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

  return (
    <div
      className="min-h-screen bg-neutral-950 text-white"
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDragging(false);
      }}
      onDrop={onDrop}
    >
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500">
              <Film size={18} />
            </div>
            <div>
              <h1 className="text-base font-semibold leading-tight">Free Video Studio</h1>
              <p className="text-xs text-white/50">Turn text and pictures into videos. Free for everyone, no sign-up.</p>
            </div>
          </div>
          <span className="hidden rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-300 sm:inline">
            100% free · made in your browser
          </span>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[380px_1fr]">
        {/* Left: create + settings */}
        <section className="flex flex-col gap-5">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="mb-4 grid grid-cols-2 gap-1 rounded-xl bg-white/5 p-1 text-sm">
              {(
                [
                  ["text", "Text to video", Type],
                  ["pictures", "Pictures to video", ImagePlus],
                ] as const
              ).map(([value, label, Icon]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setMode(value)}
                  className={clsx(
                    "flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 transition",
                    mode === value ? "bg-white text-neutral-900" : "text-white/70 hover:text-white",
                  )}
                >
                  <Icon size={15} />
                  {label}
                </button>
              ))}
            </div>

            {mode === "text" ? (
              <div className="flex flex-col gap-3">
                <textarea
                  value={script}
                  onChange={(e) => setScript(e.target.value)}
                  rows={6}
                  maxLength={3000}
                  placeholder={"Describe your video…\n\nOne line = one scene. A single sentence makes a short clip."}
                  className="w-full resize-y rounded-xl border border-white/10 bg-black/30 p-3 text-sm outline-none placeholder:text-white/30 focus:border-violet-400/60"
                />
                <div className="flex flex-wrap gap-1.5">
                  {EXAMPLES.map((ex) => (
                    <button
                      key={ex}
                      type="button"
                      onClick={() => setScript(ex)}
                      className="max-w-full truncate rounded-full border border-white/10 px-2.5 py-1 text-xs text-white/60 hover:border-white/30 hover:text-white"
                    >
                      {ex.split("\n")[0]}
                    </button>
                  ))}
                </div>
                <Field label="Look">
                  <Select value={style} options={Object.keys(STYLES) as StyleName[]} onChange={setStyle} />
                </Field>
                <button
                  type="button"
                  disabled={!script.trim() || busy}
                  onClick={generateFromText}
                  className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-4 py-2.5 text-sm font-semibold shadow-lg shadow-violet-900/40 transition hover:brightness-110 disabled:opacity-40"
                >
                  {generating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                  {generating ? "Creating scenes…" : "Generate video"}
                </button>
              </div>
            ) : (
              <label
                className={clsx(
                  "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-10 text-center text-sm transition",
                  dragging ? "border-violet-400 bg-violet-400/10" : "border-white/15 hover:border-white/30",
                )}
              >
                <ImagePlus size={28} className="text-white/50" />
                <span className="font-medium">Add pictures</span>
                <span className="text-xs text-white/40">Click or drop images here. Each picture becomes an animated scene.</span>
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

          <div className="grid grid-cols-2 gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <Field label="Shape">
              <Select<Aspect>
                value={settings.aspect}
                options={{ "16:9": "Wide 16:9", "9:16": "Vertical 9:16", "1:1": "Square 1:1" }}
                onChange={(v) => set("aspect", v)}
              />
            </Field>
            <Field label="Captions">
              <Select<CaptionStyle>
                value={settings.captions}
                options={{ subtitle: "Subtitles", title: "Big titles", none: "None" }}
                onChange={(v) => set("captions", v)}
              />
            </Field>
            <Field label="Transition">
              <Select<Transition>
                value={settings.transition}
                options={{ fade: "Fade", slide: "Slide", zoom: "Zoom", cut: "Cut" }}
                onChange={(v) => set("transition", v)}
              />
            </Field>
            <Field label="Effect">
              <Select<Effect>
                value={settings.effect}
                options={{ none: "None", snow: "Snow", sparkles: "Sparkles", rain: "Rain", dust: "Floating dust" }}
                onChange={(v) => set("effect", v)}
              />
            </Field>
            <Field label="Color">
              <Select<Grade>
                value={settings.grade}
                options={{ none: "Natural", warm: "Warm", cool: "Cool", vivid: "Vivid", vintage: "Vintage", mono: "Black & white" }}
                onChange={(v) => set("grade", v)}
              />
            </Field>
            <Field label="Cinema bars">
              <Select<"on" | "off">
                value={settings.letterbox ? "on" : "off"}
                options={{ off: "Off", on: "On" }}
                onChange={(v) => set("letterbox", v === "on")}
              />
            </Field>
            <div className="col-span-2">
              <Field label="Background music (optional)">
                {music ? (
                  <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-2.5 py-2 text-sm text-white">
                    <Music size={14} className="shrink-0 text-violet-300" />
                    <span className="flex-1 truncate">{music.name}</span>
                    <button type="button" onClick={() => setMusic(null)} aria-label="Remove music" className="text-white/50 hover:text-white">
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <span className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-white/15 px-2.5 py-2 text-sm text-white/60 hover:border-white/30">
                    <Music size={14} /> Choose an audio file
                    <input
                      type="file"
                      accept="audio/*"
                      className="hidden"
                      onChange={(e) => setMusic(e.target.files?.[0] ?? null)}
                    />
                  </span>
                )}
              </Field>
            </div>
          </div>
        </section>

        {/* Right: preview, export, scenes */}
        <section className="flex min-w-0 flex-col gap-5">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex justify-center rounded-xl bg-black">
              <canvas
                ref={canvasRef}
                width={size.width}
                height={size.height}
                className={clsx(
                  "h-auto max-h-[60vh] w-auto max-w-full",
                  settings.aspect === "16:9" && "w-full",
                )}
              />
            </div>
            {!scenes.length && (
              <p className="mt-3 text-center text-sm text-white/40">
                Your video appears here. Start by describing it or adding pictures.
              </p>
            )}

            <div className="mt-3 flex items-center gap-3">
              <button
                type="button"
                disabled={!scenes.length || exportProgress !== null}
                onClick={() => {
                  if (!playing && time >= total) setTime(0);
                  setPlaying((p) => !p);
                }}
                aria-label={playing ? "Pause" : "Play"}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-neutral-900 disabled:opacity-30"
              >
                {playing ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
              </button>
              <input
                type="range"
                min={0}
                max={total || 1}
                step={0.01}
                value={Math.min(time, total)}
                disabled={!scenes.length || exportProgress !== null}
                onChange={(e) => {
                  setPlaying(false);
                  setTime(Number(e.target.value));
                }}
                className="flex-1 accent-violet-400"
              />
              <span className="w-24 shrink-0 text-right font-mono text-xs text-white/50">
                {time.toFixed(1)}s / {total.toFixed(1)}s
              </span>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              {exportProgress === null ? (
                <button
                  type="button"
                  disabled={!scenes.length || generating || !exportSupported}
                  onClick={startExport}
                  className="flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-neutral-900 transition hover:bg-white/90 disabled:opacity-30"
                >
                  <Film size={16} /> Make video file
                </button>
              ) : (
                <>
                  <div className="h-2 min-w-40 flex-1 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500" style={{ width: `${exportProgress * 100}%` }} />
                  </div>
                  <span className="text-xs text-white/60">Recording {Math.round(exportProgress * 100)}% — keep this tab open</span>
                  <button
                    type="button"
                    onClick={() => abortRef.current?.abort()}
                    className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-white/70 hover:text-white"
                  >
                    Cancel
                  </button>
                </>
              )}
              {!exportSupported && (
                <span className="text-xs text-amber-300">This browser can&apos;t save video. Try the latest Chrome, Edge or Firefox.</span>
              )}
            </div>

            {error && <p className="mt-3 rounded-lg bg-amber-400/10 px-3 py-2 text-sm text-amber-200">{error}</p>}

            {result && (
              <div className="mt-4 flex flex-col gap-3 rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-3 sm:flex-row sm:items-center">
                <video src={result.url} controls className="max-h-48 rounded-lg bg-black sm:w-64" />
                <div className="flex flex-col gap-2">
                  <p className="text-sm text-emerald-200">Your video is ready.</p>
                  <a
                    href={result.url}
                    download={`video.${result.extension}`}
                    className="flex w-fit items-center gap-2 rounded-xl bg-emerald-400 px-4 py-2 text-sm font-semibold text-neutral-900 hover:bg-emerald-300"
                  >
                    <Download size={16} /> Download .{result.extension}
                  </a>
                  <p className="text-xs text-white/40">{(result.blob.size / 1024 / 1024).toFixed(1)} MB</p>
                </div>
              </div>
            )}
          </div>

          {scenes.length > 0 && (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold">Scenes ({scenes.length})</h2>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setScenes([]);
                    setTime(0);
                    setResult(null);
                  }}
                  className="text-xs text-white/50 hover:text-white disabled:opacity-30"
                >
                  Clear all
                </button>
              </div>
              <ol className="flex flex-col gap-2">
                {scenes.map((scene, i) => (
                  <li key={scene.id} className="flex gap-3 rounded-xl border border-white/10 bg-black/20 p-2.5">
                    <label
                      className="relative flex h-20 w-28 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-lg"
                      style={{ background: `linear-gradient(135deg, ${scene.colors[0]}, ${scene.colors[1]})` }}
                      title="Replace picture"
                    >
                      {scene.image && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={scene.image.src} alt="" className="absolute inset-0 h-full w-full object-cover" />
                      )}
                      {scene.status === "loading" && <Loader2 size={20} className="relative animate-spin" />}
                      {scene.status === "error" && (
                        <span className="relative rounded bg-black/50 px-1.5 text-[10px]">no picture</span>
                      )}
                      <span className="absolute left-1 top-1 rounded bg-black/60 px-1.5 text-[10px]">{i + 1}</span>
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
                    <div className="flex min-w-0 flex-1 flex-col gap-2">
                      <input
                        value={scene.text}
                        onChange={(e) => updateScene(scene.id, { text: e.target.value })}
                        placeholder="Caption (optional)"
                        className="w-full rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-sm outline-none placeholder:text-white/30 focus:border-violet-400/60"
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          value={scene.motion}
                          onChange={(e) => updateScene(scene.id, { motion: e.target.value as Motion })}
                          className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs outline-none"
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
                        <label className="flex items-center gap-1 text-xs text-white/60">
                          <input
                            type="number"
                            min={1}
                            max={15}
                            step={0.5}
                            value={scene.duration}
                            onChange={(e) =>
                              updateScene(scene.id, { duration: Math.min(15, Math.max(1, Number(e.target.value) || 1)) })
                            }
                            className="w-14 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs outline-none"
                          />
                          sec
                        </label>
                        <div className="ml-auto flex items-center gap-0.5 text-white/50">
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
                              className="rounded p-1.5 hover:bg-white/10 hover:text-white disabled:opacity-30"
                            >
                              <RefreshCw size={14} />
                            </button>
                          )}
                          <button type="button" title="Move up" disabled={i === 0 || busy} onClick={() => moveScene(i, -1)} className="rounded p-1.5 hover:bg-white/10 hover:text-white disabled:opacity-30">
                            <ArrowUp size={14} />
                          </button>
                          <button type="button" title="Move down" disabled={i === scenes.length - 1 || busy} onClick={() => moveScene(i, 1)} className="rounded p-1.5 hover:bg-white/10 hover:text-white disabled:opacity-30">
                            <ArrowDown size={14} />
                          </button>
                          <button
                            type="button"
                            title="Delete scene"
                            disabled={busy}
                            onClick={() => setScenes((prev) => prev.filter((s) => s.id !== scene.id))}
                            className="rounded p-1.5 hover:bg-white/10 hover:text-red-300 disabled:opacity-30"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
              <div className="mt-3 flex flex-wrap gap-2">
                <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-dashed border-white/15 px-3 py-1.5 text-xs text-white/60 hover:border-white/30 hover:text-white">
                  <ImagePlus size={14} /> Add pictures
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
                  className="flex items-center gap-1.5 rounded-lg border border-dashed border-white/15 px-3 py-1.5 text-xs text-white/60 hover:border-white/30 hover:text-white"
                >
                  <Type size={14} /> Add text scene
                </button>
              </div>
            </div>
          )}

          <p className="text-xs leading-relaxed text-white/40">
            Pictures for text prompts come from a free public image generator. Your uploads, music and videos never leave
            your device: the video is assembled and recorded right in your browser, so there is nothing to pay for and no
            account to make.
          </p>
        </section>
      </main>
    </div>
  );
}
