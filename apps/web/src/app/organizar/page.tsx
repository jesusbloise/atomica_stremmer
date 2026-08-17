// src/app/organizar/page.tsx

import { Suspense } from "react";
import AppShell from "@/components/layout/AppShell";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import LandingCategories from "@/components/LandingCategories";

export default function Page() {
  return (
    <AppShell header={<Navbar />} footer={<Footer />}>
      <Suspense
        fallback={
          <div className="p-4 text-zinc-400">
            Cargando…
          </div>
        }
      >
        <LandingCategories />
      </Suspense>
    </AppShell>
  );
}