"use client";

import * as React from "react";

const splashSeenKey = "desa-intro-splash.seen";
const maxSplashMs = 5200;
const reducedMotionMs = 1100;

export function IntroSplash() {
  const [visible, setVisible] = React.useState(false);
  const [leaving, setLeaving] = React.useState(false);
  const [reducedMotion, setReducedMotion] = React.useState(false);
  const videoRef = React.useRef<HTMLVideoElement | null>(null);

  const dismiss = React.useCallback(() => {
    setLeaving(true);
    window.setTimeout(() => setVisible(false), 420);
    window.sessionStorage.setItem(splashSeenKey, "true");
  }, []);

  React.useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const alreadySeen = window.sessionStorage.getItem(splashSeenKey) === "true";

    setReducedMotion(media.matches);

    if (alreadySeen) {
      return;
    }

    setVisible(true);

    const timeout = window.setTimeout(dismiss, media.matches ? reducedMotionMs : maxSplashMs);
    return () => window.clearTimeout(timeout);
  }, [dismiss]);

  React.useEffect(() => {
    if (!visible) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" || event.key === "Enter" || event.key === " ") {
        dismiss();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [dismiss, visible]);

  if (!visible) {
    return null;
  }

  return (
    <button
      type="button"
      aria-label="Skip intro"
      className={`fixed inset-0 z-[100] flex cursor-pointer items-center justify-center overflow-hidden bg-black transition-opacity duration-500 ${
        leaving ? "opacity-0" : "opacity-100"
      }`}
      onClick={dismiss}
    >
      <div className="absolute inset-0 bg-[linear-gradient(115deg,transparent,rgba(255,255,255,0.08),transparent)]" />
      {reducedMotion ? (
        <div className="text-center">
          <p className="text-5xl font-semibold uppercase tracking-[0.28em] text-white">DESA</p>
          <p className="mt-3 text-xs uppercase tracking-[0.45em] text-primary">Sprint Console</p>
        </div>
      ) : (
        <video
          ref={videoRef}
          src="/brand/desa-intro.mp4"
          autoPlay
          muted
          playsInline
          preload="auto"
          onEnded={dismiss}
          className="h-full w-full object-cover"
        />
      )}
      <div className="pointer-events-none absolute inset-x-0 bottom-8 flex justify-center">
        <span className="border border-white/12 bg-black/50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.28em] text-white/60 backdrop-blur">
          Tap to skip
        </span>
      </div>
    </button>
  );
}
