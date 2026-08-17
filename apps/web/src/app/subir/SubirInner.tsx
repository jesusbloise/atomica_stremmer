"use client";

import DropUploader from "./DropUploader";
import { useRouter } from "next/navigation";

export default function SubirInner() {
  const router = useRouter();

  return (
    <div className="w-full max-w-[1200px] mx-auto px-4 md:px-6 py-6 overflow-x-hidden">
      <h1 className="text-center text-3xl md:text-4xl font-bold mb-6">
        Subir archivos
      </h1>

      <div className="mx-auto w-full sm:max-w-xl md:max-w-2xl">
        <DropUploader
          onUploaded={({ category }) => {
            const safeCategory = category || "publicidad";
            router.push(`/organizar/${safeCategory}`);
          }}
        />
      </div>
    </div>
  );
}