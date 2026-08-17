"use client";

import Link from "next/link";
import { ShieldCheck, ChevronRight, X } from "lucide-react";
import { useEffect, useState } from "react";

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  message: string;
  action_url?: string | null;
  banner_dismissed_at?: string | null;
};

type NotificationsResponse = {
  notifications: NotificationItem[];
};

export default function TwoFactorBanner() {
  const [notification, setNotification] =
    useState<NotificationItem | null>(null);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const response = await fetch(
          "/api/notifications",
          {
            method: "GET",
            credentials: "include",
            cache: "no-store",
          }
        );

        if (!response.ok) return;

        const data: NotificationsResponse =
          await response.json();

        const twoFactorNotification =
          Array.isArray(data.notifications)
            ? data.notifications.find(
                (item) =>
                  item.type === "TWO_FACTOR_PENDING" &&
                  !item.banner_dismissed_at
              )
            : null;

        if (alive) {
          setNotification(
            twoFactorNotification || null
          );
        }
      } catch (error) {
        console.error(
          "Error cargando aviso 2FA:",
          error
        );
      } finally {
        if (alive) {
          setLoading(false);
        }
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  async function dismissBanner() {
    if (!notification) return;

    try {
      await fetch(
        `/api/notifications/${notification.id}/dismiss`,
        {
          method: "POST",
          credentials: "include",
        }
      );

      setNotification(null);
    } catch (error) {
      console.error(
        "Error ocultando aviso 2FA:",
        error
      );
    }
  }

  if (loading || !notification) {
    return null;
  }

  return (
    <div className="relative mb-5 overflow-hidden rounded-2xl border border-amber-400/30 bg-amber-400/10 shadow-lg shadow-amber-950/10">
      <button
        type="button"
        onClick={dismissBanner}
        aria-label="Cerrar aviso"
        title="Cerrar aviso"
        className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full text-amber-100/60 transition hover:bg-black/20 hover:text-white"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex flex-col gap-4 px-4 py-4 pr-14 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:pr-14">
        <div className="flex min-w-0 items-start gap-3">
          <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-400/15">
            <ShieldCheck className="h-5 w-5 text-amber-300" />
          </div>

          <div className="min-w-0">
            <p className="font-semibold text-amber-100">
              Seguridad de tu cuenta
            </p>

            <p className="mt-1 text-sm text-amber-100/75">
              Aún no has activado la verificación en dos pasos con Google Authenticator.
              Te recomendamos configurarla para proteger mejor tu cuenta.
            </p>
          </div>
        </div>

        <Link
          href="/perfil"
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-amber-300 px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-amber-200"
        >
          Configurar ahora
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}