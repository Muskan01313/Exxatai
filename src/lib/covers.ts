import type { CSSProperties } from "react";

export const COVER_PRESETS: { key: string; label: string; background: string }[] = [
  { key: "red", label: "Red", background: "#e16259" },
  { key: "yellow", label: "Yellow", background: "#dfab01" },
  { key: "blue", label: "Blue", background: "#337ea9" },
  { key: "green", label: "Green", background: "#4dab9a" },
  { key: "purple", label: "Purple", background: "#9065b0" },
  { key: "gray", label: "Gray", background: "#9b9a97" },
  { key: "sunrise", label: "Sunrise", background: "linear-gradient(135deg, #f6d365 0%, #fda085 100%)" },
  { key: "ocean", label: "Ocean", background: "linear-gradient(135deg, #89f7fe 0%, #66a6ff 100%)" },
  { key: "mint", label: "Mint", background: "linear-gradient(135deg, #d4fc79 0%, #96e6a1 100%)" },
  { key: "dusk", label: "Dusk", background: "linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)" },
  { key: "peach", label: "Peach", background: "linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)" },
  { key: "night", label: "Night", background: "linear-gradient(135deg, #30cfd0 0%, #330867 100%)" },
];

export function coverStyle(cover: string): CSSProperties {
  if (cover.startsWith("preset:")) {
    const preset = COVER_PRESETS.find((p) => `preset:${p.key}` === cover);
    return { background: preset?.background ?? COVER_PRESETS[0].background };
  }
  return {
    backgroundImage: `url(${JSON.stringify(cover)})`,
    backgroundSize: "cover",
    backgroundPosition: "center",
  };
}

export function randomCover(): string {
  return `preset:${COVER_PRESETS[Math.floor(Math.random() * COVER_PRESETS.length)].key}`;
}
