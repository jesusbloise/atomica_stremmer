"use client";

import DropUploader from "./DropUploader";
import LastVideosCarousel from "@/components/LastVideosCarousel";
import { useRouter } from "next/navigation";

export default function SubirInner() {
  const router = useRouter();

  return (
    // contenedor centrado + sin overflow horizontal
    <div className="w-full max-w-[1200px] mx-auto px-4 md:px-6 py-6 overflow-x-hidden">
      <h1 className="text-center text-3xl md:text-4xl font-bold mb-6">
        Subir archivos
      </h1>

      {/* limita el ancho del dropper desde el padre */}
      <div className="mx-auto w-full sm:max-w-xl md:max-w-2xl">
        <DropUploader onUploaded={() => router.push("/")} />
      </div>

      {/* carrusel en un contenedor con overflow-x-auto */}
      <section className="mt-10">
   
        {/* Rompen mucho los hijos con w-screen; forzamos scroll-x aqui */}
        <div className="-mx-4 md:mx-0 px-4">
          <div className="overflow-x-auto">
            <LastVideosCarousel title="Últimos agregados" limit={10} />
          </div>
        </div>
      </section>
    </div>
  );
}


// "use client";

// import DropUploader from "./DropUploader";
// import LastVideosCarousel from "@/components/LastVideosCarousel";
// import { useRouter } from "next/navigation";

// export default function SubirInner() {
//   const router = useRouter();

//   return (
//     <div className="px-4 md:px-8">
//       <h1 className="text-center text-3xl font-bold mb-6">Subir archivos</h1>

//       {/* 👉 Si hay id vamos al detalle; si no, al listado (Home) */}
      
//       <DropUploader onUploaded={() => router.push("/")} />

//       {/* <DropUploader
//         onUploaded={(id) => {
//           if (id) router.push(`/videos/${id}`);
//           else router.push("/"); // tu listado UploadVideo vive en "/"
//         }}
//       /> */}

//       <div className="max-w-6xl mx-auto">
//         <LastVideosCarousel title="Últimos agregados" limit={10} />
//       </div>
//     </div>
//   );
// }
