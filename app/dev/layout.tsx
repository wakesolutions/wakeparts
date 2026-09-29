import type { Metadata } from "next";
import type { ReactNode } from "react";

/** Sandbox de desarrollo: nunca se indexa. */
export const metadata: Metadata = { title: "Sandbox", robots: { index: false, follow: false } };

export default function LayoutDev({ children }: { children: ReactNode }) {
  return children;
}
