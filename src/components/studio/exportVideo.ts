import { drawFrame, totalDuration } from "./renderer";
import type { Scene, VideoSettings } from "./types";

const MIME_TYPES = [
  "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
  "video/mp4",
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm",
];

export function pickMimeType() {
  if (typeof MediaRecorder === "undefined") return null;
  return MIME_TYPES.find((t) => MediaRecorder.isTypeSupported(t)) ?? null;
}

export function canExport() {
  return typeof HTMLCanvasElement !== "undefined" && "captureStream" in HTMLCanvasElement.prototype && !!pickMimeType();
}

export type ExportResult = { blob: Blob; extension: "mp4" | "webm" };

/**
 * Plays the video once onto `canvas` in real time and records it, with the
 * optional music track mixed in. Everything happens in the browser.
 */
export async function exportVideo(
  canvas: HTMLCanvasElement,
  scenes: Scene[],
  settings: VideoSettings,
  music: File | null,
  onProgress: (fraction: number) => void,
  signal: AbortSignal,
): Promise<ExportResult> {
  const mimeType = pickMimeType();
  if (!mimeType) throw new Error("This browser can't record video. Try the latest Chrome, Edge or Firefox.");

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available.");

  const total = totalDuration(scenes);
  const stream = canvas.captureStream(30);

  let audioCtx: AudioContext | null = null;
  let source: AudioBufferSourceNode | null = null;
  if (music) {
    audioCtx = new AudioContext();
    const buffer = await audioCtx.decodeAudioData(await music.arrayBuffer());
    source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const gain = audioCtx.createGain();
    // Fade the music out over the last second.
    gain.gain.setValueAtTime(1, audioCtx.currentTime + Math.max(0, total - 1));
    gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + total);
    const dest = audioCtx.createMediaStreamDestination();
    source.connect(gain).connect(dest);
    dest.stream.getAudioTracks().forEach((track) => stream.addTrack(track));
  }

  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8_000_000 });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const done = new Promise<void>((resolve) => {
    recorder.onstop = () => resolve();
  });

  drawFrame(ctx, scenes, 0, settings);
  recorder.start(250);
  source?.start();
  const startedAt = performance.now();

  await new Promise<void>((resolve) => {
    const tick = () => {
      const t = (performance.now() - startedAt) / 1000;
      if (signal.aborted || t >= total) {
        drawFrame(ctx, scenes, total, settings);
        resolve();
        return;
      }
      drawFrame(ctx, scenes, t, settings);
      onProgress(t / total);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

  // Give the recorder a moment to capture the last frame.
  await new Promise((r) => setTimeout(r, 150));
  recorder.stop();
  await done;
  source?.stop();
  await audioCtx?.close();
  stream.getTracks().forEach((track) => track.stop());

  if (signal.aborted) throw new DOMException("Export cancelled", "AbortError");

  onProgress(1);
  return {
    blob: new Blob(chunks, { type: mimeType.split(";")[0] }),
    extension: mimeType.startsWith("video/mp4") ? "mp4" : "webm",
  };
}
