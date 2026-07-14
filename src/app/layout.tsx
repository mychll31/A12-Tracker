import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { ToastProvider } from "@/components/ui/toast";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Abundance Hub",
    template: "%s · Abundance Hub",
  },
  description:
    "Coaching, accountability and measurable growth — goals, daily disciplines, and the scores that prove you showed up.",
};

/**
 * The server cannot know which theme the visitor picked, so it cannot render the
 * right one. This runs before first paint, reads the stored preference and
 * stamps the class on <html>. Without it, every load would flash the wrong theme
 * until React hydrated and corrected it.
 */
const THEME_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem('ah-theme');
    var system = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var dark = stored === 'dark' || ((!stored || stored === 'system') && system);
    document.documentElement.classList.toggle('dark', dark);
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col bg-surface text-foreground">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
