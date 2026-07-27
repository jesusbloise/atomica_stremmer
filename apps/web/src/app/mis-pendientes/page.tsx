"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  FileWarning,
  Loader2,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import AppShell from "@/components/layout/AppShell";
import Navbar from "@/components/layout/Navbar";
import Sidebar from "@/components/layout/Sidebar";
import Footer from "@/components/layout/Footer";

type PendingStatus = "INCOMPLETE" | "EMPTY" | "WITHOUT_FICHA";

type PendingUpload = {
  id: string;
  fileName: string;
  uploadedAt: string;
  tipo: string | null;
  category: string | null;
  subcategory: string | null;
  ficha: {
    exists: boolean;
    status: PendingStatus;
    completion: number;
    completedFields: number;
    totalFields: number;
    missingFields: string[];
  };
};

type PendingUploadsResponse = {
  total: number;
  summary: {
    incomplete: number;
    empty: number;
    withoutFicha: number;
  };
  uploads: PendingUpload[];
};

async function fetchPendingUploads(): Promise<PendingUploadsResponse> {
  const response = await fetch("/api/me/pendientes", {
    credentials: "include",
    cache: "no-store",
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      data?.error || "No se pudieron consultar las fichas pendientes"
    );
  }

  return data;
}

function getStatusLabel(status: PendingStatus) {
  if (status === "INCOMPLETE") {
    return "Ficha incompleta";
  }

  if (status === "EMPTY") {
    return "Ficha vacía";
  }

  return "Sin ficha técnica";
}

function getStatusClasses(status: PendingStatus) {
  if (status === "INCOMPLETE") {
    return "border-amber-400/30 bg-amber-400/10 text-amber-200";
  }

  if (status === "EMPTY") {
    return "border-orange-400/30 bg-orange-400/10 text-orange-200";
  }

  return "border-red-400/30 bg-red-400/10 text-red-200";
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Fecha no disponible";
  }

  return new Intl.DateTimeFormat("es-CL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function PendingUploadsContent() {
  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["me", "pendientes"],
    queryFn: fetchPendingUploads,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    retry: 1,
  });

  if (isLoading) {
    return (
      <div className="flex min-h-[420px] items-center justify-center">
        <div className="flex items-center gap-3 text-white/60">
          <Loader2 className="h-5 w-5 animate-spin" />
          Cargando fichas pendientes...
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-2xl border border-red-400/30 bg-red-400/10 p-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 text-red-300" />

          <div>
            <h2 className="font-semibold text-red-100">
              No pudimos cargar tus pendientes
            </h2>

            <p className="mt-1 text-sm text-red-100/70">
              {error instanceof Error
                ? error.message
                : "Ocurrió un error inesperado"}
            </p>

            <button
              type="button"
              onClick={() => refetch()}
              disabled={isFetching}
              className="mt-4 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isFetching ? "Reintentando..." : "Intentar nuevamente"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!data || data.total === 0) {
    return (
      <div className="rounded-3xl border border-emerald-400/25 bg-emerald-400/10 px-6 py-12 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-400/15">
          <CheckCircle2 className="h-7 w-7 text-emerald-300" />
        </div>

        <h2 className="mt-5 text-xl font-semibold text-white">
          No tienes fichas pendientes
        </h2>

        <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-white/60">
          Todos los archivos que tienes asignados cuentan con su ficha técnica
          completa.
        </p>

        <Link
          href="/explorar"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-white/90"
        >
          Ir a explorar
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 md:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-400/15">
                <ClipboardList className="h-5 w-5 text-amber-300" />
              </div>

              <div>
                <h1 className="text-2xl font-bold text-white md:text-3xl">
                  Mis fichas pendientes
                </h1>

                <p className="mt-1 text-sm text-white/55">
                  Completa la información faltante de tus archivos.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <SummaryCard
              label="Incompletas"
              value={data.summary.incomplete}
            />

            <SummaryCard
              label="Vacías"
              value={data.summary.empty}
            />

            <SummaryCard
              label="Sin ficha"
              value={data.summary.withoutFicha}
            />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        {data.uploads.map((upload) => (
          <article
            key={upload.id}
            className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.035]"
          >
            <div className="p-5 md:p-6">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-semibold ${getStatusClasses(
                        upload.ficha.status
                      )}`}
                    >
                      {getStatusLabel(upload.ficha.status)}
                    </span>

                    <span className="text-xs text-white/40">
                      Subido el {formatDate(upload.uploadedAt)}
                    </span>
                  </div>

                  <h2 className="mt-4 break-words text-lg font-semibold text-white">
                    {upload.fileName}
                  </h2>

                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-white/50">
                    {upload.category && (
                      <span className="rounded-full bg-white/5 px-3 py-1">
                        {upload.category}
                      </span>
                    )}

                    {upload.subcategory && (
                      <span className="rounded-full bg-white/5 px-3 py-1">
                        {upload.subcategory}
                      </span>
                    )}

                    {upload.tipo && (
                      <span className="rounded-full bg-white/5 px-3 py-1">
                        {upload.tipo}
                      </span>
                    )}
                  </div>

                  <div className="mt-5">
                    <div className="flex items-center justify-between gap-4 text-sm">
                      <span className="text-white/60">
                        Progreso de la ficha
                      </span>

                      <span className="font-semibold text-white">
                        {upload.ficha.completion}%
                      </span>
                    </div>

                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-amber-300 transition-all"
                        style={{
                          width: `${upload.ficha.completion}%`,
                        }}
                      />
                    </div>

                    <p className="mt-2 text-xs text-white/40">
                      {upload.ficha.completedFields} de{" "}
                      {upload.ficha.totalFields} campos completados
                    </p>
                  </div>

                  <div className="mt-5">
                    <div className="flex items-center gap-2">
                      <FileWarning className="h-4 w-4 text-amber-300" />

                      <p className="text-sm font-medium text-white/80">
                        Información faltante
                      </p>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {upload.ficha.missingFields.map((field) => (
                        <span
                          key={field}
                          className="rounded-lg border border-white/10 bg-black/30 px-2.5 py-1.5 text-xs text-white/60"
                        >
                          {field}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <Link
                  href={`/videos/${upload.id}`}
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-white/90"
                >
                  Completar ficha
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="min-w-[90px] rounded-2xl border border-white/10 bg-black/30 px-3 py-3 text-center">
      <p className="text-xl font-bold text-white">
        {value}
      </p>

      <p className="mt-1 text-[11px] text-white/45">
        {label}
      </p>
    </div>
  );
}

export default function MisPendientesPage() {
  return (
    <AppShell
      header={<Navbar />}
      sidebar={<Sidebar />}
      footer={<Footer />}
    >
      <PendingUploadsContent />
    </AppShell>
  );
}