"use client";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import logoUDD from "@/../public/Logo Stock Library_01-2.png"; // si prefieres <img>, cambia esto

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const redirectTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (redirectTimer.current) clearTimeout(redirectTimer.current);
    };
  }, []);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setOk(null);

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }

    try {
      setLoading(true);
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data?.error ?? "No se pudo registrar");
        return;
      }

      setOk("Cuenta creada correctamente. Te redirigiremos al login…");

      // Redirige al login en 3s
      redirectTimer.current = setTimeout(() => {
        router.push("/login");
      }, 3000);
    } catch (err: any) {
  console.error("REGISTER ERROR FULL:", err);
  console.error("REGISTER ERROR MESSAGE:", err?.message);
  console.error("REGISTER ERROR STACK:", err?.stack);
  return new Response(JSON.stringify({ ok: false, error: "Error interno" }), {
    status: 500,
    headers: { "content-type": "application/json" },
  });
} finally {
      setLoading(false);
    }
  };
const handleGoogleRegister = () => {
  localStorage.setItem("showSplash", "true");
  signIn("google", { callbackUrl: "/" });
};
  return (
    <div className="min-h-screen grid grid-cols-1 md:grid-cols-2">
      {/* Izquierda */}
      <div className="hidden md:flex items-center justify-center bg-black text-white">
        <Image src={logoUDD} alt="Logo UDD Plus" width={400} height={400} priority />
      </div>

      {/* Derecha */}
      <div className="flex flex-col items-center justify-center px-6 py-12 bg-black text-white">
        <div className="md:hidden mb-6">
          <Image src={logoUDD} alt="Logo UDD Plus" width={150} height={150} />
        </div>

        <div className="w-full max-w-md space-y-6">
          <h2 className="text-2xl font-semibold text-center">Crea una cuenta</h2>
          <p className="text-sm text-zinc-400 text-center">Ingresa tus datos para registrarte</p>

          {error && (
            <div className="bg-red-500/10 border border-red-500 text-red-300 px-3 py-2 rounded">
              {error}
            </div>
          )}
          {ok && (
            <div className="bg-green-500/10 border border-green-500 text-green-300 px-3 py-2 rounded">
              {ok}
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-4">
            <input
              type="text"
              placeholder="Nombre..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2 rounded bg-zinc-800 border border-zinc-600 focus:outline-none"
              required
              disabled={loading || !!ok}
            />
            <input
              type="email"
              placeholder="correoelectrónico@dominio.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 rounded bg-zinc-800 border border-zinc-600 focus:outline-none"
              required
              disabled={loading || !!ok}
            />
            <input
              type="password"
              placeholder="Contraseña (mín 6)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 rounded bg-zinc-800 border border-zinc-600 focus:outline-none"
              required
              minLength={6}
              disabled={loading || !!ok}
            />
            <input
              type="password"
              placeholder="Confirmación de Contraseña"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-2 rounded bg-zinc-800 border border-zinc-600 focus:outline-none"
              required
              minLength={6}
              disabled={loading || !!ok}
            />

            <button
              type="submit"
              disabled={loading || !!ok}
              className="w-full bg-white text-black font-semibold py-2 rounded hover:bg-zinc-300 transition disabled:opacity-60"
            >
              {loading ? "Creando…" : "Crear cuenta"}
            </button>
          </form>
<div className="flex items-center justify-center gap-4 text-zinc-400 text-sm">
  <hr className="border-zinc-600 w-1/5" />
  o registrarte con
  <hr className="border-zinc-600 w-1/5" />
</div>

<button
  type="button"
  onClick={handleGoogleRegister}
  disabled={loading || !!ok}
  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded flex items-center justify-center gap-2 disabled:opacity-60"
  aria-label="Registrarse con Google"
>
  <svg className="w-5 h-5" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303C33.826 32.33 29.274 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.869 6.053 29.7 4 24 4 12.954 4 4 12.954 4 24s8.954 20 20 20 20-8.954 20-20c0-1.341-.138-2.65-.389-3.917z"/>
    <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.674 16.108 18.994 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.869 6.053 29.7 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
    <path fill="#4CAF50" d="M24 44c5.19 0 9.93-1.98 13.5-5.2l-6.2-5.2C29.14 35.771 26.715 36 24 36c-5.252 0-9.792-3.354-11.387-8.034l-6.492 5.006C9.444 39.567 16.18 44 24 44z"/>
    <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-1.109 3.233-3.571 5.84-6.803 7.6l6.2 5.2C36.429 41.246 44 36 44 24c0-1.341-.138-2.65-.389-3.917z"/>
  </svg>
  Registrarme con Google
</button>
          <p className="text-sm text-center">
            ¿Ya tienes cuenta?{" "}
            <a href="/login" className="underline text-blue-400">
              Inicia sesión
            </a>
          </p>

          <p className="text-xs text-zinc-400 text-center mt-4">
            Al continuar aceptas nuestros{" "}
            <a href="#" className="underline">Términos de servicio</a> y{" "}
            <a href="#" className="underline">Política de privacidad</a>
          </p>
        </div>
      </div>
    </div>
  );
}

