import { Pool } from "pg";
import dotenv from "dotenv";
import path from "path";

// Load root .env
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export async function query<T = any>(text: string, params?: any[]): Promise<T[]> {
  try {
    const res = await pool.query(text, params);
    return res.rows;
  } catch (err) {
    console.error(`[DB Query Error] ${text}:`, err);
    throw err;
  }
}
