"use client";

import { useEffect, useState } from "react";

type Item = {
  id: string;
  url: string;
  file_name?: string;
  tipo?: string;
  views?: number;
};

const VIDEO_EXT = /\.(mp4|webm|mov|m4v|avi)$/i;

export default function LastVideosCarousel({
  title = "Últimos archivos agregados",
  limit = 10,
}: {
  title?: string;
  limit?: number;
}) {
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    let cancel = false;

    (async () => {
      try {
        const res = await fetch("/api/videos", { cache: "no-store" });
        if (!res.ok) return;

        const data = await res.json();

        if (!cancel && Array.isArray(data)) {
          const list = data.filter((v: any) => !!v?.url).slice(0, limit);
          setItems(list);
        }
      } catch {
        if (!cancel) setItems([]);
      }
    })();

    return () => {
      cancel = true;
    };
  }, [limit]);

  if (!items.length) return null;

  return (
    <div className="mt-12">
      <h2 className="text-xl font-semibold mb-4 text-white flex items-center gap-2">
        {title}
      </h2>

      <div className="relative w-full overflow-hidden">
        <div
          className="flex gap-4 animate-scroll"
          style={{ animation: "scrollX 30s linear infinite" }}
        >
          {items.map((item) => {
            const isVideo =
              item.tipo === "video" || VIDEO_EXT.test(item.url || "");

            return (
              <div
                key={item.id}
                className="min-w-[180px] max-w-[180px] bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden shadow"
              >
                {isVideo ? (
                  <div className="h-32 bg-zinc-800 flex items-center justify-center text-zinc-300 text-xs text-center px-2 border-b border-zinc-700">
                    Video
                  </div>
                ) : (
                  <div className="h-32 bg-zinc-800 flex items-center justify-center text-zinc-400 text-xs text-center px-2 border-b border-zinc-700">
                    {item.file_name || "Archivo"}
                  </div>
                )}

                <div className="text-xs p-2 text-white text-center truncate">
                  {item.file_name || "Sin nombre"}
                </div>

                {typeof item.views === "number" && (
                  <div className="text-center text-xs text-zinc-400 pb-2">
                    {item.views} vistas
                  </div>
                )}
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
//   url: string;
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

//   // signed/public URL => directo
//   if (s.startsWith("http://") || s.startsWith("https://")) {
//     return s;
//   }

//   return s;
// }

// export default function LastVideosCarousel({
//   title = "Últimos archivos agregados",
//   limit = 10,
// }: { title?: string; limit?: number }) {
//   const [items, setItems] = useState<Item[]>([]);

//   useEffect(() => {
//     let cancel = false;

//     (async () => {
//       try {
//         const res = await fetch("/api/videos", { cache: "no-store" });
//         if (!res.ok) return;

//         const data = await res.json();
//         if (!cancel && Array.isArray(data)) {
//           const list = data.filter((v: any) => !!v?.url).slice(0, limit);
//           setItems(list);
//         }
//       } catch {}
//     })();

//     return () => {
//       cancel = true;
//     };
//   }, [limit]);

//   if (!items.length) return null;

//   return (
//     <div className="mt-12">
//       <h2 className="text-xl font-semibold mb-4 text-white-300 flex items-center gap-2">
//         {title}
//       </h2>

//       <div className="relative w-full overflow-hidden">
//         <div
//           className="flex gap-4 animate-scroll"
//           style={{ animation: "scrollX 30s linear infinite" }}
//         >
//           {items.map((item) => {
//             const safeUrl = proxiedUrl(item.url);
//             const isVideo = item.tipo === "video" || VIDEO_EXT.test(item.url || "");

//             return (
//               <div
//                 key={item.id}
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
//                     {item.file_name || "Archivo"}
//                   </div>
//                 )}

//                 <div className="text-xs p-2 text-white text-center truncate">
//                   {item.file_name || "Sin nombre"}
//                 </div>

//                 {typeof item.views === "number" && (
//                   <div className="text-center text-xs text-zinc-400 pb-2">
//                     {item.views} vistas
//                   </div>
//                 )}
//               </div>
//             );
//           })}
//         </div>
//       </div>
//     </div>
//   );
// }

