import type { Metadata } from "next";
import { Instrument_Serif } from "next/font/google";
import { Studio } from "@/components/studio/Studio";

const display = Instrument_Serif({
  variable: "--font-display",
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Free Video Studio",
  description: "Make videos from text and pictures, free for everyone. No sign-up needed.",
};

export default function StudioPage() {
  return (
    <div className={display.variable}>
      <Studio />
    </div>
  );
}
