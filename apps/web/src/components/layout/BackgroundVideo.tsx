"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

export default function BackgroundVideo() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    const video = videoRef.current;

    if (!video) return;

    video.muted = true;

    const ensurePlayback = () => {
      if (video.paused) {
        video.play().catch(() => {
          // El navegador puede bloquear temporalmente
          // el autoplay. Se volverá a intentar
          // en el próximo cambio de ruta o evento.
        });
      }
    };

    ensurePlayback();

    window.addEventListener("pageshow", ensurePlayback);
    document.addEventListener(
      "visibilitychange",
      ensurePlayback
    );

    return () => {
      window.removeEventListener(
        "pageshow",
        ensurePlayback
      );

      document.removeEventListener(
        "visibilitychange",
        ensurePlayback
      );
    };
  }, [pathname]);

  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-black"
      aria-hidden="true"
    >
      <video
        ref={videoRef}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        className="h-full w-full object-cover"
      >
        <source
          src="/video_de_fondo.mp4"
          type="video/mp4"
        />
      </video>

      <div className="absolute inset-0 bg-black/70" />
    </div>
  );
}