// "use client";

// import { useEffect, useState } from "react";
// import VimeoPlayer from "./VimeoPlayer";

// type Item = { id: string; name: string; thumb: string | null; privacyView: string; };

// export default function VimeoGallery() {
//   const [items, setItems] = useState<Item[]>([]);
//   const [active, setActive] = useState<Item | null>(null);

//   useEffect(() => {
//     (async () => {
//       const r = await fetch("/api/vimeo/list?per_page=12", { cache: "no-store" });
//       const d = await r.json();
//       setItems(d.items || []);
//     })();
//   }, []);

//   return (
//     <div className="grid gap-4">
//       {active && (
//         <div className="mb-4">
//           <h3 className="text-sm font-semibold mb-2">{active.name}</h3>
//           <VimeoPlayer vimeoId={active.id} />
//         </div>
//       )}
//       <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
//         {items.map(v => (
//           <button
//             key={v.id}
//             onClick={() => setActive(v)}
//             className="text-left bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden hover:border-zinc-600"
//           >
//             <div className="aspect-video bg-black">
//               {v.thumb ? <img src={v.thumb} alt={v.name} className="w-full h-full object-cover" /> : null}
//             </div>
//             <div className="p-2">
//               <div className="text-xs font-medium line-clamp-2">{v.name}</div>
//               <div className="text-[10px] opacity-60">privacidad: {v.privacyView}</div>
//             </div>
//           </button>
//         ))}
//       </div>
//     </div>
//   );
// }
