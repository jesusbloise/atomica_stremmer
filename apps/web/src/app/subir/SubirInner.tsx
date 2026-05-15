"use client";

import DropUploader from "./DropUploader";
import LastVideosCarousel from "@/components/LastVideosCarousel";
import { useRouter } from "next/navigation";

export default function SubirInner() {
  const router = useRouter();
  console.log("✅ SUBIRINNER ACTIVO");

  return (
    <div className="w-full max-w-[1200px] mx-auto px-4 md:px-6 py-6 overflow-x-hidden">
      <h1 className="text-center text-3xl md:text-4xl font-bold mb-6">
        Subir archivos
      </h1>

      <div className="mx-auto w-full sm:max-w-xl md:max-w-2xl">
        <DropUploader
          onUploaded={(id) => {
            // ✅ usa la categoría que ya guardas en localStorage desde DropUploader
            const cat =
              (typeof window !== "undefined" &&
                (localStorage.getItem("uploadCategoryV3") || "")) ||
              "";

            // fallback por si algo raro pasa
            const safeCat = cat || "publicidad";

            // ✅ redirige a la categoría seleccionada
            router.push(`/organizar/${safeCat}`);

            // Si prefieres ir directo al detalle, usa esto en vez del push anterior:
            // if (id) router.push(`/videos/${id}`);
          }}
        />
      </div>

    </div>
  );
}

