"use client";

import {
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";

export default function GoogleCompletePage() {
  const router = useRouter();

  const [loading, setLoading] =
    useState(true);

  const [
    requiresTwoFactor,
    setRequiresTwoFactor,
  ] = useState(false);

  const [
    requiresTwoFactorSetup,
    setRequiresTwoFactorSetup,
  ] = useState(false);

  const [
    challengeToken,
    setChallengeToken,
  ] = useState("");

  const [code, setCode] =
    useState("");

  const [
    setupSecret,
    setSetupSecret,
  ] = useState("");

  const [
    setupQrCode,
    setSetupQrCode,
  ] = useState("");

  const [
    setupCode,
    setSetupCode,
  ] = useState("");

  const [error, setError] =
    useState<string | null>(
      null
    );

  useEffect(() => {
    let alive = true;

    async function completeGoogleLogin() {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(
          "/api/auth/google-complete",
          {
            method: "POST",
            cache: "no-store",
          }
        );

        const data =
          await res
            .json()
            .catch(() => ({}));

        if (!alive) return;

        if (!res.ok) {
          throw new Error(
            data?.error ||
              "No se pudo completar el inicio de sesión con Google"
          );
        }

        const token =
          data?.challengeToken ||
          "";

        if (!token) {
          throw new Error(
            "No se pudo iniciar la verificación de seguridad."
          );
        }

        setChallengeToken(token);

        if (
          data?.requiresTwoFactorSetup
        ) {
          const setupResponse =
            await fetch(
              "/api/2fa/setup",
              {
                method: "POST",
                headers: {
                  "Content-Type":
                    "application/json",
                },
                body:
                  JSON.stringify({
                    challengeToken:
                      token,
                  }),
              }
            );

          const setupData =
            await setupResponse
              .json()
              .catch(() => ({}));

          if (!alive) return;

          if (
            !setupResponse.ok
          ) {
            throw new Error(
              setupData?.error ||
                "No se pudo preparar Google Authenticator."
            );
          }

          if (
            !setupData?.secret ||
            !setupData?.qrCodeDataUrl
          ) {
            throw new Error(
              "El servidor no pudo generar la configuración de Google Authenticator."
            );
          }

          setSetupSecret(
            setupData.secret
          );

          setSetupQrCode(
            setupData.qrCodeDataUrl
          );

          setSetupCode("");

          setRequiresTwoFactorSetup(
            true
          );

          setRequiresTwoFactor(
            false
          );

          return;
        }

        if (
          data?.requiresTwoFactor
        ) {
          setRequiresTwoFactor(
            true
          );

          setRequiresTwoFactorSetup(
            false
          );

          setCode("");

          return;
        }

        throw new Error(
          "No se pudo completar la verificación de seguridad."
        );
      } catch (err: any) {
        if (!alive) return;

        console.error(
          "Google complete error:",
          err
        );

        setError(
          err?.message ||
            "No se pudo completar el inicio de sesión"
        );
      } finally {
        if (alive) {
          setLoading(false);
        }
      }
    }

    void completeGoogleLogin();

    return () => {
      alive = false;
    };
  }, []);

  const handleVerify = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    setError(null);

    const cleanCode =
      code.replace(/\D/g, "");

    if (
      cleanCode.length !== 6
    ) {
      setError(
        "Ingresa el código de 6 dígitos de Google Authenticator."
      );
      return;
    }

    try {
      setLoading(true);

      const res = await fetch(
        "/api/login/2fa",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            challengeToken,
            code: cleanCode,
          }),
        }
      );

      const data =
        await res
          .json()
          .catch(() => ({}));

      if (!res.ok) {
        throw new Error(
          data?.error ||
            "Código incorrecto"
        );
      }

      localStorage.setItem(
        "showSplash",
        "true"
      );

      router.replace("/");
    } catch (err: any) {
      console.error(
        "Google 2FA error:",
        err
      );

      setError(
        err?.message ||
          "No se pudo verificar el código"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSetup = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    setError(null);

    const cleanCode =
      setupCode.replace(
        /\D/g,
        ""
      );

    if (
      cleanCode.length !== 6
    ) {
      setError(
        "Ingresa el código de 6 dígitos generado por Google Authenticator."
      );
      return;
    }

    try {
      setLoading(true);

      const res = await fetch(
        "/api/2fa/enable",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            challengeToken,
            secret:
              setupSecret,
            token:
              cleanCode,
          }),
        }
      );

      const data =
        await res
          .json()
          .catch(() => ({}));

      if (!res.ok) {
        throw new Error(
          data?.error ||
            "No se pudo activar la verificación en dos pasos."
        );
      }

      localStorage.setItem(
        "showSplash",
        "true"
      );

      router.replace("/");
    } catch (err: any) {
      console.error(
        "Google 2FA setup error:",
        err
      );

      setError(
        err?.message ||
          "No se pudo completar la configuración."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-6 py-10">
      <div className="w-full max-w-md space-y-5">
        {error && (
          <div className="rounded-lg border border-red-500 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {!requiresTwoFactor &&
        !requiresTwoFactorSetup ? (
          <div className="text-center">
            <h1 className="text-2xl font-semibold">
              Iniciando sesión
            </h1>

            <p className="mt-3 text-sm text-zinc-400">
              Estamos verificando tu cuenta de Google...
            </p>

            {loading && (
              <div className="mt-6 text-zinc-400">
                Verificando...
              </div>
            )}
          </div>
        ) : requiresTwoFactorSetup ? (
          <form
            onSubmit={
              handleSetup
            }
            className="space-y-4"
          >
            <div className="text-center">
              <h1 className="text-2xl font-semibold">
                Protege tu cuenta
              </h1>

              <p className="mt-3 text-sm text-zinc-400">
                La verificación en dos pasos es obligatoria para utilizar Atomica.
              </p>
            </div>

            <div className="rounded-xl border border-orange-500/30 bg-orange-500/10 p-4">
              <p className="text-sm text-zinc-300">
                Abre Google Authenticator, escanea el código QR e ingresa el código de 6 dígitos generado.
              </p>
            </div>

            {setupQrCode && (
              <div className="flex justify-center rounded-xl bg-white p-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={
                    setupQrCode
                  }
                  alt="Código QR para Google Authenticator"
                  className="h-56 w-56"
                />
              </div>
            )}

            {setupSecret && (
              <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-3">
                <p className="text-xs text-zinc-500">
                  Si no puedes escanear el QR, introduce manualmente esta clave:
                </p>

                <p className="mt-2 break-all text-center font-mono text-sm text-zinc-200">
                  {
                    setupSecret
                  }
                </p>
              </div>
            )}

            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={
                setupCode
              }
              onChange={(e) =>
                setSetupCode(
                  e.target.value
                    .replace(
                      /\D/g,
                      ""
                    )
                    .slice(
                      0,
                      6
                    )
                )
              }
              placeholder="000000"
              className="w-full rounded-lg border border-zinc-600 bg-zinc-800 px-4 py-3 text-center text-xl tracking-[0.4em] outline-none focus:border-orange-500"
              disabled={
                loading
              }
              autoFocus
            />

            <button
              type="submit"
              disabled={
                loading ||
                setupCode.length !==
                  6
              }
              className="w-full rounded-lg bg-orange-500 py-2.5 font-semibold text-white transition hover:bg-orange-600 disabled:opacity-60"
            >
              {loading
                ? "Activando..."
                : "Activar y continuar"}
            </button>

            <button
              type="button"
              onClick={() =>
                router.replace(
                  "/login"
                )
              }
              disabled={
                loading
              }
              className="w-full text-sm text-zinc-400 transition hover:text-white"
            >
              Volver al inicio de sesión
            </button>
          </form>
        ) : (
          <form
            onSubmit={
              handleVerify
            }
            className="space-y-5"
          >
            <div className="text-center">
              <h1 className="text-2xl font-semibold">
                Verificación en dos pasos
              </h1>

              <p className="mt-3 text-sm text-zinc-400">
                Abre Google Authenticator e ingresa el código de 6 dígitos para continuar.
              </p>
            </div>

            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) =>
                setCode(
                  e.target.value
                    .replace(
                      /\D/g,
                      ""
                    )
                    .slice(
                      0,
                      6
                    )
                )
              }
              placeholder="000000"
              className="w-full rounded-lg border border-zinc-600 bg-zinc-800 px-4 py-3 text-center text-xl tracking-[0.4em] outline-none focus:border-orange-500"
              disabled={
                loading
              }
              autoFocus
            />

            <button
              type="submit"
              disabled={
                loading ||
                code.length !==
                  6
              }
              className="w-full rounded-lg bg-white py-2.5 font-semibold text-black transition hover:bg-zinc-300 disabled:opacity-60"
            >
              {loading
                ? "Verificando..."
                : "Verificar código"}
            </button>

            <button
              type="button"
              onClick={() =>
                router.replace(
                  "/login"
                )
              }
              disabled={
                loading
              }
              className="w-full text-sm text-zinc-400 transition hover:text-white"
            >
              Volver al inicio de sesión
            </button>
          </form>
        )}
      </div>
    </div>
  );
}