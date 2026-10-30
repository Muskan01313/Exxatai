export type Motion = "zoom-in" | "zoom-out" | "pan-left" | "pan-right" | "still";
export type Transition = "fade" | "slide" | "zoom" | "cut";
export type CaptionStyle = "subtitle" | "title" | "none";
export type Effect = "none" | "snow" | "sparkles" | "rain" | "dust";
export type Grade = "none" | "warm" | "cool" | "mono" | "vivid" | "vintage";
export type Aspect = "16:9" | "9:16" | "1:1";

export type Scene = {
  id: string;
  text: string;
  duration: number;
  motion: Motion;
  /** The picture for this scene. Without one, an animated gradient is drawn. */
  image: HTMLImageElement | null;
  /** Kept so the picture can be regenerated with a new seed. */
  prompt: string | null;
  seed: number;
  /** Fallback gradient colors. */
  colors: [string, string];
  status: "ready" | "loading" | "error";
};

export type VideoSettings = {
  aspect: Aspect;
  captions: CaptionStyle;
  transition: Transition;
  effect: Effect;
  grade: Grade;
  letterbox: boolean;
};

export const SIZES: Record<Aspect, { width: number; height: number }> = {
  "16:9": { width: 1280, height: 720 },
  "9:16": { width: 720, height: 1280 },
  "1:1": { width: 1080, height: 1080 },
};

export const TRANSITION_SECONDS = 0.7;
