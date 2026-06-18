const { Pool } = require("pg");
const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

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

function parseR2Url(raw) {
  if (!raw || !raw.startsWith("r2://")) return null;

  const clean = raw.slice(5);
  const slash = clean.indexOf("/");
  if (slash === -1) return null;

  return {
    bucket: clean.slice(0, slash),
    key: clean.slice(slash + 1),
  };
}

function getPlaybackUrl(uid) {
  return `https://iframe.videodelivery.net/${uid}`;
}

async function main() {
  const limit = Number(process.env.STREAM_MIGRATION_LIMIT || 1);

  const r2AccountId = required("R2_ACCOUNT_ID");
  const r2AccessKeyId = required("R2_ACCESS_KEY_ID");
  const r2SecretAccessKey = required("R2_SECRET_ACCESS_KEY");

  const cfAccountId = required("CF_ACCOUNT_ID");
  const cfToken = required("CF_STREAM_TOKEN");

  const r2 = new S3Client({
    region: "auto",
    endpoint: `https://${r2AccountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: r2AccessKeyId,
      secretAccessKey: r2SecretAccessKey,
    },
  });

  const { rows } = await pool.query(
    `
    SELECT id, file_name, r2_path
    FROM uploads
    WHERE tipo = 'video'
      AND r2_path LIKE 'r2://%'
      AND cf_stream_uid IS NULL
    ORDER BY uploaded_at ASC
    LIMIT $1
    `,
    [limit]
  );

  console.log("STREAM_MIGRATION_START", { limit, found: rows.length });

  for (const row of rows) {
    const parsed = parseR2Url(row.r2_path);

    if (!parsed) {
      console.log("STREAM_MIGRATION_SKIP_INVALID_R2", {
        id: row.id,
        r2_path: row.r2_path,
      });
      continue;
    }

    try {
      console.log("STREAM_COPY_START", {
        id: row.id,
        file_name: row.file_name,
        r2_path: row.r2_path,
      });

      const signedUrl = await getSignedUrl(
        r2,
        new GetObjectCommand({
          Bucket: parsed.bucket,
          Key: parsed.key,
        }),
        { expiresIn: 60 * 60 }
      );

      const res = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/stream/copy`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${cfToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            url: signedUrl,
            meta: {
              name: row.file_name || row.id,
            },
          }),
        }
      );

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.success) {
        console.error("STREAM_COPY_FAILED", {
          id: row.id,
          status: res.status,
          data,
        });

        await pool.query(
          `
          UPDATE uploads
          SET cf_stream_status = $1
          WHERE id = $2
          `,
          ["error", row.id]
        );

        continue;
      }

      const uid = data.result?.uid;
      const ready = Boolean(data.result?.readyToStream);
      const status = ready ? "ready" : "processing";
      const playbackUrl = getPlaybackUrl(uid);

      await pool.query(
        `
        UPDATE uploads
        SET cf_stream_uid = $1,
            cf_stream_status = $2,
            cf_stream_ready = $3,
            cf_stream_playback_url = $4
        WHERE id = $5
        `,
        [uid, status, ready, playbackUrl, row.id]
      );

      console.log("STREAM_COPY_OK", {
        id: row.id,
        uid,
        status,
        ready,
        playbackUrl,
      });
    } catch (err) {
      console.error("STREAM_MIGRATION_ITEM_ERROR", {
        id: row.id,
        error: err?.message || err,
      });

      await pool.query(
        `
        UPDATE uploads
        SET cf_stream_status = $1
        WHERE id = $2
        `,
        ["error", row.id]
      ).catch(() => {});
    }
  }

  console.log("STREAM_MIGRATION_DONE");
}

main()
  .catch((err) => {
    console.error("STREAM_MIGRATION_ERROR", err);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end().catch(() => {});
  });
  