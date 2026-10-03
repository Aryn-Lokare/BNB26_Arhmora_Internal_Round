let poolInstance: any = null;

export function getPool(): any {
  if (poolInstance) return poolInstance;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    return null;
  }
  try {
    // Dynamic import to prevent crash when pg is not installed in local dev
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Pool } = require("pg");
    poolInstance = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
    });
    return poolInstance;
  } catch (err) {
    console.warn("PostgreSQL not loaded (will use in-memory seed data):", err);
    return null;
  }
}

export async function query<T = any>(text: string, params?: any[]): Promise<T[]> {
  const p = getPool();
  if (!p) {
    throw new Error("DATABASE_URL not set or database pool unavailable");
  }
  const res = await p.query(text, params);
  return res.rows;
}
