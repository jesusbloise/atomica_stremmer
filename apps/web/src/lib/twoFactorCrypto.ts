import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const raw = process.env.TWO_FACTOR_ENCRYPTION_KEY;

  if (!raw) {
    throw new Error(
      "TWO_FACTOR_ENCRYPTION_KEY no está configurada"
    );
  }

  const normalized = raw.trim();

  let key: Buffer;

  try {
    key = Buffer.from(normalized, "base64");
  } catch {
    throw new Error(
      "TWO_FACTOR_ENCRYPTION_KEY no es Base64 válido"
    );
  }

  if (key.length !== 32) {
    throw new Error(
      `TWO_FACTOR_ENCRYPTION_KEY debe tener 32 bytes. Recibidos: ${key.length}`
    );
  }

  return key;
}

export function encryptTwoFactorSecret(
  secret: string
): string {
  if (!secret) {
    throw new Error(
      "No se puede cifrar un secreto vacío"
    );
  }

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(
    ALGORITHM,
    key,
    iv,
    {
      authTagLength: AUTH_TAG_LENGTH,
    }
  );

  const encrypted = Buffer.concat([
    cipher.update(secret, "utf8"),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return [
    "v1",
    iv.toString("base64"),
    authTag.toString("base64"),
    encrypted.toString("base64"),
  ].join(".");
}

export function decryptTwoFactorSecret(
  payload: string
): string {
  if (!payload) {
    throw new Error(
      "No existe secreto 2FA cifrado"
    );
  }

  const parts = payload.split(".");

  if (
    parts.length !== 4 ||
    parts[0] !== "v1"
  ) {
    throw new Error(
      "Formato de secreto 2FA inválido"
    );
  }

  const [, ivBase64, tagBase64, encryptedBase64] =
    parts;

  const key = getEncryptionKey();

  const iv = Buffer.from(
    ivBase64,
    "base64"
  );

  const authTag = Buffer.from(
    tagBase64,
    "base64"
  );

  const encrypted = Buffer.from(
    encryptedBase64,
    "base64"
  );

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    key,
    iv,
    {
      authTagLength: AUTH_TAG_LENGTH,
    }
  );

  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}