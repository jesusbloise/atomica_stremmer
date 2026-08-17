"use client";

import { useEffect, useMemo, useState } from "react";

type AccessLevel =
  | "VIEWER"
  | "APPROVER"
  | "EDITOR";

type PermissionUser = {
  permissionId: string;
  userId: string;
  name: string | null;
  email: string | null;
  accessLevel: AccessLevel;
};

type PermissionGroup = {
  permissionId: string;
  groupId: string;
  name: string;
  color: string | null;
  memberCount: number;
  accessLevel: AccessLevel;
};

type PermissionsResponse = {
  visibility: "PUBLIC" | "RESTRICTED";
  canManage: boolean;
  users: PermissionUser[];
  groups: PermissionGroup[];
  total: number;
};

type Props = {
  uploadId: string;
};

function accessLabel(
  accessLevel: AccessLevel
) {
  switch (accessLevel) {
    case "APPROVER":
      return "Puede aprobar";

    case "EDITOR":
      return "Puede editar";

    case "VIEWER":
    default:
      return "Puede ver";
  }
}

export default function UploadPermissionsPanel({
  uploadId,
}: Props) {
  const [data, setData] =
    useState<PermissionsResponse | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  useEffect(() => {
    let active = true;

    async function loadPermissions() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(
          `/api/uploads/${uploadId}/permissions`,
          {
            method: "GET",
            cache: "no-store",
          }
        );

        const result =
          await response
            .json()
            .catch(() => ({}));

        if (!response.ok) {
          throw new Error(
            result?.error ||
              "No se pudieron cargar los permisos"
          );
        }

        if (!active) {
          return;
        }

        setData(
          result as PermissionsResponse
        );
      } catch (loadError: any) {
        if (!active) {
          return;
        }

        setError(
          loadError?.message ||
            "No se pudieron cargar los permisos"
        );

        setData(null);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadPermissions();

    return () => {
      active = false;
    };
  }, [uploadId]);

  const hasUsers =
    Boolean(data?.users?.length);

  const hasGroups =
    Boolean(data?.groups?.length);

  const hasAssignments =
    hasUsers || hasGroups;

  const totalAssignments =
    useMemo(() => {
      if (!data) {
        return 0;
      }

      return (
        data.users.length +
        data.groups.length
      );
    }, [data]);

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">
            Acceso al archivo
          </h3>

          <p className="mt-1 text-sm text-zinc-400">
            Personas y grupos con permiso
            para visualizar este archivo.
          </p>
        </div>

        {!loading && data && (
          <div
            className={[
              "inline-flex w-fit items-center rounded-full border px-3 py-1 text-xs font-semibold",
              data.visibility ===
              "PUBLIC"
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                : "border-orange-500/40 bg-orange-500/10 text-orange-300",
            ].join(" ")}
          >
            {data.visibility === "PUBLIC"
              ? "Público"
              : "Restringido"}
          </div>
        )}
      </div>

      {loading ? (
        <div className="mt-5 space-y-3">
          <div className="h-16 animate-pulse rounded-xl bg-zinc-900" />
          <div className="h-16 animate-pulse rounded-xl bg-zinc-900" />
        </div>
      ) : error ? (
        <div className="mt-5 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
          {error}
        </div>
      ) : !data ? null : data.visibility ===
        "PUBLIC" ? (
        <div className="mt-5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
          <p className="text-sm font-medium text-emerald-300">
            Este archivo es público.
          </p>

          <p className="mt-1 text-sm leading-6 text-zinc-400">
            Todos los usuarios autorizados
            de la plataforma pueden verlo.
          </p>
        </div>
      ) : !hasAssignments ? (
        <div className="mt-5 rounded-xl border border-zinc-800 bg-black/20 p-4 text-sm text-zinc-400">
          Este archivo está restringido,
          pero actualmente no tiene
          personas ni grupos asignados.
        </div>
      ) : (
        <div className="mt-5 space-y-5">
          <div className="flex flex-wrap gap-2 text-xs text-zinc-400">
            <span className="rounded-full border border-zinc-800 bg-black/30 px-3 py-1">
              {totalAssignments} permiso
              {totalAssignments !== 1
                ? "s"
                : ""}
            </span>

            {hasUsers && (
              <span className="rounded-full border border-zinc-800 bg-black/30 px-3 py-1">
                {data.users.length} persona
                {data.users.length !== 1
                  ? "s"
                  : ""}
              </span>
            )}

            {hasGroups && (
              <span className="rounded-full border border-zinc-800 bg-black/30 px-3 py-1">
                {data.groups.length} grupo
                {data.groups.length !== 1
                  ? "s"
                  : ""}
              </span>
            )}
          </div>

          {hasUsers && (
            <div>
              <h4 className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                Personas
              </h4>

              <div className="space-y-2">
                {data.users.map((user) => (
                  <div
                    key={user.permissionId}
                    className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-black/25 p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-white">
                        {user.name ||
                          "Usuario sin nombre"}
                      </p>

                      <p className="truncate text-xs text-zinc-500">
                        {user.email ||
                          "Sin correo"}
                      </p>
                    </div>

                    <span className="w-fit rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-xs text-zinc-300">
                      {accessLabel(
                        user.accessLevel
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {hasGroups && (
            <div>
              <h4 className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                Grupos
              </h4>

              <div className="space-y-2">
                {data.groups.map((group) => (
                  <div
                    key={group.permissionId}
                    className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-black/25 p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className="h-3 w-3 shrink-0 rounded-full border border-white/10"
                        style={{
                          backgroundColor:
                            group.color ||
                            "#f97316",
                        }}
                      />

                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-white">
                          {group.name}
                        </p>

                        <p className="text-xs text-zinc-500">
                          {group.memberCount}{" "}
                          miembro
                          {group.memberCount !==
                          1
                            ? "s"
                            : ""}
                        </p>
                      </div>
                    </div>

                    <span className="w-fit rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-xs text-zinc-300">
                      {accessLabel(
                        group.accessLevel
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}