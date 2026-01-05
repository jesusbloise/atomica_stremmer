// import { NextResponse } from "next/server";

// const API = process.env.VIMEO_API_BASE ?? "https://api.vimeo.com";
// const TOKEN = process.env.VIMEO_ACCESS_TOKEN!;

// // GET /api/vimeo/list?page=1&per_page=12
// export async function GET(req: Request) {
//   if (!TOKEN) return NextResponse.json({ error: "No token" }, { status: 500 });

//   const { searchParams } = new URL(req.url);
//   const page = searchParams.get("page") ?? "1";
//   const per_page = searchParams.get("per_page") ?? "12";

//   const r = await fetch(`${API}/me/videos?page=${page}&per_page=${per_page}`, {
//     headers: {
//       Authorization: `Bearer ${TOKEN}`,
//       Accept: "application/vnd.vimeo.*+json;version=3.4",
//     },
//     cache: "no-store",
//   });

//   if (!r.ok) {
//     const t = await r.text();
//     return NextResponse.json({ error: "vimeo-list-failed", detail: t }, { status: r.status });
//   }

//   const d = await r.json();
//   // Normalizamos lo mínimo que vamos a usar en el front:
//   const items = (d?.data ?? []).map((v: any) => {
//     const uri: string = v?.uri || "";             // "/videos/123456789"
//     const id = uri.split("/").pop();
//     const name = v?.name ?? "";
//     const thumb = v?.pictures?.sizes?.at(-1)?.link ?? null;
//     const privacyView = v?.privacy?.view ?? "anybody";
//     return { id, uri, name, thumb, privacyView };
//   });

//   return NextResponse.json({
//     items,
//     paging: d?.paging ?? null,
//     total: d?.total ?? items.length,
//   });
// }
