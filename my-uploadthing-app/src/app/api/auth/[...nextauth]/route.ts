import NextAuth, { type NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import  pool  from "@/db";

export const dynamic = "force-dynamic";

if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
  // Para ayudarte a detectar el problema en consola
  console.warn("⚠️ Falta GOOGLE_CLIENT_ID o GOOGLE_CLIENT_SECRET en .env.local");
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,        // <- debe existir
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,// <- debe existir
      authorization: { params: { prompt: "select_account" } },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async signIn({ user }) {
      if (!user?.email) return false;
      const client = await pool.connect();
      try {
        await client.query(
          `INSERT INTO users (name, email, password_hash, role, is_active)
           VALUES ($1, $2, '', 'ESTUDIANTE', true)
           ON CONFLICT (email) DO UPDATE SET name = COALESCE(EXCLUDED.name, users.name)`,
          [(user.name ?? null)?.toString().slice(0,120) || null, user.email.toLowerCase()]
        );
      } finally { client.release(); }
      return true;
    },
  },
  pages: { signIn: "/login" },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
