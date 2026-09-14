import jwt from "jsonwebtoken";

export type Session = {
  sub: string;
  id?: string;
  role:
    | "SUPER_ADMIN"
    | "ADMIN"
    | "USUARIO"
    | "PROFESOR"
    | "ESTUDIANTE";
  name: string;
  email: string;
};

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret-cambia-esto";

function getBearerToken(req: Request): string | null {
  const authorization = req.headers.get("authorization");

  if (!authorization) {
    return null;
  }

  const [scheme, token] = authorization.trim().split(/\s+/);

  if (
    scheme?.toLowerCase() !== "bearer" ||
    !token
  ) {
    return null;
  }

  return token;
}

function getCookieToken(req: Request): string | null {
  const cookie = (req.headers.get("cookie") || "")
    .split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith("auth="));

  const rawToken = cookie?.slice("auth=".length);

  if (!rawToken) {
    return null;
  }

  try {
    return decodeURIComponent(rawToken);
  } catch {
    return rawToken;
  }
}

export function getSessionFromRequest(req: Request): Session | null {
  try {
    const token =
      getBearerToken(req) ||
      getCookieToken(req);

    if (!token) {
      return null;
    }

    return jwt.verify(token, JWT_SECRET) as Session;
  } catch {
    return null;
  }
}