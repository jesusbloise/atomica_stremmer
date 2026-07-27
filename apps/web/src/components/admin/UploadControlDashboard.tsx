"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
    useMutation,
    useQuery,
    useQueryClient,
} from "@tanstack/react-query";
import {
    AlertCircle,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    CircleDashed,
    FileWarning,
    Loader2,
    Search,
    Trophy,
    UploadCloud,
    Users,
} from "lucide-react";

type FichaStatus =
    | "COMPLETE"
    | "INCOMPLETE"
    | "EMPTY"
    | "WITHOUT_FICHA";

type UploadItem = {
    id: string;
    fileName: string;
    uploadedAt: string;
    tipo: string | null;
    category: string | null;
    subcategory: string | null;
    createdById: string | null;

    uploadedBy: {
        id: string | null;
        name: string | null;
        email: string | null;
    };

    ficha: {
        exists: boolean;
        status: FichaStatus;
        completion: number;
        completedFields: number;
        totalFields: number;
        missingFields: string[];
    };
};

type RankingItem = {
    userId: string | null;
    name: string;
    email: string | null;
    uploads: number;
    complete: number;
    pending: number;
    compliance: number;
};
type ResponsibleUser = {
    id: string;
    name: string | null;
    email: string;
    role: string;
};

type ResponsibleUsersResponse = {
    rows: ResponsibleUser[];
    total: number;
};

type AssignResponsibleResponse = {
    ok: boolean;
    message: string;
    upload: {
        id: string;
        fileName: string;
        createdById: string | null;
        uploadedBy: {
            id: string;
            name: string | null;
            email: string;
        } | null;
    };
};
type ControlCargasResponse = {
    summary: {
        total: number;
        complete: number;
        incomplete: number;
        empty: number;
        withoutFicha: number;
        pending: number;
        averageCompletion: number;
        usersWithUploads: number;
    };

    filters: {
        search: string;
        userId: string;
        status: string;
    };

    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };

    ranking: RankingItem[];
    uploads: UploadItem[];
};

type StatusFilter =
    | "ALL"
    | "COMPLETE"
    | "INCOMPLETE"
    | "EMPTY"
    | "WITHOUT_FICHA";

const STATUS_LABELS: Record<FichaStatus, string> = {
    COMPLETE: "Completa",
    INCOMPLETE: "Incompleta",
    EMPTY: "Vacía",
    WITHOUT_FICHA: "Sin ficha",
};

const STATUS_CLASSES: Record<FichaStatus, string> = {
    COMPLETE: "border-green-500/30 bg-green-500/10 text-green-400",
    INCOMPLETE: "border-amber-500/30 bg-amber-500/10 text-amber-300",
    EMPTY: "border-red-500/30 bg-red-500/10 text-red-400",
    WITHOUT_FICHA: "border-zinc-600 bg-zinc-800 text-zinc-300",
};

async function fetchControlCargas({
    search,
    status,
    userId,
    page,
}: {
    search: string;
    status: StatusFilter;
    userId: string;
    page: number;
}) {
    const params = new URLSearchParams();

    if (search.trim()) {
        params.set("search", search.trim());
    }

    if (status !== "ALL") {
        params.set("status", status);
    }

    if (userId) {
        params.set("userId", userId);
    }

    params.set("page", String(page));
    params.set("limit", "20");

    const response = await fetch(
        `/api/admin/control-cargas?${params.toString()}`,
        {
            cache: "no-store",
        }
    );

    if (!response.ok) {
        const body = await response.json().catch(() => null);

        throw new Error(
            body?.error || "No se pudo cargar el control de cargas"
        );
    }

    return (await response.json()) as ControlCargasResponse;
}
async function fetchResponsibleUsers() {
    const response = await fetch(
        "/api/admin/control-cargas/responsables",
        {
            cache: "no-store",
        }
    );

    if (!response.ok) {
        const body = await response.json().catch(() => null);

        throw new Error(
            body?.error || "No se pudieron cargar los responsables"
        );
    }

    return (await response.json()) as ResponsibleUsersResponse;
}

