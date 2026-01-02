import React from "react";

export default function TablaEscenas({ data }: { data: any[] }) {
  if (!data.length) return null;

  return (
    <div className="mt-6">
      <h2 className="font-bold mb-2 text-sm">Tabla de escenas detectadas:</h2>
      <div className="border border-gray-300 overflow-hidden rounded">
        <table className="text-xs w-full text-left table-fixed border-collapse">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-2 py-1 w-[80px]"># Escena</th>
              <th className="px-2 py-1 w-[100px]">Inicio (s)</th>
              <th className="px-2 py-1 w-[100px]">Fin (s)</th>
              <th className="px-2 py-1 w-[100px]">Duración (s)</th>
            </tr>
          </thead>
        </table>
        <div className="max-h-40 overflow-y-auto">
          <table className="text-xs w-full text-left table-fixed">
            <tbody>
              {data.map((s, i) => (
                <tr key={i} className="border-t border-gray-200 table w-full table-fixed">
                  <td className="px-2 py-1 w-[80px]">{s.scene_index}</td>
                  <td className="px-2 py-1 w-[100px]">{Number(s.start_time).toFixed(2)}</td>
                  <td className="px-2 py-1 w-[100px]">{Number(s.end_time).toFixed(2)}</td>
                  <td className="px-2 py-1 w-[100px]">
                    {(Number(s.end_time) - Number(s.start_time)).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
