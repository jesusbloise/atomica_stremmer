"use client";
import * as HoverCard from "@radix-ui/react-hover-card";
import Link from "next/link";

type Mini = { user_id: string; name: string; email: string; avatar_url?: string | null; generacion?: string; facultad?: string };

export default function ProfileHoverCard({ user }: { user: Mini }) {
  return (
    <HoverCard.Root openDelay={150}>
      <HoverCard.Trigger asChild>
        <Link href={`/perfiles/${user.user_id}`} className="text-orange-400 hover:text-orange-500 underline" scroll={false}>
          {user.name}
        </Link>
      </HoverCard.Trigger>
      <HoverCard.Content sideOffset={8} className="rounded-xl border border-zinc-700 bg-zinc-900 p-4 shadow-lg w-80">
        <div className="flex gap-3">
          <div className="w-12 h-12 rounded-full overflow-hidden bg-zinc-800 shrink-0">
            {user.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatar_url} alt={user.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full grid place-items-center text-[10px] text-zinc-400">—</div>
            )}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-white truncate">{user.name}</p>
            <p className="text-xs text-zinc-400 truncate">{user.email}</p>
            <p className="text-xs text-zinc-500 truncate">
              {user.generacion ? `Gen. ${user.generacion} · ` : ""}{user.facultad || ""}
            </p>
            <div className="mt-2">
              <Link href={`/perfiles/${user.user_id}`} className="text-xs px-3 py-1 rounded border border-orange-500/40 text-orange-400 hover:text-orange-500" scroll={false}>
                Ver perfil
              </Link>
            </div>
          </div>
        </div>
      </HoverCard.Content>
    </HoverCard.Root>
  );
}
