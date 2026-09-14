import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { Suspense } from "react";
import BackgroundVideo from "@/components/layout/BackgroundVideo";

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
        <BackgroundVideo />

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

