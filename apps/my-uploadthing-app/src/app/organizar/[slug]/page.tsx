// src/app/organizar/[slug]/page.tsx
import { Suspense } from "react";
import AppShell from "@/components/layout/AppShell";
import Navbar from "@/components/layout/Navbar";
import Sidebar from "@/components/layout/Sidebar";
import Footer from "@/components/layout/Footer";
import CategoryFiles from "@/components/CategoryFiles";

export default async function Page(props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params;

  return (
    <AppShell header={<Navbar />} sidebar={<Sidebar />} footer={<Footer />}>
      <Suspense fallback={<div className="p-4 text-zinc-400">Cargando…</div>}>
        <CategoryFiles slug={slug} />
      </Suspense>
    </AppShell>
  );
}

