import { TRANSITION_SECONDS, type Scene, type VideoSettings } from "./types";

export function totalDuration(scenes: Scene[]) {
  return scenes.reduce((sum, s) => sum + s.duration, 0);
}

const clamp = (v: number, min = 0, max = 1) => Math.min(max, Math.max(min, v));
const ease = (p: number) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);

// Deterministic pseudo-random so every frame (preview and export) looks the same.
function rand(n: number) {
  const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

const GRADE_FILTERS: Record<VideoSettings["grade"], string> = {
  none: "none",
  warm: "sepia(0.25) saturate(1.2) brightness(1.03)",
  cool: "hue-rotate(-12deg) saturate(1.1) brightness(1.02)",
  mono: "grayscale(1) contrast(1.15)",
  vivid: "saturate(1.45) contrast(1.08)",
  vintage: "sepia(0.55) contrast(0.92) brightness(1.05) saturate(0.8)",
};

function drawBackdrop(ctx: CanvasRenderingContext2D, scene: Scene, t: number, w: number, h: number) {
  const angle = t * 0.35;
  const cx = w / 2;
  const cy = h / 2;
  const r = Math.hypot(w, h) / 2;
  const g = ctx.createLinearGradient(
    cx + Math.cos(angle) * r,
    cy + Math.sin(angle) * r,
    cx - Math.cos(angle) * r,
    cy - Math.sin(angle) * r,
  );
  g.addColorStop(0, scene.colors[0]);
  g.addColorStop(1, scene.colors[1]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // Soft drifting light blobs.
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < 4; i++) {
    const bx = (rand(scene.seed + i) * w + Math.sin(t * 0.4 + i) * w * 0.15) % w;
    const by = (rand(scene.seed + i + 10) * h + Math.cos(t * 0.3 + i) * h * 0.15) % h;
    const br = Math.min(w, h) * (0.25 + rand(i + scene.seed) * 0.25);
    const blob = ctx.createRadialGradient(bx, by, 0, bx, by, br);
    blob.addColorStop(0, "rgba(255,255,255,0.18)");
    blob.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = blob;
    ctx.fillRect(0, 0, w, h);
  }
  ctx.globalCompositeOperation = "source-over";
}

function drawPicture(
  ctx: CanvasRenderingContext2D,
  scene: Scene,
  image: HTMLImageElement,
  local: number,
  w: number,
  h: number,
) {
  const p = ease(clamp(local / (scene.duration + TRANSITION_SECONDS)));
  let scale = 1.12;
  let dx = 0;
  let dy = 0;
  switch (scene.motion) {
    case "zoom-in":
      scale = 1.02 + 0.2 * p;
      break;
    case "zoom-out":
      scale = 1.22 - 0.2 * p;
      break;
    case "pan-left":
      scale = 1.2;
      dx = (0.5 - p) * w * 0.16;
      break;
    case "pan-right":
      scale = 1.2;
      dx = (p - 0.5) * w * 0.16;
      break;
    case "still":
      scale = 1;
      break;
  }
  // Gentle vertical drift keeps "still"-looking motions alive.
  if (scene.motion !== "still") dy = Math.sin(local * 0.6) * h * 0.006;

  const cover = Math.max(w / image.naturalWidth, h / image.naturalHeight) * scale;
  const iw = image.naturalWidth * cover;
  const ih = image.naturalHeight * cover;
  ctx.drawImage(image, (w - iw) / 2 + dx, (h - ih) / 2 + dy, iw, ih);
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawCaption(
  ctx: CanvasRenderingContext2D,
  scene: Scene,
  local: number,
  settings: VideoSettings,
  w: number,
  h: number,
) {
  const text = scene.text.trim();
  if (!text || settings.captions === "none") return;

  const fadeIn = clamp((local - 0.25) / 0.5);
  const fadeOut = clamp((scene.duration - local) / 0.4);
  const alpha = Math.min(fadeIn, fadeOut);
  if (alpha <= 0) return;

  const short = Math.min(w, h);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  if (settings.captions === "title") {
    const size = Math.round(short * 0.085);
    ctx.font = `800 ${size}px ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif`;
    const lines = wrapLines(ctx, text, w * 0.82).slice(0, 4);
    const lineH = size * 1.15;
    const startY = h / 2 - ((lines.length - 1) * lineH) / 2 + (1 - fadeIn) * size * 0.4;
    ctx.shadowColor = "rgba(0,0,0,0.55)";
    ctx.shadowBlur = size * 0.35;
    ctx.fillStyle = "#fff";
    lines.forEach((l, i) => ctx.fillText(l, w / 2, startY + i * lineH));
  } else {
    const size = Math.round(short * 0.045);
    ctx.font = `600 ${size}px ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif`;
    const lines = wrapLines(ctx, text, w * 0.8).slice(0, 3);
    const lineH = size * 1.3;
    const pad = size * 0.55;
    const boxW = Math.max(...lines.map((l) => ctx.measureText(l).width)) + pad * 2;
    const boxH = lines.length * lineH + pad;
    const bottom = h - (settings.letterbox ? h * 0.12 : 0) - short * 0.08;
    const top = bottom - boxH;
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.beginPath();
    ctx.roundRect((w - boxW) / 2, top, boxW, boxH, size * 0.35);
    ctx.fill();
    ctx.fillStyle = "#fff";
    lines.forEach((l, i) => ctx.fillText(l, w / 2, top + pad / 2 + lineH * (i + 0.5)));
  }
  ctx.restore();
}

function drawEffect(ctx: CanvasRenderingContext2D, effect: VideoSettings["effect"], t: number, w: number, h: number) {
  if (effect === "none") return;
  const short = Math.min(w, h);
  ctx.save();
  if (effect === "rain") {
    ctx.strokeStyle = "rgba(200,220,255,0.35)";
    ctx.lineWidth = Math.max(1, short * 0.0018);
    ctx.beginPath();
    for (let i = 0; i < 140; i++) {
      const speed = 0.9 + rand(i) * 0.8;
      const x = (rand(i + 1) * w * 1.2 + t * 120 * speed) % (w * 1.2) - w * 0.1;
      const y = (rand(i + 2) * h + t * h * speed) % h;
      const len = short * (0.03 + rand(i + 3) * 0.03);
      ctx.moveTo(x, y);
      ctx.lineTo(x - len * 0.15, y + len);
    }
    ctx.stroke();
  } else {
    const count = effect === "snow" ? 120 : effect === "sparkles" ? 60 : 90;
    for (let i = 0; i < count; i++) {
      const speed = 0.3 + rand(i) * 0.7;
      const size = short * (effect === "dust" ? 0.002 : 0.003) * (0.5 + rand(i + 7) * 1.5);
      let x = rand(i + 1) * w + Math.sin(t * speed + i) * short * 0.03;
      let y = rand(i + 2) * h;
      let alpha = 0.8;
      if (effect === "snow") {
        y = (y + t * short * 0.08 * speed) % h;
      } else if (effect === "dust") {
        x = (x + t * short * 0.02 * speed) % w;
        y = (y - t * short * 0.01 * speed + h) % h;
        alpha = 0.35;
      } else {
        // Sparkles twinkle in place.
        alpha = Math.max(0, Math.sin(t * (2 + speed * 3) + i * 1.7));
      }
      ctx.globalAlpha = alpha;
      ctx.fillStyle = effect === "sparkles" ? "#fff6c8" : "#ffffff";
      ctx.beginPath();
      if (effect === "sparkles") {
        const s = size * 2.2;
        ctx.moveTo(x, y - s);
        ctx.lineTo(x + s * 0.25, y);
        ctx.lineTo(x, y + s);
        ctx.lineTo(x - s * 0.25, y);
        ctx.closePath();
        ctx.moveTo(x - s, y);
        ctx.lineTo(x, y + s * 0.25);
        ctx.lineTo(x + s, y);
        ctx.lineTo(x, y - s * 0.25);
        ctx.closePath();
      } else {
        ctx.arc(x, y, size, 0, Math.PI * 2);
      }
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawVignette(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.hypot(w, h) * 0.6);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, "rgba(0,0,0,0.45)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function drawScene(
  ctx: CanvasRenderingContext2D,
  scene: Scene,
  local: number,
  settings: VideoSettings,
  w: number,
  h: number,
) {
  ctx.save();
  ctx.filter = GRADE_FILTERS[settings.grade];
  if (scene.image) {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);
    drawPicture(ctx, scene, scene.image, local, w, h);
  } else {
    drawBackdrop(ctx, scene, local, w, h);
  }
  ctx.restore();
  drawCaption(ctx, scene, local, settings, w, h);
}

/** Draws the whole video at time `t` (seconds). */
export function drawFrame(
  ctx: CanvasRenderingContext2D,
  scenes: Scene[],
  t: number,
  settings: VideoSettings,
) {
  const { width: w, height: h } = ctx.canvas;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, w, h);
  if (scenes.length === 0) return;

  let start = 0;
  let index = scenes.length - 1;
  for (let i = 0; i < scenes.length; i++) {
    if (t < start + scenes[i].duration) {
      index = i;
      break;
    }
    start += scenes[i].duration;
  }
  if (index === scenes.length - 1 && t >= start + scenes[index].duration) {
    // Past the end: hold the last frame.
    t = start + scenes[index].duration - 0.001;
  }

  const scene = scenes[index];
  const local = t - start;
  const prev = index > 0 ? scenes[index - 1] : null;
  const inTransition = prev && settings.transition !== "cut" && local < TRANSITION_SECONDS;

  if (inTransition && prev) {
    const p = ease(local / TRANSITION_SECONDS);
    const prevLocal = prev.duration + local;
    if (settings.transition === "slide") {
      ctx.save();
      ctx.translate(-p * w, 0);
      drawScene(ctx, prev, prevLocal, settings, w, h);
      ctx.restore();
      ctx.save();
      ctx.translate((1 - p) * w, 0);
      drawScene(ctx, scene, local, settings, w, h);
      ctx.restore();
    } else {
      drawScene(ctx, prev, prevLocal, settings, w, h);
      ctx.save();
      ctx.globalAlpha = p;
      if (settings.transition === "zoom") {
        const s = 1.25 - 0.25 * p;
        ctx.translate(w / 2, h / 2);
        ctx.scale(s, s);
        ctx.translate(-w / 2, -h / 2);
      }
      drawScene(ctx, scene, local, settings, w, h);
      ctx.restore();
    }
  } else {
    drawScene(ctx, scene, local, settings, w, h);
  }

  drawEffect(ctx, settings.effect, t, w, h);
  drawVignette(ctx, w, h);

  if (settings.letterbox) {
    ctx.fillStyle = "#000";
    const bar = h * 0.1;
    ctx.fillRect(0, 0, w, bar);
    ctx.fillRect(0, h - bar, w, bar);
  }

  // Fade from and to black at the very start and end.
  const total = totalDuration(scenes);
  const edge = Math.min(clamp(t / 0.5), clamp((total - t) / 0.6));
  if (edge < 1) {
    ctx.fillStyle = `rgba(0,0,0,${1 - edge})`;
    ctx.fillRect(0, 0, w, h);
  }
}
