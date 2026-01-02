import jwt from "jsonwebtoken";

export type Session = {
  sub: string;
  role: "ADMIN" | "PROFESOR" | "ESTUDIANTE";
  name: string;
  email: string;
};

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret-cambia-esto";

export function getSessionFromRequest(req: Request): Session | null {
  try {
    const cookie = (req.headers.get("cookie") || "")
      .split(";")
      .map(v => v.trim())
      .find(v => v.startsWith("auth="));
    const token = cookie?.split("=")?.[1];
    if (!token) return null;
    return jwt.verify(token, JWT_SECRET) as Session;
  } catch {
    return null;
  }
}
