"use client";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import logoUDD from "@/../public/ATOMICA-Logo-02.png"; // si prefieres <img>, cambia esto

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
    } catch {
      setError("Error de red");
    } finally {
      setLoading(false);
    }
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

