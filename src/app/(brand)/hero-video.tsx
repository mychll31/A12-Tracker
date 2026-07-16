"use client";

import { useEffect, useRef, useState } from "react";

/** Where the trailer's playback position is remembered between visits. */
const POSITION_KEY = "a12_hero_vid_t";

/**
 * The hero card: the looping trailer, its scrim, and the mute toggle.
 *
 * The copy is passed in from the page so it stays server-rendered; only the
 * video element and the toggle need to be interactive.
 */
export function HeroVideo({
  children,
  cta,
}: {
  children: React.ReactNode;
  cta: React.ReactNode;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);

  // Autoplay is only permitted while muted, so the video always starts muted and
  // the button is the only way sound is ever turned on.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    try {
      const stored = window.localStorage.getItem(POSITION_KEY);
      const seconds = stored === null ? NaN : Number.parseFloat(stored);
      if (Number.isFinite(seconds)) video.currentTime = seconds;
    } catch {
      // A blocked or full localStorage is not a reason to lose the hero.
    }

    const remember = () => {
      try {
        window.localStorage.setItem(POSITION_KEY, String(video.currentTime));
      } catch {
        // Ignored, for the same reason.
      }
    };

    video.addEventListener("timeupdate", remember);
    return () => video.removeEventListener("timeupdate", remember);
  }, []);

  function toggleMuted() {
    const video = videoRef.current;
    if (!video) return;

    const next = !video.muted;
    video.muted = next;
    setMuted(next);
    if (!next) void video.play().catch(() => {});
  }

  return (
    <div
      style={{
        position: "relative",
        borderRadius: 22,
        overflow: "hidden",
        border: "1px solid rgba(234,183,63,.28)",
        boxShadow: "0 40px 90px rgba(0,0,0,.6)",
      }}
    >
      <video
        ref={videoRef}
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        poster="/brand/a12-hero-poster.png"
        style={{
          width: "100%",
          display: "block",
          height: "clamp(420px,64vh,680px)",
          objectFit: "cover",
        }}
      >
        <source src="/brand/a12-hero.mp4" type="video/mp4" />
      </video>

      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, rgba(8,12,28,.35) 0%, rgba(8,12,28,.15) 45%, rgba(8,12,28,.92) 100%)",
        }}
      />

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          padding: "clamp(24px,5vw,56px)",
        }}
      >
        <div style={{ maxWidth: 640 }}>
          {children}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 14,
              alignItems: "center",
            }}
          >
            {cta}
            <button
              type="button"
              onClick={toggleMuted}
              aria-pressed={!muted}
              style={{
                border: "1px solid rgba(255,255,255,.25)",
                color: "var(--a12-text)",
                fontWeight: 600,
                fontSize: 14.5,
                padding: "14px 22px",
                borderRadius: 12,
                background: "rgba(8,12,28,.5)",
                backdropFilter: "blur(6px)",
                cursor: "pointer",
              }}
            >
              {muted ? "🔊 Unmute trailer" : "🔈 Mute trailer"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
