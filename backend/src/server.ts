import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { getAllRuns, getRunById } from "./runsService.js";
import { getDiagnosisForRun } from "./diagnosisService.js";
import { executeReplay, compareRuns } from "./replayService.js";
import { pool } from "./db.js";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const app = express();
const PORT = process.env.PORT || 8000;

app.use(cors({ origin: "*" }));
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    console.log(`[BlackBox API] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - start}ms)`);
  });
  next();
});

// 1. Health check
app.get("/api/health", async (req: Request, res: Response) => {
  let dbStatus = "connected";
  try {
    await pool.query("SELECT 1");
  } catch (e) {
    dbStatus = "disconnected";
  }

  res.json({
    status: "ok",
    service: "Black Box Node.js API",
    version: "1.0.4",
    database: dbStatus,
    timestamp: new Date().toISOString(),
  });
});

// 2. Get all recorded runs
app.get("/api/runs", async (req: Request, res: Response) => {
  try {
    const runs = await getAllRuns();
    res.json(runs);
  } catch (err: any) {
    console.error("Error in GET /api/runs:", err);
    res.status(500).json({ error: err.message || "Failed to fetch runs" });
  }
});

// 3. Get single run by ID
app.get("/api/runs/:id", async (req: Request, res: Response) => {
  try {
    const run = await getRunById(req.params.id);
    if (!run) {
      return res.status(404).json({ error: `Run ${req.params.id} not found` });
    }
    res.json(run);
  } catch (err: any) {
    console.error(`Error in GET /api/runs/${req.params.id}:`, err);
    res.status(500).json({ error: err.message || "Failed to fetch run" });
  }
});

// 4. Get failure diagnosis for a run
app.get("/api/runs/:id/diagnosis", async (req: Request, res: Response) => {
  try {
    const diagnosis = await getDiagnosisForRun(req.params.id);
    if (!diagnosis) {
      return res.status(404).json({ error: `Diagnosis for run ${req.params.id} not found` });
    }
    res.json(diagnosis);
  } catch (err: any) {
    console.error(`Error in GET /api/runs/${req.params.id}/diagnosis:`, err);
    res.status(500).json({ error: err.message || "Failed to generate diagnosis" });
  }
});

// 5. Execute counterfactual replay
app.post("/api/replay", async (req: Request, res: Response) => {
  try {
    const { run_id, checkpoint_step, patch } = req.body;
    if (!run_id) {
      return res.status(400).json({ error: "run_id is required" });
    }

    const result = await executeReplay({
      run_id,
      checkpoint_step: checkpoint_step ?? 2,
      patch: patch || {},
    });

    res.json(result);
  } catch (err: any) {
    console.error("Error in POST /api/replay:", err);
    res.status(500).json({ error: err.message || "Replay failed" });
  }
});

// 6. Compare original run and replayed run
app.get("/api/compare", async (req: Request, res: Response) => {
  try {
    const origId = (req.query.orig as string) || "run-9a1b2c3d";
    const repId = (req.query.rep as string) || "run-4f81c9a0";

    const comparison = await compareRuns(origId, repId);
    if (!comparison) {
      return res.status(404).json({ error: "Runs could not be compared" });
    }

    res.json(comparison);
  } catch (err: any) {
    console.error("Error in GET /api/compare:", err);
    res.status(500).json({ error: err.message || "Comparison failed" });
  }
});

app.listen(PORT, () => {
  console.log(`[BlackBox API] Node.js server running on http://localhost:${PORT}`);
});