async function assignResponsible({
    uploadId,
    userId,
}: {
    uploadId: string;
    userId: string | null;
}) {
    const response = await fetch(
        `/api/admin/control-cargas/${uploadId}/responsable`,
        {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ userId }),
        }
    );

    const body = (await response.json().catch(() => null)) as
        | AssignResponsibleResponse
        | { error?: string }
        | null;

    if (!response.ok) {
        throw new Error(
            body && "error" in body && body.error
                ? body.error
                : "No se pudo actualizar el responsable"
        );
    }

    return body as AssignResponsibleResponse;
}
function SummaryCard({
    title,
    value,
    description,
    icon,
}: {
    title: string;
    value: string | number;
    description: string;
    icon: React.ReactNode;
}) {
    return (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <p className="text-sm text-zinc-400">{title}</p>
                    <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
                    <p className="mt-1 text-xs text-zinc-500">{description}</p>
                </div>

                <div className="rounded-lg border border-zinc-700 bg-zinc-800 p-2 text-zinc-300">
                    {icon}
                </div>
            </div>
        </div>
    );
}

function ProgressBar({ value }: { value: number }) {
    const normalizedValue = Math.max(0, Math.min(100, value));

    let barClass = "bg-red-500";

    if (normalizedValue === 100) {
        barClass = "bg-green-500";
    } else if (normalizedValue >= 60) {
        barClass = "bg-amber-400";
    } else if (normalizedValue >= 30) {
        barClass = "bg-orange-500";
    }

    return (
        <div className="min-w-36">
            <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                <span className="text-zinc-400">Completitud</span>
                <span className="font-medium text-zinc-200">
                    {normalizedValue}%
                </span>
            </div>

            <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
                <div
                    className={`h-full rounded-full transition-all ${barClass}`}
                    style={{ width: `${normalizedValue}%` }}
                />
            </div>
        </div>
    );
}

function formatDate(value: string) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "Fecha desconocida";
    }

    return new Intl.DateTimeFormat("es-CL", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    }).format(date);
}

function getUserLabel(upload: UploadItem) {
    return (
        upload.uploadedBy.name ||
        upload.uploadedBy.email ||
        "Usuario desconocido"
    );
}

