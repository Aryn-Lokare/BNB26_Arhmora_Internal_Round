import { NextResponse } from "next/server";
import { getPool } from "@/lib/server/db";

export async function GET() {
  let dbStatus = "disconnected";
  const pool = getPool();
  if (pool) {
    try {
      await pool.query("SELECT 1");
      dbStatus = "connected";
    } catch {
      dbStatus = "disconnected";
    }
  }

  return NextResponse.json({
    status: "ok",
    service: "Black Box Serverless API",
    version: "1.0.4",
    database: dbStatus,
    timestamp: new Date().toISOString(),
  });
}
