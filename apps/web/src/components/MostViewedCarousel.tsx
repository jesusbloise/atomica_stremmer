"use client";

import { useEffect, useState } from "react";

type Item = {
  id: string;
  url?: string;
  file_path?: string;
  file_name?: string;
  tipo?: string;
  views?: number;
};

const VIDEO_EXT = /\.(mp4|webm|mov|m4v|avi)$/i;

export default function MostViewedCarousel() {
  const [videos, setVideos] = useState<Item[]>([]);

  useEffect(() => {
    let cancel = false;

    fetch("/api/uploads/mas-vistos", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (!cancel) setVideos(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancel) setVideos([]);
      });

    return () => {
      cancel = true;
    };
  }, []);

  if (!videos.length) return null;

  return (
    <div className="mt-12">
      <h2 className="text-xl font-semibold mb-4 text-white flex items-center gap-2">
        Archivos más vistos
      </h2>

      <div className="relative w-full overflow-hidden">
        <div
          className="flex gap-4 animate-scroll"
          style={{ animation: "scrollX 30s linear infinite" }}
        >
          {videos.map((video) => {
            const rawUrl = video.url || video.file_path || "";
            const isVideo = video.tipo === "video" || VIDEO_EXT.test(rawUrl);

            return (
              <div
                key={video.id}
                className="min-w-[180px] max-w-[180px] bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden shadow"
              >
                {isVideo ? (
                  <div className="h-32 bg-zinc-800 flex items-center justify-center text-zinc-300 text-xs text-center px-2 border-b border-zinc-700">
                    Video
                  </div>
                ) : (
                  <div className="h-32 bg-zinc-800 flex items-center justify-center text-zinc-400 text-xs text-center px-2 border-b border-zinc-700">
                    {video.file_name || "Archivo"}
                  </div>
                )}

                <div className="text-xs p-2 text-white text-center truncate">
                  {video.file_name || "Sin nombre"}
                </div>

                <div className="text-center text-xs text-zinc-400 pb-2">
                  {video.views ?? 0} vistas
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}


// "use client";

// import { useEffect, useState } from "react";

// type Item = {
//   id: string;
//   url?: string;
//   file_path?: string;
//   file_name?: string;
//   tipo?: string;
//   views?: number;
// };

// const VIDEO_EXT = /\.(mp4|webm|mov|m4v|avi)$/i;

// function proxiedUrl(u?: string | null) {
//   if (!u) return "";
//   const s = String(u);

//   if (s.startsWith("/api/proxy?url=")) return s;

//   if (s.startsWith("gs://")) {
//     return `/api/proxy?url=${encodeURIComponent(s)}`;
//   }

//   if (s.startsWith("http://") || s.startsWith("https://")) {
//     return `/api/proxy?url=${encodeURIComponent(s)}`;
//   }

//   return s;
// }

// export default function MostViewedCarousel() {
//   const [videos, setVideos] = useState<Item[]>([]);

//   useEffect(() => {
//     fetch("/api/uploads/mas-vistos", { cache: "no-store" })
//       .then((res) => res.json())
//       .then((data) => setVideos(Array.isArray(data) ? data : []))
//       .catch(() => setVideos([]));
//   }, []);

//   if (!videos.length) return null;

//   return (
//     <div className="mt-12">
//       <h2 className="text-xl font-semibold mb-4 text-white-300 flex items-center gap-2">
//         Archivos más vistos
//       </h2>

//       <div className="relative w-full overflow-hidden">
//         <div
//           className="flex gap-4 animate-scroll"
//           style={{ animation: "scrollX 30s linear infinite" }}
//         >
//           {videos.map((video) => {
//             const rawUrl = video.url || video.file_path || "";
//             const safeUrl = proxiedUrl(rawUrl);
//             const isVideo = video.tipo === "video" || VIDEO_EXT.test(rawUrl);

//             return (
//               <div
//                 key={video.id}
//                 className="min-w-[180px] max-w-[180px] bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden shadow"
//               >
//                 {isVideo ? (
//                   <video
//                     src={safeUrl}
//                     className="w-full h-32 object-cover border-b border-zinc-700"
//                     muted
//                     loop
//                     playsInline
//                     autoPlay
//                     preload="metadata"
//                     onLoadedData={(e) => {
//                       e.currentTarget.play().catch(() => {});
//                     }}
//                   />
//                 ) : (
//                   <div className="h-32 bg-zinc-800 flex items-center justify-center text-zinc-400 text-xs text-center px-2">
//                     {video.file_name || "Archivo"}
//                   </div>
//                 )}

//                 <div className="text-xs p-2 text-white text-center truncate">
//                   {video.file_name || "Sin nombre"}
//                 </div>

//                 <div className="text-center text-xs text-zinc-400 pb-2">
//                   {video.views ?? 0} vistas
//                 </div>
//               </div>
//             );
//           })}
//         </div>
//       </div>
//     </div>
//   );
// }


