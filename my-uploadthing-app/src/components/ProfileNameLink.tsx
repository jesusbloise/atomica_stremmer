
"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

type Item = { user_id: string; name: string; email: string };

export default function ProfileNameLink({ name }: { name: string }) {
  const [rows, setRows] = useState<Item[] | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/perfiles?search=${encodeURIComponent(name)}`, { cache: "no-store" });
      const data = await res.json();
      setRows(Array.isArray(data) ? data : []);
    })();
  }, [name]);

  if (!rows) return <span className="underline decoration-dotted">{name}</span>;
  if (rows.length === 0) return <span>{name}</span>;
  if (rows.length === 1) {
    return <Link href={`/perfiles/${rows[0].user_id}`} className="text-orange-400 hover:text-orange-500 underline" scroll={false}>{name}</Link>;
  }
  return (
    <span className="text-orange-400">
      {name} <span className="text-xs text-zinc-400">(varios)</span>
      <ul className="mt-1">
        {rows.slice(0, 5).map((r) => (
          <li key={r.user_id}>
            <Link className="underline hover:text-orange-500 text-sm" href={`/perfiles/${r.user_id}`} scroll={false}>
              {r.name} — {r.email}
            </Link>
          </li>
        ))}
      </ul>
    </span>
  );
}

// // src/components/ProfileNameLink.tsx
// "use client";
// import { useEffect, useState } from "react";
// import Link from "next/link";

// type Item = { user_id: string; name: string; email: string };

// export default function ProfileNameLink({ name }: { name: string }) {
//   const [results, setResults] = useState<Item[] | null>(null);

//   useEffect(() => {
//     let ignore = false;
//     (async () => {
//       const res = await fetch(`/api/perfiles?search=${encodeURIComponent(name)}`, { cache: "no-store" });
//       const data = await res.json();
//       if (!ignore) setResults(Array.isArray(data) ? data : []);
//     })();
//     return () => { ignore = true; };
//   }, [name]);

//   if (!results) return <span className="underline decoration-dotted">{name}</span>;
//   if (results.length === 0) return <span>{name}</span>;
//   if (results.length === 1) {
//     return <Link href={`/perfiles/${results[0].user_id}`} className="text-orange-400 hover:text-orange-500 underline">{name}</Link>;
//   }
//   return (
//     <span className="text-orange-400">
//       {name} <span className="text-xs text-zinc-400">(varios)</span>
//       <ul className="mt-1">
//         {results.slice(0, 5).map((r) => (
//           <li key={r.user_id}>
//             <Link className="underline hover:text-orange-500 text-sm" href={`/perfiles/${r.user_id}`}>
//               {r.name} — {r.email}
//             </Link>
//           </li>
//         ))}
//       </ul>
//     </span>
//   );
// }
