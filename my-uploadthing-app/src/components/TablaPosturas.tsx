import React, { useState } from "react";

export default function TablaPosturas({ data }: { data: any[] }) {
  const [page, setPage] = useState(1);
  const rowsPerPage = 25;
  const totalPages = Math.ceil(data.length / rowsPerPage);
  const start = (page - 1) * rowsPerPage;
  const end = start + rowsPerPage;
  const pageData = data.slice(start, end);

  if (!data.length) return null;

  return (
    <div className="mt-6">
      <h2 className="font-bold mb-2 text-sm">Tabla de posturas detectadas:</h2>
      <div className="border border-gray-300 overflow-hidden rounded">
        <table className="text-xs w-full text-left table-fixed border-collapse">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-2 py-1 w-[60px]">Frame</th>
              <th className="px-2 py-1 w-[100px]">Tiempo (s)</th>
              <th className="px-2 py-1 w-[80px]">Rostro</th>
              <th className="px-2 py-1">Img frame</th>
            </tr>
          </thead>
        </table>
        <div className="max-h-60 overflow-y-auto">
          <table className="text-xs w-full text-left table-fixed">
            <tbody>
              {pageData.map((p, i) => (
                <tr key={i} className="border-t border-gray-200 table w-full table-fixed">
                  <td className="px-2 py-1 w-[60px]">{p.frame}</td>
                  <td className="px-2 py-1 w-[100px]">{p.time_sec}</td>
                  <td className="px-2 py-1 w-[80px]">
                    {p.rostro_detectado ? "Sí" : "No"}
                  </td>
                  <td className="px-2 py-1">
                    <img
                      src={`/api/frames/${p.video_id}/${p.frame}`}
                      alt="frame"
                      className="w-16 h-auto rounded shadow"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Paginador */}
        {totalPages > 1 && (
          <div className="flex justify-center gap-4 py-2 text-xs">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-2 py-1 bg-gray-100 rounded disabled:opacity-50"
            >
              ← Anterior
            </button>
            <span className="px-2 py-1">Página {page} de {totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-2 py-1 bg-gray-100 rounded disabled:opacity-50"
            >
              Siguiente →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

