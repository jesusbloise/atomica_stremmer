"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

/* ---------- Switch bonito ---------- */
function Switch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        checked ? "bg-green-500/80" : "bg-zinc-600"
      }`}
      aria-pressed={checked}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
          checked ? "translate-x-5" : "translate-x-1"
        }`}
      />
    </button>
  );
}

/* ---------- Tipos ---------- */
type User = {
  id: string;
  name: string | null;
  email: string;
  role: "ADMIN" | "PROFESOR" | "ESTUDIANTE";
  is_active: boolean;
  created_at: string; // ISO
};

/* ---------- API calls ---------- */
async function fetchUsers(q: string, page: number) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  params.set("page", String(page));
  params.set("limit", "10");

  const res = await fetch(`/api/users?${params.toString()}`, { cache: "no-store" });
  if (!res.ok) throw new Error("No se pudieron cargar los usuarios");
  return (await res.json()) as { rows: User[]; total: number };
}

async function patchUser(
  id: string,
  data: Partial<Pick<User, "role" | "is_active">>
) {
  const res = await fetch(`/api/users/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("No se pudo actualizar");
  return (await res.json()) as User;
}

/* ---------- Labels visuales ---------- */
const ROLE_LABELS: Record<User["role"], string> = {
  ADMIN: "Admin",
  PROFESOR: "Profesor",
  ESTUDIANTE: "Estudiante",
};

/* ---------- Componente ---------- */
export default function UsersTable() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["users", q, page],
    queryFn: () => fetchUsers(q, page),
    staleTime: 10_000,
  });

  const mut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Pick<User, "role" | "is_active">> }) =>
      patchUser(id, data),
    onMutate: async ({ id, data }) => {
      await qc.cancelQueries({ queryKey: ["users"] });
      const prev = qc.getQueryData<any>(["users", q, page]);
      qc.setQueryData(["users", q, page], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          rows: old.rows.map((u: User) => (u.id === id ? { ...u, ...data } : u)),
        };
      });
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["users", q, page], ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
    },
  });

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / 10)), [total]);

  const fmt = new Intl.DateTimeFormat("es-CL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between mb-4">
        <input
          value={q}
          onChange={(e) => {
            setPage(1);
            setQ(e.target.value);
          }}
          placeholder="Buscar por nombre o email…"
          className="w-full sm:w-80 bg-zinc-800 border border-zinc-700 rounded px-3 py-2"
        />
        <span className="text-sm text-zinc-400">
          {total} usuario{total !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-zinc-400 border-b border-zinc-800">
              <th className="py-2 pr-4">Nombre</th>
              <th className="py-2 pr-4">Email</th>
              <th className="py-2 pr-4">Rol</th>
              <th className="py-2 pr-4">Estado</th>
              <th className="py-2 pr-4">Fecha</th>
              <th className="py-2 pr-4">Propietario</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td className="py-6 text-zinc-400" colSpan={6}>
                  Cargando usuarios…
                </td>
              </tr>
            )}
            {isError && !isLoading && (
              <tr>
                <td className="py-6 text-red-400" colSpan={6}>
                  Error al cargar usuarios.
                </td>
              </tr>
            )}

            {rows.map((u) => (
              <tr key={u.id} className="border-b border-zinc-800">
                <td className="py-2 pr-4">{u.name ?? "—"}</td>
                <td className="py-2 pr-4">{u.email}</td>

                {/* Rol: enviamos MAYÚSCULAS */}
                <td className="py-2 pr-4">
                  <select
                    value={u.role}
                    onChange={(e) =>
                      mut.mutate({
                        id: u.id,
                        data: { role: e.target.value as User["role"] },
                      })
                    }
                    className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1"
                  >
                    <option value="ADMIN">{ROLE_LABELS.ADMIN}</option>
                    <option value="PROFESOR">{ROLE_LABELS.PROFESOR}</option>
                    <option value="ESTUDIANTE">{ROLE_LABELS.ESTUDIANTE}</option>
                  </select>
                </td>

                {/* Estado */}
                <td className="py-2 pr-4">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={u.is_active}
                      onChange={(v) =>
                        mut.mutate({ id: u.id, data: { is_active: v } })
                      }
                    />
                    <span className={u.is_active ? "text-green-400" : "text-zinc-400"}>
                      {u.is_active ? "Activo" : "Inactivo"}
                    </span>
                  </div>
                </td>

                {/* Fecha */}
                <td className="py-2 pr-4 text-zinc-400">
                  {fmt.format(new Date(u.created_at))}
                </td>

                {/* Propietario (por ahora: avatar por email) */}
                <td className="py-2 pr-4">
                  <div className="flex items-center gap-2">
                    <img
                      src={`https://i.pravatar.cc/64?u=${u.email}`}
                      alt={u.name ?? u.email}
                      className="h-7 w-7 rounded-full border border-zinc-700 object-cover"
                    />
                    <span>{u.name ?? u.email}</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      <div className="flex items-center justify-between mt-4">
        <button
          className="px-3 py-1 rounded bg-zinc-800 border border-zinc-700 disabled:opacity-50"
          disabled={page <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
        >
          ← Anterior
        </button>

        <div className="text-sm text-zinc-400">Página {page} de {totalPages}</div>

        <button
          className="px-3 py-1 rounded bg-zinc-800 border border-zinc-700 disabled:opacity-50"
          disabled={page >= totalPages}
          onClick={() => setPage((p) => p + 1)}
        >
          Siguiente →
        </button>
      </div>
    </div>
  );
}

