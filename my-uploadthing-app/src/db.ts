import { Pool } from "pg";

const pool = new Pool({
  user: process.env.PGUSER || "postgres",
  host: process.env.PGHOST || "localhost",
  database: process.env.PGDATABASE || "falabella_stremmer",
  password: process.env.PGPASSWORD || "atomica",
  port: Number(process.env.PGPORT) || 5432,
});

export default pool;
