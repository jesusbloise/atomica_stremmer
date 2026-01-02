// /admin/usuarios/page.tsx
import { Suspense } from "react";
import AppShell from "@/components/layout/AppShell";
import Navbar from "@/components/layout/Navbar";
import Sidebar from "@/components/layout/Sidebar";
import Footer from "@/components/layout/Footer";
import UsersTable from "@/components/admin/UsersTable";

export default function Page() {
  return (
    <AppShell header={<Navbar />} sidebar={<Sidebar />} footer={<Footer />}>
      <Suspense fallback={<div className="p-4 text-zinc-400">Cargando…</div>}>
        <UsersTable />
      </Suspense>
    </AppShell>
  );
}
