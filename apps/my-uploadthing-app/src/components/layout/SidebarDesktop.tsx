// "use client";

// import Link from "next/link";

// function Item({ href, children }: { href: string; children: React.ReactNode }) {
//   return (
//     <Link
//       href={href}
//       className="block w-full text-left rounded-xl px-3 py-2 border border-zinc-700 hover:border-zinc-500 hover:bg-zinc-900/50 text-sm"
//     >
//       {children}
//     </Link>
//   );
// }

// export default function SidebarDesktop() {
//   return (
//     <aside className="hidden md:block sticky top-20 space-y-4 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 w-64">
//       <div>
//         <div className="text-xs uppercase text-zinc-400 px-1 mb-2">Usuarios</div>
//         <div className="space-y-2">
//           <Item href="/usuarios/pendientes">Usuarios pendientes</Item>
//           <Item href="/">Archivos subidos</Item>
//           <Item href="/resumen">Resumen general</Item>
//           <Item href="/resumen-2">Resumen general</Item>
//         </div>
//       </div>

//       <div>
//         <div className="text-xs uppercase text-zinc-400 px-1 mb-2">Configuración</div>
//         <div className="space-y-2">
//           <Item href="/config/permiso">Cambiar permisos</Item>
//           <Item href="/config/roles">Crear Roles Nuevos</Item>
//           <Item href="/config/link">Crear link Institucional</Item>
//         </div>
//       </div>

//       <div className="pt-2 flex items-center gap-3 px-1 text-zinc-300">
//         <span className="i-lucide-instagram h-5 w-5" />
//         <span className="i-lucide-facebook h-5 w-5" />
//         <span className="i-lucide-message-circle h-5 w-5" />
//       </div>
//     </aside>
//   );
// }
