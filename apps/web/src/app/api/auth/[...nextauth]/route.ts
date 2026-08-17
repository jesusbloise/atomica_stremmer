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
  if (!user?.email) {
    return false;
  }

  const email = user.email
    .trim()
    .toLowerCase();

  const client = await pool.connect();

  try {
    const result = await client.query<{
      id: string;
      is_active: boolean;
    }>(
      `
      SELECT
        id,
        is_active
      FROM users
      WHERE LOWER(email) = $1
      LIMIT 1
      `,
      [email]
    );

    const existingUser =
      result.rows[0];

    /*
     * Google solamente puede autenticar
     * usuarios que YA existen en Atomica
     * y cuya cuenta está activa.
     */
    if (
      !existingUser ||
      !existingUser.is_active
    ) {
      console.warn(
        `Google login rechazado para cuenta no autorizada: ${email}`
      );

      return false;
    }

    /*
     * Opcionalmente actualizamos el nombre
     * que Google nos entrega, pero NO
     * creamos cuentas nuevas.
     */
    if (user.name) {
      await client.query(
        `
        UPDATE users
        SET name = COALESCE($1, name)
        WHERE id = $2
        `,
        [
          user.name
            .toString()
            .slice(0, 120),
          existingUser.id,
        ]
      );
    }

    return true;
  } catch (error) {
    console.error(
      "Error validando usuario Google:",
      error
    );

    return false;
  } finally {
    client.release();
  }
},
  },
  pages: { signIn: "/login" },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
