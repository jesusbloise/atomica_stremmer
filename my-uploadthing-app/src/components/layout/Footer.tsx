export default function Footer() {
  const year = new Date().getFullYear();
  return (
  <footer className="border-t border-zinc-800 flex justify-end text-xs text-white-400 py-4">
  <div className="mr-6">
    © {year} Atomica — Todos los derechos reservados
  </div>
</footer>


    // <footer className="border-t border-zinc-800 text-center text-xs text-zinc-400 py-4">
    //   © {year} Atomica — Todos los derechos reservados
    // </footer>
  );
}
