import type { Metadata } from "next";
import { Cinzel, Inter } from "next/font/google";

import "./brand.css";

const cinzel = Cinzel({
  variable: "--font-cinzel",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Abundance 12 — The Game of My Life",
  description:
    "Your goals, your daily disciplines, your nightly reckoning — forged into one score that proves you showed up.",
};

/**
 * The Abundance 12 brand shell: the landing page and the onboarding wizard.
 *
 * This is deliberately NOT the application's chrome. The app is violet on slate
 * and obeys the user's light/dark toggle; the brand is navy and gold, and is
 * always dark. Scoping the palette to `.a12` stops the two bleeding into each
 * other — nothing here reads the app's tokens, and the theme toggle cannot
 * repaint it.
 */
export default function BrandLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={`a12 ${cinzel.variable} ${inter.variable}`}>{children}</div>
  );
}