export default function UploadControlDashboard() {
    const queryClient = useQueryClient();
    const [assignmentError, setAssignmentError] = useState<string | null>(null);
    const [assignmentSuccess, setAssignmentSuccess] = useState<string | null>(null);
    const [searchInput, setSearchInput] = useState("");
    const [search, setSearch] = useState("");
    const [status, setStatus] = useState<StatusFilter>("ALL");
    const [userId, setUserId] = useState("");
    const [page, setPage] = useState(1);

    const { data, isLoading, isFetching, isError, error } = useQuery({
        queryKey: ["control-cargas", search, status, userId, page],
        queryFn: () =>
            fetchControlCargas({
                search,
                status,
                userId,
                page,
            }),
        staleTime: 10_000,
    });
    const {
        data: responsibleUsersData,
        isLoading: isLoadingResponsibleUsers,
        isError: isResponsibleUsersError,
    } = useQuery({
        queryKey: ["control-cargas-responsables"],
        queryFn: fetchResponsibleUsers,
        staleTime: 60_000,
    });

    const assignMutation = useMutation({
        mutationFn: assignResponsible,

        onMutate: () => {
            setAssignmentError(null);
            setAssignmentSuccess(null);
        },

        onSuccess: async (response) => {
            setAssignmentSuccess(response.message);

            await queryClient.invalidateQueries({
                queryKey: ["control-cargas"],
            });

            window.setTimeout(() => {
                setAssignmentSuccess(null);
            }, 3000);
        },

        onError: (mutationError) => {
            setAssignmentError(
                mutationError instanceof Error
                    ? mutationError.message
                    : "No se pudo actualizar el responsable"
            );
        },
    });
    const knownUsers = useMemo(() => {
        return (data?.ranking ?? []).filter(
            (user): user is RankingItem & { userId: string } =>
                Boolean(user.userId)
        );
    }, [data?.ranking]);

    function applySearch() {
        setPage(1);
        setSearch(searchInput.trim());
    }

    function clearFilters() {
        setSearchInput("");
        setSearch("");
        setStatus("ALL");
        setUserId("");
        setPage(1);
    }

    const summary = data?.summary;
    const uploads = data?.uploads ?? [];
    const ranking = data?.ranking ?? [];
    const responsibleUsers = responsibleUsersData?.rows ?? [];
    const pagination = data?.pagination;

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-white">
                        Control de cargas
                    </h1>

                    <p className="mt-1 max-w-3xl text-sm text-zinc-400">
                        Revisa quién subió cada archivo, el porcentaje de completitud de
                        su ficha técnica y los campos pendientes.
                    </p>
                </div>

                

                {isFetching && !isLoading && (
                    <div className="flex items-center gap-2 text-sm text-zinc-400">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Actualizando información...
                    </div>
                )}
            </div>

            {assignmentSuccess && (
                    <div className="rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-300">
                        {assignmentSuccess}
                    </div>
                )}

                {assignmentError && (
                    <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                        {assignmentError}
                    </div>
                )}

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                <SummaryCard
                    title="Archivos activos"
                    value={summary?.total ?? 0}
                    description="Total considerado en el control"
                    icon={<UploadCloud className="h-5 w-5" />}
                />

                <SummaryCard
                    title="Fichas completas"
                    value={summary?.complete ?? 0}
                    description="Con los 10 campos requeridos"
                    icon={<CheckCircle2 className="h-5 w-5" />}
                />

                <SummaryCard
                    title="Pendientes"
                    value={summary?.pending ?? 0}
                    description="Fichas incompletas o vacías"
                    icon={<FileWarning className="h-5 w-5" />}
                />

                <SummaryCard
                    title="Cumplimiento"
                    value={`${summary?.averageCompletion ?? 0}%`}
                    description="Promedio general de completitud"
                    icon={<CircleDashed className="h-5 w-5" />}
                />

                <SummaryCard
                    title="Usuarios identificados"
                    value={summary?.usersWithUploads ?? 0}
                    description="Responsables registrados"
                    icon={<Users className="h-5 w-5" />}
                />
            </div>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
                <section className="min-w-0 rounded-xl border border-zinc-800 bg-zinc-900">
                    <div className="border-b border-zinc-800 p-4">
                        <div className="flex flex-col gap-3">
                            <div className="flex flex-col gap-3 lg:flex-row">
                                <div className="flex min-w-0 flex-1 gap-2">
                                    <div className="relative min-w-0 flex-1">
                                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />

                                        <input
                                            value={searchInput}
                                            onChange={(event) =>
                                                setSearchInput(event.target.value)
                                            }
                                            onKeyDown={(event) => {
                                                if (event.key === "Enter") {
                                                    applySearch();
                                                }
                                            }}
                                            placeholder="Buscar archivo, usuario, categoría..."
                                            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 py-2 pl-9 pr-3 text-sm text-white outline-none transition focus:border-zinc-500"
                                        />
                                    </div>

                                    <button
                                        type="button"
                                        onClick={applySearch}
                                        className="rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-700"
                                    >
                                        Buscar
                                    </button>
                                </div>

                                <select
                                    value={status}
                                    onChange={(event) => {
                                        setStatus(event.target.value as StatusFilter);
                                        setPage(1);
                                    }}
                                    className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white outline-none focus:border-zinc-500"
                                >
                                    <option value="ALL">Todos los estados</option>
                                    <option value="COMPLETE">Completas</option>
                                    <option value="INCOMPLETE">Incompletas</option>
                                    <option value="EMPTY">Vacías</option>
                                    <option value="WITHOUT_FICHA">Sin ficha</option>
                                </select>

                                <select
                                    value={userId}
                                    onChange={(event) => {
                                        setUserId(event.target.value);
                                        setPage(1);
                                    }}
                                    className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white outline-none focus:border-zinc-500"
                                >
                                    <option value="">Todos los responsables</option>

                                    {knownUsers.map((user) => (
                                        <option key={user.userId} value={user.userId}>
                                            {user.name}
                                        </option>
                                    ))}
                                </select>

                                <button
                                    type="button"
                                    onClick={clearFilters}
                                    className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-400 transition hover:border-zinc-500 hover:text-white"
                                >
                                    Limpiar
                                </button>
                            </div>

                            <div className="text-xs text-zinc-500">
                                {pagination?.total ?? 0} archivo
                                {(pagination?.total ?? 0) !== 1 ? "s" : ""} encontrado
                                {(pagination?.total ?? 0) !== 1 ? "s" : ""}
                            </div>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="min-w-[1050px] w-full text-sm">
                            <thead>
                                <tr className="border-b border-zinc-800 text-left text-xs uppercase tracking-wide text-zinc-500">
                                    <th className="px-4 py-3">Archivo</th>
                                    <th className="px-4 py-3">Responsable</th>
                                    <th className="px-4 py-3">Categoría</th>
                                    <th className="px-4 py-3">Ficha</th>
                                    <th className="px-4 py-3">Campos pendientes</th>
                                    <th className="px-4 py-3">Fecha</th>
                                    <th className="px-4 py-3 text-right">Acción</th>
                                </tr>
                            </thead>

                            <tbody>
                                {isLoading && (
                                    <tr>
                                        <td colSpan={7} className="px-4 py-12">
                                            <div className="flex items-center justify-center gap-2 text-zinc-400">
                                                <Loader2 className="h-5 w-5 animate-spin" />
                                                Cargando control de cargas...
                                            </div>
                                        </td>
                                    </tr>
                                )}

                                {isError && !isLoading && (
                                    <tr>
                                        <td colSpan={7} className="px-4 py-12">
                                            <div className="flex items-center justify-center gap-2 text-red-400">
                                                <AlertCircle className="h-5 w-5" />
                                                {error instanceof Error
                                                    ? error.message
                                                    : "Error al cargar la información"}
                                            </div>
                                        </td>
                                    </tr>
                                )}

                                {!isLoading && !isError && uploads.length === 0 && (
                                    <tr>
                                        <td
                                            colSpan={7}
                                            className="px-4 py-12 text-center text-zinc-500"
                                        >
                                            No se encontraron archivos con estos filtros.
                                        </td>
                                    </tr>
                                )}

                                {uploads.map((upload) => (
                                    <tr
                                        key={upload.id}
                                        className="border-b border-zinc-800/80 align-top transition hover:bg-zinc-800/30"
                                    >
                                        <td className="max-w-72 px-4 py-4">
                                            <Link
                                                href={`/videos/${upload.id}`}
                                                className="font-medium text-white hover:underline"
                                            >
                                                {upload.fileName}
                                            </Link>

                                            <div className="mt-1 text-xs text-zinc-500">
                                                {upload.tipo || "Tipo desconocido"}
                                            </div>
                                        </td>

                                        <td className="min-w-64 px-4 py-4">
                                            <div
                                                className={
                                                    upload.createdById
                                                        ? "text-zinc-200"
                                                        : "text-zinc-500"
                                                }
                                            >
                                                {getUserLabel(upload)}
                                            </div>

                                            {upload.uploadedBy.email && (
                                                <div className="mt-1 text-xs text-zinc-500">
                                                    {upload.uploadedBy.email}
                                                </div>
                                            )}

                                            {!upload.createdById && (
                                                <div className="mt-1 text-xs text-amber-500/80">
                                                    Carga anterior al seguimiento
                                                </div>
                                            )}

                                            <div className="mt-3">
                                                <select
                                                    value={upload.createdById ?? ""}
                                                    disabled={
                                                        isLoadingResponsibleUsers ||
                                                        isResponsibleUsersError ||
                                                        assignMutation.isPending
                                                    }
                                                    onChange={(event) => {
                                                        const nextUserId = event.target.value || null;

                                                        assignMutation.mutate({
                                                            uploadId: upload.id,
                                                            userId: nextUserId,
                                                        });
                                                    }}
                                                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-2 py-2 text-xs text-zinc-200 outline-none transition focus:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-50"
                                                >
                                                    <option value="">
                                                        {isLoadingResponsibleUsers
                                                            ? "Cargando responsables..."
                                                            : "Sin responsable"}
                                                    </option>

                                                    {responsibleUsers.map((user) => (
                                                        <option key={user.id} value={user.id}>
                                                            {user.name?.trim() || user.email}
                                                            {user.name?.trim() ? ` — ${user.email}` : ""}
                                                        </option>
                                                    ))}
                                                </select>

                                                {assignMutation.isPending &&
                                                    assignMutation.variables?.uploadId === upload.id && (
                                                        <div className="mt-2 flex items-center gap-1 text-xs text-zinc-400">
                                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                            Guardando responsable...
                                                        </div>
                                                    )}

                                                {isResponsibleUsersError && (
                                                    <div className="mt-2 text-xs text-red-400">
                                                        No se pudo cargar la lista de usuarios.
                                                    </div>
                                                )}
                                            </div>
                                        </td>

                                        <td className="px-4 py-4">
                                            <div className="text-zinc-300">
                                                {upload.category || "Sin categoría"}
                                            </div>

                                            {upload.subcategory && (
                                                <div className="mt-1 text-xs text-zinc-500">
                                                    {upload.subcategory}
                                                </div>
                                            )}
                                        </td>

                                        <td className="px-4 py-4">
                                            <span
                                                className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${STATUS_CLASSES[upload.ficha.status]
                                                    }`}
                                            >
                                                {STATUS_LABELS[upload.ficha.status]}
                                            </span>

                                            <div className="mt-3">
                                                <ProgressBar value={upload.ficha.completion} />
                                            </div>

                                            <div className="mt-2 text-xs text-zinc-500">
                                                {upload.ficha.completedFields} de{" "}
                                                {upload.ficha.totalFields} campos
                                            </div>
                                        </td>

                                        <td className="max-w-80 px-4 py-4">
                                            {upload.ficha.missingFields.length === 0 ? (
                                                <span className="inline-flex items-center gap-1 text-green-400">
                                                    <CheckCircle2 className="h-4 w-4" />
                                                    Sin pendientes
                                                </span>
                                            ) : (
                                                <div className="flex flex-wrap gap-1.5">
                                                    {upload.ficha.missingFields.map((field) => (
                                                        <span
                                                            key={field}
                                                            className="rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-300"
                                                        >
                                                            {field}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </td>

                                        <td className="whitespace-nowrap px-4 py-4 text-xs text-zinc-400">
                                            {formatDate(upload.uploadedAt)}
                                        </td>

                                        <td className="px-4 py-4 text-right">
                                            <Link
                                                href={`/videos/${upload.id}`}
                                                className="inline-flex rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs font-medium text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-700"
                                            >
                                                Abrir ficha
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {pagination && (
                        <div className="flex flex-col gap-3 border-t border-zinc-800 p-4 sm:flex-row sm:items-center sm:justify-between">
                            <div className="text-sm text-zinc-500">
                                Página {pagination.page} de {pagination.totalPages}
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    disabled={pagination.page <= 1 || isFetching}
                                    onClick={() =>
                                        setPage((currentPage) =>
                                            Math.max(1, currentPage - 1)
                                        )
                                    }
                                    className="inline-flex items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 transition hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                    Anterior
                                </button>

                                <button
                                    type="button"
                                    disabled={
                                        pagination.page >= pagination.totalPages || isFetching
                                    }
                                    onClick={() =>
                                        setPage((currentPage) =>
                                            Math.min(
                                                pagination.totalPages,
                                                currentPage + 1
                                            )
                                        )
                                    }
                                    className="inline-flex items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 transition hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    Siguiente
                                    <ChevronRight className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    )}
                </section>

                <aside className="h-fit rounded-xl border border-zinc-800 bg-zinc-900">
                    <div className="flex items-center gap-2 border-b border-zinc-800 p-4">
                        <Trophy className="h-5 w-5 text-amber-400" />

                        <div>
                            <h2 className="font-medium text-white">
                                Ranking de cargas
                            </h2>
                            <p className="text-xs text-zinc-500">
                                Actividad y cumplimiento por usuario
                            </p>
                        </div>
                    </div>

                    <div className="divide-y divide-zinc-800">
                        {ranking.length === 0 && (
                            <div className="p-4 text-sm text-zinc-500">
                                Todavía no hay información de usuarios.
                            </div>
                        )}

                        {ranking.map((user, index) => (
                            <div
                                key={user.userId || `unknown-${index}`}
                                className="p-4"
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-zinc-700 bg-zinc-800 text-xs font-semibold text-zinc-300">
                                                {index + 1}
                                            </span>

                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-medium text-white">
                                                    {user.name}
                                                </p>

                                                {user.email && (
                                                    <p className="truncate text-xs text-zinc-500">
                                                        {user.email}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <span className="shrink-0 text-sm font-semibold text-white">
                                        {user.uploads}
                                    </span>
                                </div>

                                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                                    <div className="rounded-lg bg-zinc-800/80 p-2">
                                        <div className="text-sm font-semibold text-green-400">
                                            {user.complete}
                                        </div>
                                        <div className="text-[11px] text-zinc-500">
                                            Completas
                                        </div>
                                    </div>

                                    <div className="rounded-lg bg-zinc-800/80 p-2">
                                        <div className="text-sm font-semibold text-amber-400">
                                            {user.pending}
                                        </div>
                                        <div className="text-[11px] text-zinc-500">
                                            Pendientes
                                        </div>
                                    </div>

                                    <div className="rounded-lg bg-zinc-800/80 p-2">
                                        <div className="text-sm font-semibold text-zinc-200">
                                            {user.compliance}%
                                        </div>
                                        <div className="text-[11px] text-zinc-500">
                                            Calidad
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </aside>
            </div>
        </div>
    );
}