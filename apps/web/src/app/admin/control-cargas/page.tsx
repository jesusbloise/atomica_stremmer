import { Suspense } from "react";
import AppShell from "@/components/layout/AppShell";
import Navbar from "@/components/layout/Navbar";
import Sidebar from "@/components/layout/Sidebar";
import Footer from "@/components/layout/Footer";
import UploadControlDashboard from "@/components/admin/UploadControlDashboard";

export default function ControlCargasPage() {
  return (
    <AppShell header={<Navbar />} sidebar={<Sidebar />} footer={<Footer />}>
      <Suspense
        fallback={
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 text-zinc-400">
            Cargando control de cargas...
          </div>
        }
      >
        <UploadControlDashboard />
      </Suspense>
    </AppShell>
  );
}