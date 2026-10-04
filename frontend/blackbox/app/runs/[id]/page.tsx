"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getRunById, getDiagnosis, getRunComparison } from "@/services/api";
import { Run, Diagnosis, RunComparison, ReplayJob, TraceStep } from "@/types/run";
import { ExecutionTimeline } from "@/components/trace/ExecutionTimeline";
import { DiagnosisPanel } from "@/components/diagnosis/DiagnosisPanel";
import { ReplayStudio } from "@/components/replay/ReplayStudio";
import { TraceDiffView } from "@/components/comparison/TraceDiffView";
import { AsciiBadge } from "@/components/ui/AsciiBadge";
import {
  ArrowLeft,
  Terminal,
  Activity,
  AlertTriangle,
  RotateCcw,
  GitCompare,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Database,
  Layers,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type ActiveTab = "trace" | "diagnosis" | "replay" | "comparison";

export default function RunDetailPage() {
  const params = useParams();
  const runId = (params?.id as string) || "run-9a1b2c3d";

  const [run, setRun] = useState<Run | null>(null);
  const [diagnosis, setDiagnosis] = useState<Diagnosis | null>(null);
  const [comparison, setComparison] = useState<RunComparison | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>("trace");
  const [selectedCheckpointStep, setSelectedCheckpointStep] = useState<number>(2);
  const [isReplayedSuccess, setIsReplayedSuccess] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let active = true;
    async function loadData() {
      setLoading(true);
      try {
        const runData = await getRunById(runId);
        if (active) setRun(runData);

        const diagData = await getDiagnosis(runId);
        if (active) setDiagnosis(diagData);

        const compData = await getRunComparison(runId, "run-4f81c9a0");
        if (active && compData) setComparison(compData);
      } catch (err) {
        console.error("Failed to load run detail data:", err);
      } finally {
        if (active) setLoading(false);
      }
    }
    loadData();
    return () => {
      active = false;
    };
  }, [runId]);

  const handleSelectCheckpoint = (step: TraceStep) => {
    setSelectedCheckpointStep(step.step_index ?? step.step_idx ?? 0);
    setActiveTab("replay");
  };

  const handleRewindFromDiagnosis = (stepIndex: number) => {
    setSelectedCheckpointStep(stepIndex);
    setActiveTab("replay");
  };

  const handleReplayComplete = async (job: ReplayJob) => {
    setIsReplayedSuccess(true);
    try {
      const compData = await getRunComparison(runId, job.replayed_run_id || "run-4f81c9a0");
      if (compData) {
        setComparison(compData);
      }
    } catch (e) {
      console.warn("Could not load replayed comparison:", e);
    }
    // Switch to comparison tab to show verification & diff
    setTimeout(() => {
      setActiveTab("comparison");
    }, 600);
  };

  if (loading) {
    return (
      <div className="py-24 text-center font-mono space-y-3">
        <div className="inline-block w-6 h-6 border-2 border-ink border-t-transparent rounded-full animate-spin" />
        <div className="text-xs text-ink/60">[LOADING FLIGHT JOURNAL FOR {runId}...]</div>
      </div>
    );
  }

  if (!run) {
    return (
      <div className="py-16 text-center font-mono space-y-4">
        <div className="text-sm font-bold text-danger">[ERROR: FLIGHT RECORD NOT FOUND]</div>
        <p className="text-xs text-ink/60">No execution trace exists for run ID &quot;{runId}&quot;.</p>
        <Link
          href="/runs"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-ink text-canvas rounded-[3px]"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Return to Flight Index</span>
        </Link>
      </div>
    );
  }

  const rootCauseIndex = diagnosis?.root_cause_step_index ?? 2;

  return (
    <div className="font-mono space-y-6">
      {/* Top Breadcrumb & Metadata Header */}
      <div className="flex flex-col gap-3 pb-4 border-b border-hairline">
        <div className="flex items-center justify-between">
          <Link
            href="/runs"
            className="flex items-center gap-1 text-xs text-ink/60 hover:text-ink transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>back to runs</span>
          </Link>

          <div className="flex items-center gap-2">
            {isReplayedSuccess && (
              <span className="text-[10px] px-2 py-0.5 bg-emerald-500/10 text-emerald-700 border border-emerald-500/30 rounded-[3px] font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                COUNTERFACTUAL VERIFIED
              </span>
            )}
            <AsciiBadge status={run.status} />
          </div>
        </div>

        {/* Title & Task Summary */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-ink break-all">
                {run.id}
              </h1>
              <span className="text-ink/40">/</span>
              <span className="text-sm sm:text-base font-semibold text-ink/80">
                {run.agent_name}
              </span>
            </div>
            <p className="text-xs text-ink/70 mt-1 max-w-3xl">
              <span className="font-bold text-ink/90">Task:</span> {run.task}
            </p>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-3 gap-2 sm:gap-4 text-xs border border-hairline bg-surface-card p-2.5 rounded-[4px] w-full sm:w-auto shrink-0">
            <div>
              <span className="text-[10px] text-ink/50 uppercase block">Frames</span>
              <span className="font-bold text-ink">{(run.steps || []).length} steps</span>
            </div>
            <div className="border-l border-hairline pl-2 sm:pl-4">
              <span className="text-[10px] text-ink/50 uppercase block">Duration</span>
              <span className="font-bold text-ink">{run.duration_ms}ms</span>
            </div>
            <div className="border-l border-hairline pl-2 sm:pl-4">
              <span className="text-[10px] text-ink/50 uppercase block">Checkpoints</span>
              <span className="font-bold text-ink">
                {(run.steps || []).filter((s) => s.checkpoint_id).length} snapshots
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Flight Recorder Stage Tabs (The Continuous Debugging Pipeline) */}
      <div className="flex items-center gap-2 border-b border-hairline pb-2 overflow-x-auto text-xs no-scrollbar">
        <button
          onClick={() => setActiveTab("trace")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[3px] transition-all whitespace-nowrap shrink-0 ${
            activeTab === "trace"
              ? "bg-ink text-canvas font-bold shadow-xs"
              : "border border-hairline text-ink/70 hover:bg-surface-soft hover:text-ink"
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>1. Execution Trace ({(run.steps || []).length})</span>
        </button>

        <button
          onClick={() => setActiveTab("diagnosis")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[3px] transition-all whitespace-nowrap ${
            activeTab === "diagnosis"
              ? "bg-ink text-canvas font-bold shadow-xs"
              : "border border-hairline text-ink/70 hover:bg-surface-soft hover:text-ink"
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-warning" />
          <span>2. Failure Diagnosis</span>
          {diagnosis && (
            <span
              className={`text-[9px] px-1 py-0.2 rounded-[2px] ${
                activeTab === "diagnosis" ? "bg-warning text-ink" : "bg-warning/20 text-warning"
              }`}
            >
              94% ROOT
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("replay")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[3px] transition-all whitespace-nowrap ${
            activeTab === "replay"
              ? "bg-ink text-canvas font-bold shadow-xs"
              : "border border-hairline text-ink/70 hover:bg-surface-soft hover:text-ink"
          }`}
        >
          <RotateCcw className="w-3.5 h-3.5 text-accent" />
          <span>3. Time Machine / Replay</span>
          <span
            className={`text-[9px] px-1 py-0.2 rounded-[2px] ${
              activeTab === "replay" ? "bg-accent text-canvas" : "bg-accent/15 text-accent"
            }`}
          >
            STEP {selectedCheckpointStep}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("comparison")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[3px] transition-all whitespace-nowrap ${
            activeTab === "comparison"
              ? "bg-ink text-canvas font-bold shadow-xs"
              : "border border-hairline text-ink/70 hover:bg-surface-soft hover:text-ink"
          }`}
        >
          <GitCompare className="w-3.5 h-3.5" />
          <span>4. Verification & Trace Diff</span>
          {isReplayedSuccess && (
            <span className="text-[9px] px-1 py-0.2 rounded-[2px] bg-emerald-500 text-canvas font-bold">
              VERIFIED
            </span>
          )}
        </button>
      </div>

      {/* Tab Panels */}
      <div>
        {activeTab === "trace" && (
          <div className="space-y-4">
            {/* Quick alert bar pointing to failure diagnosis */}
            {diagnosis && (
              <div className="p-3 border border-warning/40 bg-warning/[0.04] rounded-[3px] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 text-ink">
                  <AlertTriangle className="w-4 h-4 text-warning shrink-0" />
                  <span className="leading-relaxed">
                    Root cause detected at <strong>Step {diagnosis.root_cause_step_index} ({diagnosis.root_cause_node})</strong> with 94% confidence.
                  </span>
                </div>
                <button
                  onClick={() => setActiveTab("diagnosis")}
                  className="text-xs text-warning font-bold hover:underline flex items-center gap-1 shrink-0 self-end sm:self-auto"
                >
                  <span>Inspect Diagnosis</span>
                  <span>›</span>
                </button>
              </div>
            )}

            <ExecutionTimeline
              steps={run.steps || []}
              rootCauseStepIndex={rootCauseIndex}
              onSelectCheckpoint={handleSelectCheckpoint}
            />
          </div>
        )}

        {activeTab === "diagnosis" && diagnosis && (
          <DiagnosisPanel
            diagnosis={diagnosis}
            onRewindToStep={handleRewindFromDiagnosis}
          />
        )}

        {activeTab === "replay" && (
          <ReplayStudio
            runId={run.id}
            steps={run.steps || []}
            defaultStepIndex={selectedCheckpointStep}
            onReplayComplete={handleReplayComplete}
          />
        )}

        {activeTab === "comparison" && (
          comparison ? (
            <TraceDiffView comparison={comparison} />
          ) : (
            <div className="py-12 text-center border border-hairline bg-surface-card rounded-[4px] space-y-2">
              <div className="text-xs font-bold text-ink">[NO COMPARISON RECORD AVAILABLE]</div>
              <p className="text-[11px] text-ink/60">
                Execute a replay with a counterfactual patch to compare executions.
              </p>
            </div>
          )
        )}
      </div>
    </div>
  );
}
