// src/app/videos/[id]/page.tsx
import AppShell from "@/components/layout/AppShell";
import Navbar from "@/components/layout/Navbar";
import Sidebar from "@/components/layout/Sidebar";
import Footer from "@/components/layout/Footer";
import VideoDetailPage from "@/components/VideoDetailPage";

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  return (
    <AppShell header={<Navbar />} sidebar={<Sidebar />} footer={<Footer />}>
      <VideoDetailPage id={id} />
    </AppShell>
  );
}



// // Página de detalle de video/documento.
// // - Recibe el ID desde la URL dinámica.
// // - Debe AWAIT a params (Next.js sync-dynamic-apis).
// import VideoDetailPage from "@/components/VideoDetailPage";

// export default async function Page(
//   props: { params: Promise<{ id: string }> }
// ) {
//   const { id } = await props.params; // 👈 importante: await
//   return <VideoDetailPage id={id} />;
// }
