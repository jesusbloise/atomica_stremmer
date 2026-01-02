// // src/components/layout/sidebarBus.ts
// type Payload = { type: "open" | "close" | "toggle" };
// const listeners = new Set<(p: Payload) => void>();

// export function sidebarSubscribe(cb: (p: Payload) => void): () => void {
//   listeners.add(cb);
//   // 👇 devolvemos void, no el boolean de Set.delete
//   return () => {
//     listeners.delete(cb);
//   };
// }

// export function sidebarOpen()   { listeners.forEach(l => l({ type: "open" })); }
// export function sidebarClose()  { listeners.forEach(l => l({ type: "close" })); }
// export function sidebarToggle() { listeners.forEach(l => l({ type: "toggle" })); }



// // src/components/layout/sidebarBus.ts
// type Payload = { type: "open" | "close" | "toggle" };
// const listeners = new Set<(p: Payload) => void>();

// export function sidebarSubscribe(cb: (p: Payload) => void) {
//   listeners.add(cb);
//   return () => listeners.delete(cb);
// }

// export function sidebarOpen()   { listeners.forEach(l => l({ type: "open" })); }
// export function sidebarClose()  { listeners.forEach(l => l({ type: "close" })); }
// export function sidebarToggle() { listeners.forEach(l => l({ type: "toggle" })); }
