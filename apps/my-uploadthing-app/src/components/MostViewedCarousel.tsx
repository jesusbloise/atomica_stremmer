"use client";

import { useEffect, useState } from "react";

export default function MostViewedCarousel() {
  const [videos, setVideos] = useState<any[]>([]);

  useEffect(() => {
    fetch("/api/uploads/mas-vistos")
      .then((res) => res.json())
      .then((data) => setVideos(data))
      .catch(() => setVideos([]));
  }, []);

  if (!videos.length) return null;

  return (
    <div className="mt-12">
      <h2 className="text-xl font-semibold mb-4 text-white-300 flex items-center gap-2">
         Archivos más vistos
      </h2>
      <div className="relative w-full overflow-hidden">
        <div className="flex gap-4 animate-scroll" style={{ animation: "scrollX 30s linear infinite" }}>
          {videos.map((video) => (
            <div
              key={video.id}
              className="min-w-[180px] max-w-[180px] bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden shadow"
            >
              {video.tipo === "video" ? (
                <video
                  src={video.file_path}
                  className="w-full h-32 object-cover border-b border-zinc-700"
                  muted
                  loop
                  playsInline
                  autoPlay
                />
              ) : (
                <div className="h-32 bg-zinc-800 flex items-center justify-center text-zinc-400 text-xs text-center px-2">
                  {video.file_name}
                </div>
              )}
              <div className="text-xs p-2 text-white text-center truncate">
                {video.file_name}
              </div>
              <div className="text-center text-xs text-zinc-400 pb-2">
                 {video.views} vistas
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
