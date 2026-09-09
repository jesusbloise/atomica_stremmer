import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { Suspense } from "react";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Atomica",
  description: "Login con NextAuth + Google",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-black text-white`}>
        <div
          className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
          aria-hidden="true"
        >
          <video
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            className="h-full w-full object-cover"
          >
            <source src="/video_de_fondo.mp4" type="video/mp4" />
          </video>

          <div className="absolute inset-0 bg-black/70" />
        </div>

        <div className="relative z-10 min-h-dvh">
          <Providers>
            <Suspense fallback={<div className="p-4 text-zinc-400">Cargando…</div>}>
              {children}
            </Suspense>
          </Providers>
        </div>
      </body>
    </html>
  );
}

