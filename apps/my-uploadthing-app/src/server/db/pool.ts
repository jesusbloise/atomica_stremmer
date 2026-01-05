import { Pool } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var __atomicaPool: Pool | undefined;
}

function buildPool() {
  return new Pool({
    user: process.env.PGUSER || "postgres",
    host: process.env.PGHOST || "localhost",
    database: process.env.PGDATABASE || "atomica_stremmer",
    password: process.env.PGPASSWORD || "atomica",
    port: Number(process.env.PGPORT) || 5432,
  });
}

const pool = global.__atomicaPool ?? buildPool();

if (process.env.NODE_ENV !== "production") {
  global.__atomicaPool = pool;
}

export default pool;
