import React from "react";

export default function TablaObjetos({ data }: { data: any[] }) {
  if (!data.length) return null;

  return (
    
    <div className="mt-6">
      <h2 className="font-bold mb-2 text-sm">Tabla de objetos detectados:</h2>
      <div className="border border-gray-300 overflow-hidden rounded">
        <table className="text-xs w-full text-left table-fixed border-collapse">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-2 py-1 w-[80px]">Frame</th>
              <th className="px-2 py-1 w-[100px]">Tiempo (s)</th>
              <th className="px-2 py-1">Objetos</th>
            </tr>
          </thead>
        </table>
        <div className="max-h-40 overflow-y-auto">
          <table className="text-xs w-full text-left table-fixed">
            <tbody>
              {data.map((obj, i) => (
                <tr key={i} className="border-t border-gray-200 table w-full table-fixed">
                  <td className="px-2 py-1 w-[80px]">{obj.frame}</td>
                  <td className="px-2 py-1 w-[100px]">{obj.time_sec}</td>
                  <td className="px-2 py-1">{obj.objects.join(", ") || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
