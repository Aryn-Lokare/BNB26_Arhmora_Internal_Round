import { Pool } from "pg";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  try {
    const res = await pool.query("SELECT COUNT(*) as count FROM runs");
    console.log("Connected to Neon DB successfully! Runs count:", res.rows[0].count);
    const runsRes = await pool.query("SELECT id, outcome, task_text FROM runs LIMIT 5");
    console.log("Sample runs:", runsRes.rows);
  } catch (err) {
    console.error("Database connection error:", err);
  } finally {
    await pool.end();
  }
}

main();
