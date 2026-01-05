"use client";

import { useEffect, useState } from "react";

type Me = { id: string; name: string; role: string };
type CommentRow = {
  id: string;
  content: string;
  created_at: string;
  user_id: string | null;
  author_name: string | null;
};

export default function ComentariosLateral({ uploadId }: { uploadId: string }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loadingMe, setLoadingMe] = useState(true);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [msg, setMsg] = useState("");
  const [sending, setSending] = useState(false);

  const meRole = (me?.role ?? "").toUpperCase();
  const canPost = meRole === "ESTUDIANTE";

  // Cargar usuario
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch("/api/me", { cache: "no-store" });
        const s = await r.json().catch(() => null);
        if (!alive) return;
        setMe(s && s.id ? (s as Me) : null);
      } catch {
        if (alive) setMe(null);
      } finally {
        if (alive) setLoadingMe(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Cargar comentarios de esta película
  useEffect(() => {
    if (!uploadId) return;
    let cancel = false;

    const fetchComments = async () => {
      try {
        const res = await fetch(`/api/comments?uploadId=${uploadId}`, { cache: "no-store" });
        if (!res.ok) throw new Error("Error al obtener comentarios");
        const data: CommentRow[] = await res.json();
        if (!cancel) setComments(data);
      } catch (err) {
        console.error("Error cargando comentarios:", err);
        if (!cancel) setComments([]);
      }
    };

    fetchComments();
    return () => {
      cancel = true;
    };
  }, [uploadId]);

  // Enviar nuevo comentario
  async function sendComment(e: React.FormEvent) {
    e.preventDefault();
    const text = msg.trim();
    if (!text || !canPost || !me?.id) return;

    const optimistic: CommentRow = {
      id: "tmp-" + Date.now(),
      content: text,
      created_at: new Date().toISOString(),
      user_id: me.id,
      author_name: me.name || "Tú",
    };
    setComments((c) => [optimistic, ...c]);
    setMsg("");

    setSending(true);
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uploadId, content: text, userId: me.id }),
      });
      if (!res.ok) throw new Error();
      const saved: CommentRow = await res.json();
      setComments((c) => [saved, ...c.filter((x) => x.id !== optimistic.id)]);
    } catch {
      setComments((c) => c.filter((x) => x.id !== optimistic.id));
      setMsg(text);
      alert("No se pudo enviar el comentario.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 h-[420px] flex flex-col overflow-hidden">
      <h2 className="text-sm font-bold mb-2 text-center text-white">Comentarios</h2>

      {/* Lista de comentarios */}
      <div className="flex-1 overflow-y-auto text-sm text-gray-300 space-y-3 pr-2">
        {comments.length === 0 ? (
          <div className="text-zinc-400 text-center mt-6">
            Sé el primero en comentar esta película.
          </div>
        ) : (
          comments.map((c) => (
            <div key={c.id} className="leading-snug bg-zinc-800/40 rounded px-2 py-1.5">
              <div className="font-semibold text-zinc-200">
                {c.author_name ?? "Anónimo"}
                <span className="ml-2 text-[11px] text-zinc-500">
                  {new Date(c.created_at).toLocaleString()}
                </span>
              </div>
              <div>{c.content}</div>
            </div>
          ))
        )}
      </div>

      {/* Formulario */}
      <form onSubmit={sendComment} className="mt-2 flex gap-2">
        <input
          type="text"
          value={msg}
          onChange={(e) => setMsg(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.preventDefault();
          }}
          placeholder={
            loadingMe
              ? "Cargando…"
              : canPost
              ? "Escribe un comentario..."
              : "Solo estudiantes pueden comentar"
          }
          className="flex-1 px-3 py-1 rounded bg-zinc-800 border border-zinc-700 text-sm text-white disabled:opacity-60"
          disabled={loadingMe || !canPost}
        />
        <button
          type="submit"
          disabled={loadingMe || !canPost || sending || !msg.trim()}
          className="px-3 py-1 rounded bg-white text-black text-sm font-semibold disabled:opacity-50"
        >
          {sending ? "Enviando…" : "Comentar"}
        </button>
      </form>
    </div>
  );
}
