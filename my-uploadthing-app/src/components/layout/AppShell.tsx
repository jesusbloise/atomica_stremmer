"use client";

import { useEffect, useState } from "react";
import SidebarDrawer from "./SidebarDrawer";
// import { sidebarSubscribe } from "./sidebarBus";
import Sidebar, { SidebarContent } from "./Sidebar";

type Props = {
  header?: React.ReactNode;
  sidebar?: React.ReactNode;  // si pasas uno custom, debe ser también flotante/fixed
  footer?: React.ReactNode;
  containerClassName?: string;
  children: React.ReactNode;
};

export default function AppShell({
  header,
  sidebar,
  footer,
  containerClassName,
  children,
}: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  // useEffect(() => {
  //   const unsub = sidebarSubscribe((p) => {
  //     if (p.type === "open") setDrawerOpen(true);
  //     else if (p.type === "close") setDrawerOpen(false);
  //     else if (p.type === "toggle") setDrawerOpen((v) => !v);
  //   });
  //   return unsub;
  // }, []);

  return (
    <div className="min-h-dvh bg-black text-white overflow-x-hidden">
      {header}

      {/* 👉 Sidebar flotante superpuesto (NO reserva columna) */}
      {sidebar ?? <Sidebar />}

      {/* Contenido centrado sin columna de sidebar */}
      <div className={`w-full max-w-[1600px] mx-auto px-4 md:px-6 pt-4 md:pt-6 ${containerClassName ?? ""}`}>
        <main>{children}</main>
      </div>

      {/* Drawer móvil: usa SOLO el contenido del menú */}
      <SidebarDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)}>
        <SidebarContent />
      </SidebarDrawer>

      {footer}
    </div>
  );
}


