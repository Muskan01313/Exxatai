import type { Metadata } from "next";
import { Studio } from "@/components/studio/Studio";

export const metadata: Metadata = {
  title: "Free Video Studio",
  description: "Make videos from text and pictures, free for everyone. No sign-up needed.",
};

export default function StudioPage() {
  return <Studio />;
}
