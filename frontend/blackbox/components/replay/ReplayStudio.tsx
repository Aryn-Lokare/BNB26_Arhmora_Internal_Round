"use client";

import React, { useState } from "react";
import { TraceStep, Patch, ReplayJob } from "@/types/run";
import { triggerReplay } from "@/services/api";
import { AsciiBadge } from "@/components/ui/AsciiBadge";
import { CodeBlock } from "@/components/ui/CodeBlock";
import {
  RotateCcw,
  Play,
  CheckCircle2,
  AlertCircle,
  Database,
  Sliders,
  Cpu,
  Zap,
  ArrowRight,
  GitFork,
} from "lucide-react";
import { motion } from "framer-motion";

interface ReplayStudioProps {
  runId: string;
  steps: TraceStep[];
  defaultStepIndex?: number;
  onReplayComplete?: (job: ReplayJob) => void;
}

export function ReplayStudio({
  runId,
  steps,
  defaultStepIndex = 2,
  onReplayComplete,
}: ReplayStudioProps) {
  const [selectedStepIndex, setSelectedStepIndex] = useState<number>(defaultStepIndex);
  const [isRewound, setIsRewound] = useState<boolean>(true);
  const [isReplaying, setIsReplaying] = useState<boolean>(false);
  const [replayProgress, setReplayProgress] = useState<number>(0);
  const [replayStageText, setReplayStageText] = useState<string>("");
  const [replayJob, setReplayJob] = useState<ReplayJob | null>(null);

  // Default suggested patch for SQL inversion demo
  const [patchCode, setPatchCode] = useState<string>(
    JSON.stringify(
      {
        action_input: {
          query: "SELECT department, budget FROM departments ORDER BY budget DESC LIMIT 1;",
        },
        mutation_rationale: "Fix query logic: replace MIN with MAX budget descending order",
      },
      null,
      2
    )
  );

  const selectedStep =
    steps.find((s) => (s.step_index ?? s.step_idx) === selectedStepIndex) ||
    steps[0] ||
    ({ step_index: 0, inputs: {}, outputs: {} } as any);

  const handleRewind = (stepIdx: number) => {
    setSelectedStepIndex(stepIdx);
    setIsRewound(true);
    setReplayJob(null);
  };

  const handleExecuteReplay = async () => {
    setIsReplaying(true);
    setReplayProgress(15);
    setReplayStageText("Restoring state snapshot from checkpoint chk-step-002...");

    // Simulated multi-stage progress
    setTimeout(() => {
      setReplayProgress(45);
      setReplayStageText("Reusing Steps 0–1 from deterministic record (0 execution cost)...");
    }, 450);

    setTimeout(() => {
      setReplayProgress(75);
      setReplayStageText("Injecting patched parameters at Step 2 and executing counterfactual graph...");
    }, 950);

    setTimeout(async () => {
      try {
        setReplayProgress(100);
        setReplayStageText("Validating final state and recording verification diff...");

        let parsedPatch: Patch = {
          step_index: selectedStepIndex,
          patch_type: "override_input",
          payload: { query: "SELECT department, budget FROM departments ORDER BY budget DESC LIMIT 1;" },
          description: "Replaced MIN with MAX budget query",
        };

        try {
          parsedPatch.payload = JSON.parse(patchCode);
        } catch (e) {
          console.warn("Patch JSON parse warning", e);
        }

        const job = await triggerReplay(runId, selectedStepIndex, parsedPatch);
        setReplayJob(job);
        setIsReplaying(false);
        if (onReplayComplete) {
          onReplayComplete(job);
        }
      } catch (err) {
        console.error("Replay execution failed:", err);
        setIsReplaying(false);
      }
    }, 1500);
  };

  return (
    <div className="font-mono space-y-4">
      {/* Top Controller Bar */}
      <div className="p-4 border border-hairline bg-surface-card rounded-[4px] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-bold text-ink flex items-center gap-2">
            <RotateCcw className="w-4 h-4 text-accent shrink-0" />
            <span className="break-words">[TIME MACHINE: STATE-REWIND & PATCH INJECTOR]</span>
          </div>
          <p className="text-[11px] text-ink/60 mt-1">
            Fork execution at any past checkpoint, inject modified inputs or tools, and deterministically replay the future.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            onClick={() => handleRewind(selectedStepIndex)}
            className="px-3 py-1.5 border border-hairline rounded-[3px] bg-canvas hover:bg-surface-soft text-xs flex items-center gap-1.5 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5 text-ink/70" />
            <span>Reset State</span>
          </button>

          <button
            disabled={isReplaying}
            onClick={handleExecuteReplay}
            className={`px-4 py-1.5 rounded-[3px] text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors whitespace-nowrap ${
              isReplaying
                ? "bg-ink/30 text-canvas cursor-wait"
                : "bg-ink text-canvas hover:bg-accent"
            }`}
          >
            {isReplaying ? (
              <>
                <Cpu className="w-3.5 h-3.5 animate-spin" />
                <span>Replaying...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Apply Patch & Replay</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Checkpoint Scrubber / Step Selector */}
      <div className="border border-hairline bg-surface-card rounded-[4px] p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs mb-3">
          <span className="font-bold text-ink flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-ink/60" />
            <span>SELECT FORK CHECKPOINT: STEP {selectedStepIndex}</span>
          </span>
          <span className="text-[10px] text-ink/50">
            {selectedStepIndex} steps will be reused (0 cost)
          </span>
        </div>

        {/* Step Scrubber Pills */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
          {steps.map((step) => {
            const stepIdx = step.step_index ?? step.step_idx ?? 0;
            const isSelected = stepIdx === selectedStepIndex;
            const isPrior = stepIdx < selectedStepIndex;
            const isSuspect = step.is_suspicious || stepIdx === 2;

            return (
              <button
                key={stepIdx}
                onClick={() => setSelectedStepIndex(stepIdx)}
                className={`p-2 rounded-[3px] border text-left transition-all relative ${
                  isSelected
                    ? "border-accent bg-accent/10 ring-1 ring-accent"
                    : isPrior
                    ? "border-hairline bg-surface-soft/60 hover:bg-canvas"
                    : "border-hairline bg-canvas hover:border-ink/20"
                }`}
              >
                <div className="flex items-center justify-between text-[10px] mb-1">
                  <span className="font-bold text-ink">Step {stepIdx}</span>
                  {isSuspect && (
                    <span className="text-[9px] px-1 bg-warning/20 text-warning rounded-[2px] font-bold">
                      ROOT
                    </span>
                  )}
                </div>
                <div className="text-[11px] truncate text-ink/70">{step.node_name || step.node}</div>
                <div className="text-[9px] text-ink/40 mt-1 flex items-center gap-1">
                  {isPrior ? (
                    <span className="text-emerald-600">[REUSED]</span>
                  ) : isSelected ? (
                    <span className="text-accent font-bold">[FORK POINT]</span>
                  ) : (
                    <span>[RE-RUN]</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Replay Progress Tracker if active */}
      {isReplaying && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 border border-accent/40 bg-accent/[0.04] rounded-[4px] space-y-2"
        >
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-accent flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 animate-bounce" />
              <span>DETERMINISTIC FLIGHT REPLAY IN PROGRESS</span>
            </span>
            <span className="text-xs font-bold text-accent">{replayProgress}%</span>
          </div>

          <div className="w-full h-2 bg-surface-soft border border-hairline rounded-[2px] overflow-hidden">
            <motion.div
              className="h-full bg-accent"
              initial={{ width: 0 }}
              animate={{ width: `${replayProgress}%` }}
              transition={{ ease: "easeInOut", duration: 0.3 }}
            />
          </div>

          <div className="text-[11px] text-ink/70 flex items-center gap-1.5 pt-1">
            <span className="animate-spin">◒</span>
            <span>{replayStageText}</span>
          </div>
        </motion.div>
      )}

      {/* Side-by-side State & Patch Editor */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: Original State at Checkpoint */}
        <div className="border border-hairline bg-surface-card rounded-[4px] p-4 flex flex-col justify-between min-w-0 overflow-hidden">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center justify-between text-xs font-bold text-ink mb-2 gap-2">
              <span className="flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-ink/60 shrink-0" />
                <span>ORIGINAL RECORDED INPUT (STEP {selectedStepIndex})</span>
              </span>
              <span className="text-[10px] text-danger font-semibold">[FAULTY LOGIC]</span>
            </div>
            <p className="text-[11px] text-ink/60 mb-2">
              The exact arguments executed during the original recorded flight run:
            </p>
            <div className="overflow-x-auto max-w-full">
              <CodeBlock
                code={selectedStep.inputs || selectedStep.input || {}}
                language="json"
                title={`original_step_${selectedStepIndex}_input.json`}
              />
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-hairline flex flex-wrap items-center justify-between gap-1 text-[11px] text-ink/60">
            <span>Snapshot ID: {selectedStep.checkpoint_id || "chk-default"}</span>
            <span className="text-emerald-600 font-semibold">[PERSISTED ON DISK]</span>
          </div>
        </div>

        {/* Right: Interactive Patch Editor */}
        <div className="border border-accent/40 bg-surface-card rounded-[4px] p-4 flex flex-col justify-between min-w-0">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center justify-between text-xs font-bold text-ink mb-2 gap-2">
              <span className="flex items-center gap-1.5 text-accent">
                <GitFork className="w-3.5 h-3.5 shrink-0" />
                <span>PATCH INJECTION EDITOR</span>
              </span>
              <span className="text-[10px] px-1.5 py-0.5 bg-accent/15 text-accent rounded-[2px] font-bold">
                [READY TO INJECT]
              </span>
            </div>
            <p className="text-[11px] text-ink/60 mb-2">
              Modify the input payload to test the counterfactual fix:
            </p>

            <textarea
              rows={8}
              value={patchCode}
              onChange={(e) => setPatchCode(e.target.value)}
              className="w-full max-w-full p-3 font-mono text-xs bg-surface-dark text-[#f0eeee] border border-hairline rounded-[3px] focus:outline-none focus:ring-1 focus:ring-accent resize-none leading-relaxed"
              spellCheck={false}
            />
          </div>

          <div className="mt-3 pt-3 border-t border-hairline flex flex-wrap items-center justify-between gap-2 text-[11px]">
            <span className="text-ink/60">
              Injects into agent graph at Step {selectedStepIndex}
            </span>
            <button
              onClick={handleExecuteReplay}
              disabled={isReplaying}
              className="text-accent hover:underline flex items-center gap-1 font-semibold"
            >
              <span>Execute Replay</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Verification Result Card if replay was run */}
      {replayJob && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="p-4 border border-emerald-500/40 bg-emerald-500/[0.04] rounded-[4px] space-y-3"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-emerald-500/20">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-bold text-xs text-ink">
                [VERIFICATION COMPLETED: RUN FLIPPED TO PASSED]
              </span>
            </div>
            <div className="flex items-center gap-2">
              <AsciiBadge status="success" label="DIAGNOSIS VALIDATED" />
              <span className="text-xs font-bold text-emerald-700 whitespace-nowrap">
                {replayJob.compute_saved_pct}% Compute Saved
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-2.5 bg-canvas border border-hairline rounded-[3px] min-w-0">
              <span className="text-[10px] text-ink/50 uppercase block">Replayed Run ID</span>
              <span className="font-bold text-ink truncate block">{replayJob.replayed_run_id}</span>
            </div>
            <div className="p-2.5 bg-canvas border border-hairline rounded-[3px] min-w-0">
              <span className="text-[10px] text-ink/50 uppercase block">Reused Steps (0 ms)</span>
              <span className="font-bold text-emerald-600 truncate block">
                {replayJob.steps_reused} frames reused from checkpoint
              </span>
            </div>
            <div className="p-2.5 bg-canvas border border-hairline rounded-[3px] min-w-0">
              <span className="text-[10px] text-ink/50 uppercase block">Re-executed Frames</span>
              <span className="font-bold text-ink truncate block">
                {replayJob.steps_executed} frames patched & verified
              </span>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
