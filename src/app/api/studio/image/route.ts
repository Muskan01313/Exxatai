import { z } from "zod";

// Free, key-less image generation (Pollinations) by default. Point
// STUDIO_IMAGE_ENDPOINT at another service to swap it; the placeholders
// {prompt}, {width}, {height} and {seed} are filled in.
const DEFAULT_ENDPOINT =
  "https://image.pollinations.ai/prompt/{prompt}?width={width}&height={height}&seed={seed}&nologo=true&model=flux";

const querySchema = z.object({
  prompt: z.string().trim().min(1).max(600),
  width: z.coerce.number().int().min(256).max(1280),
  height: z.coerce.number().int().min(256).max(1280),
  seed: z.coerce.number().int().min(0).max(2_147_483_647),
});

// Best-effort per-IP limit so one visitor can't use up the free service for everyone.
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 30;
const hits = new Map<string, { count: number; resetAt: number }>();

function rateLimited(ip: string) {
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || entry.resetAt < now) {
    if (hits.size > 5000) hits.clear();
    hits.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_PER_WINDOW;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return new Response("Invalid input", { status: 400 });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
  if (rateLimited(ip)) {
    return new Response("Too many pictures at once. Wait a minute and try again.", { status: 429 });
  }

  const { prompt, width, height, seed } = parsed.data;
  const target = (process.env.STUDIO_IMAGE_ENDPOINT || DEFAULT_ENDPOINT)
    .replace("{prompt}", encodeURIComponent(prompt))
    .replace("{width}", String(width))
    .replace("{height}", String(height))
    .replace("{seed}", String(seed));

  try {
    const upstream = await fetch(target, { signal: AbortSignal.timeout(90_000) });
    const type = upstream.headers.get("content-type") ?? "";
    if (!upstream.ok || !type.startsWith("image/")) {
      return new Response("The picture service is busy. Try again.", { status: 502 });
    }
    return new Response(upstream.body, {
      headers: {
        "Content-Type": type,
        "Cache-Control": "public, max-age=86400, immutable",
      },
    });
  } catch {
    return new Response("The picture service did not answer. Try again.", { status: 504 });
  }
}
