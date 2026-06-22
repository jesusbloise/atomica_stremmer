const { Storage } = require("@google-cloud/storage");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { Pool } = require("pg");

const storage = new Storage();

const pool = new Pool({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
});

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${required("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: required("R2_ACCESS_KEY_ID"),
    secretAccessKey: required("R2_SECRET_ACCESS_KEY"),
  },
});

const R2_BUCKET = required("R2_BUCKET_NAME");

function parseGsUri(uri) {
  if (!uri || !uri.startsWith("gs://")) return null;

  const without = uri.slice(5);
  const slash = without.indexOf("/");
  if (slash === -1) return null;

  return {
    bucket: without.slice(0, slash),
    key: without.slice(slash + 1),
  };
}

function guessContentType(key) {
  const lower = key.toLowerCase();

  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".avif")) return "image/avif";
  if (lower.endsWith(".gif")) return "image/gif";

  return "image/jpeg";
}

async function main() {
  const limit = Number(process.env.MIGRATION_LIMIT || 10);

  console.log("THUMBNAILS_GCS_TO_R2_START", { limit });

  const { rows } = await pool.query(
    `
    SELECT id, thumbnail_url
    FROM uploads
    WHERE thumbnail_url LIKE 'gs://%'
    ORDER BY uploaded_at DESC
    LIMIT $1
    `,
    [limit]
  );

  console.log("THUMBNAILS_FOUND", { found: rows.length });

  for (const row of rows) {
    const parsed = parseGsUri(row.thumbnail_url);

    if (!parsed) {
      console.log("THUMBNAIL_SKIP_INVALID_GS", row);
      continue;
    }

    const destinationKey = parsed.key;

    console.log("THUMBNAIL_COPY_START", {
      id: row.id,
      source: row.thumbnail_url,
      destinationKey,
    });

    const [buffer] = await storage.bucket(parsed.bucket).file(parsed.key).download();

    await r2.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: destinationKey,
        Body: buffer,
        ContentType: guessContentType(destinationKey),
        CacheControl: "public, max-age=31536000, immutable",
      })
    );

    const r2Uri = `r2://${R2_BUCKET}/${destinationKey}`;

    await pool.query(
      `
      UPDATE uploads
      SET thumbnail_url = $1
      WHERE id = $2
      `,
      [r2Uri, row.id]
    );

    console.log("THUMBNAIL_COPY_OK", {
      id: row.id,
      r2Uri,
    });
  }

  console.log("THUMBNAILS_GCS_TO_R2_DONE");
}

main()
  .catch((err) => {
    console.error("THUMBNAILS_GCS_TO_R2_ERROR", err);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end().catch(() => {});
  });