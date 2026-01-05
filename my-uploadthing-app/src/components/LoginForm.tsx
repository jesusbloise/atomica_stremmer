"use client";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import logoUDD from "@/../public/ATOMICA-Logo-02.png";
import { signIn } from "next-auth/react";

const ATTEMPTS_KEY = "login_attempts";

// 🔊 Desbloquea audio en el mismo gesto del usuario
function unlockAudio() {
  try {
    const AudioCtx =
      (window as any).AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioCtx();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    // volumen casi cero (inaudible)
    gain.gain.value = 0.0001;

    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.05); // 50ms

    // Además, deja el contexto en running para la siguiente ruta
    ctx.resume?.();
    // Guardamos una marquita por si la quieres leer en el splash (opcional)
    sessionStorage.setItem("audioUnlocked", "1");
    console.log("🔓 Audio desbloqueado");
  } catch (e) {
    console.warn("No se pudo desbloquear audio:", e);
  }
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Carga intentos almacenados (persisten entre recargas)
  useEffect(() => {
    const saved = Number(localStorage.getItem(ATTEMPTS_KEY) ?? "0");
    setAttempts(Number.isFinite(saved) ? saved : 0);
  }, []);

  // Guarda intentos al cambiar
  useEffect(() => {
    localStorage.setItem(ATTEMPTS_KEY, String(attempts));
  }, [attempts]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // 🔊 Desbloquear audio *antes* de cualquier await (mismo gesto)
    unlockAudio();

    try {
      setLoading(true);
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        const next = attempts + 1;
        setAttempts(next);

        if (next >= 3) {
          setError("Demasiados intentos fallidos. Te enviaremos al registro…");
          localStorage.removeItem(ATTEMPTS_KEY);
          setTimeout(() => router.push("/register"), 1800);
        } else {
          const restantes = 3 - next;
          setError(
            `${data?.error || "Credenciales inválidas"}. Intentos restantes: ${restantes}`
          );
        }
        return;
      }

      // ✅ Éxito: marcar splash y limpiar intentos
      localStorage.setItem("showSplash", "true");
      localStorage.removeItem(ATTEMPTS_KEY);

      // 👉 Navegación SPA para no perder el permiso de audio
      router.replace("/");
    } catch {
      setError("Error de red. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid grid-cols-1 md:grid-cols-2">
      {/* Columna Izquierda (desktop) */}
      <div className="hidden md:flex items-center justify-center bg-black text-white">
        <Image src={logoUDD} alt="Logo UDD Plus" width={400} height={400} priority />
      </div>

      {/* Columna Derecha (formulario y logo para mobile) */}
      <div className="flex flex-col items-center justify-center px-6 py-12 bg-black text-white">
        {/* Logo solo visible en mobile */}
        <div className="md:hidden mb-6">
          <Image src={logoUDD} alt="Logo UDD Plus" width={150} height={150} />
        </div>

        <div className="w-full max-w-md space-y-6">
          <h2 className="text-2xl font-semibold text-center mb-2">
            Inicio de sesión
          </h2>
          <p className="text-sm text-zinc-400 text-center">
            Ingresa tu correo y contraseña
          </p>

          {error && (
            <div className="bg-red-500/10 border border-red-500 text-red-300 px-3 py-2 rounded">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="email"
              placeholder="correoelectrónico@dominio.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 rounded bg-zinc-800 border border-zinc-600 focus:outline-none"
              required
              disabled={loading}
            />
            <input
              type="password"
              placeholder="Contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 rounded bg-zinc-800 border border-zinc-600 focus:outline-none"
              required
              disabled={loading}
            />

            <div className="flex items-center justify-between text-sm">
              <a href="/register" className="underline text-blue-400">
                Crear cuenta
              </a>
              <a href="/forgot-password" className="underline text-blue-400">
                ¿Olvidaste tu contraseña?
              </a>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-white text-black font-semibold py-2 rounded hover:bg-zinc-300 transition disabled:opacity-60"
            >
              {loading ? "Ingresando…" : "Iniciar sesión"}
            </button>
          </form>

          <div className="flex items-center justify-center gap-4 text-zinc-400 text-sm">
            <hr className="border-zinc-600 w-1/5" />
            o continuar con
            <hr className="border-zinc-600 w-1/5" />
          </div>

          {/* Login con Google */}
          <button
            type="button"
            onClick={() => {
              localStorage.setItem("showSplash", "true");
              // 🔊 desbloquear audio justo en el clic
              unlockAudio();
              // Importante: signIn navega con redirect (pierde el contexto),
              // pero ya hubo gesto del usuario; al volver, la política suele permitir autoplay.
              signIn("google", { callbackUrl: "/" });
            }}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded flex items-center justify-center gap-2"
            aria-label="Continuar con Google"
          >
            {/* icono Google */}
            <svg className="w-5 h-5" viewBox="0 0 48 48" aria-hidden="true">
              <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303C33.826 32.33 29.274 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.869 6.053 29.7 4 24 4 12.954 4 4 12.954 4 24s8.954 20 20 20 20-8.954 20-20c0-1.341-.138-2.65-.389-3.917z"/>
              <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.674 16.108 18.994 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.869 6.053 29.7 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
              <path fill="#4CAF50" d="M24 44c5.19 0 9.93-1.98 13.5-5.2l-6.2-5.2C29.14 35.771 26.715 36 24 36c-5.252 0-9.792-3.354-11.387-8.034l-6.492 5.006C9.444 39.567 16.18 44 24 44z"/>
              <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-1.109 3.233-3.571 5.84-6.803 7.6l6.2 5.2C36.429 41.246 44 36 44 24c0-1.341-.138-2.65-.389-3.917z"/>
            </svg>
            Google
          </button>

          <p className="text-xs text-zinc-400 mt-4 text-center">
            Al continuar aceptas nuestros{" "}
            <a href="#" className="underline">Términos de servicio</a> y{" "}
            <a href="#" className="underline">Política de privacidad</a>
          </p>
        </div>
      </div>
    </div>
  );
}
