"use client";

import { useEffect, useRef, useState } from "react";

/* A behind-the-scenes clip that holds still on its poster until asked.
   A mouse plays it while it is over the clip and pauses it on leaving;
   a tap or Enter plays and pauses it. Nothing past the poster loads until
   the first play (`preload="none"`), and a clip scrolled out of view
   pauses, so a played clip never runs on unseen. */

export function BtsClip({ src, label }: { src: string; label: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [on, setOn] = useState(false);

  const play = () => {
    const v = ref.current;
    if (!v) return;
    setOn(true);
    v.play().catch(() => setOn(false));
  };
  const pause = () => {
    ref.current?.pause();
    setOn(false);
  };

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting && !v.paused) pause();
    });
    io.observe(v);
    return () => io.disconnect();
  }, []);

  return (
    <button
      type="button"
      aria-label={`${on ? "Pause" : "Play"} ${label}`}
      aria-pressed={on}
      onPointerEnter={(e) => e.pointerType === "mouse" && play()}
      onPointerLeave={(e) => e.pointerType === "mouse" && pause()}
      onClick={(e) => {
        // A mouse already plays it on hover; its click is left alone so the
        // clip does not stop under the pointer that started it.
        if ((e.nativeEvent as PointerEvent).pointerType === "mouse") return;
        if (on) pause();
        else play();
      }}
      className="group absolute inset-0 block h-full w-full cursor-pointer"
    >
      <video
        ref={ref}
        src={src}
        poster={src.replace(/\.mp4$/, ".poster.jpg")}
        muted
        loop
        playsInline
        preload="none"
        aria-hidden="true"
        tabIndex={-1}
        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
      />
      <svg
        viewBox="0 0 12 12"
        aria-hidden="true"
        className={`pointer-events-none absolute bottom-3 left-3 size-3 fill-white drop-shadow-[0_1px_3px_rgb(0_0_0/0.55)] transition-opacity duration-300 ease-out ${
          on ? "opacity-0" : "opacity-90"
        }`}
      >
        <path d="M2.5 1.2v9.6L10.5 6z" />
      </svg>
    </button>
  );
}
