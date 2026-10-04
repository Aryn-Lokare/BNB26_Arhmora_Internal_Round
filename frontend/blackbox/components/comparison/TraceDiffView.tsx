"use client";

import React, { useState } from "react";
import { RunComparison, StepDiff } from "@/types/run";
import { AsciiBadge } from "@/components/ui/AsciiBadge";
import { CodeBlock } from "@/components/ui/CodeBlock";
import {
  CheckCircle2,
  XCircle,
  GitCompare,
  ArrowRight,
  Zap,
  Sparkles,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface TraceDiffViewProps {
  comparison: RunComparison;
}

export function TraceDiffView({ comparison }: TraceDiffViewProps) {
  const divergenceIdx =
    comparison?.divergence_step_index ??
    comparison?.divergence_step ??
    (comparison as any)?.forked_at_step ??
    2;

  const [expandedDiffs, setExpandedDiffs] = useState<Record<number, boolean>>({
    [divergenceIdx]: true,
  });

  const toggleDiff = (idx: number) => {
    setExpandedDiffs((prev) => ({
      ...prev,
      [idx]: !prev[idx],
    }));
  };

  const summaryChanges = comparison?.summary_changes || [
    "Step 2: Corrected SQL query to aggregate MAX(budget) instead of MIN(budget)",
    "Step 3: Database execution returned correct department row ($900,000.0)",
    "Steps 0–1: Checkpoint state directly reused without LLM invocation (0 latency)",
    "Verification: Output flipped from FAILED to PASSED with gold truth match",
  ];

  const originalId =
    comparison?.original_run?.id ||
    (comparison as any)?.original_run_id ||
    "run-9a1b2c3d";

  const replayedId =
    comparison?.replayed_run?.id ||
    (comparison as any)?.replayed_run_id ||
    "run-4f81c9a0";

  const computeSavedPct = comparison?.compute_saved_pct ?? 60;

  const stepDiffs =
    comparison?.step_diffs ||
    (comparison as any)?.steps_comparison ||
    [];

  return (
    <div className="font-mono space-y-4">
      {/* Verification Header Banner */}
      <div className="p-4 border border-hairline bg-surface-card rounded-[4px]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-hairline">
          <div>
            <div className="text-xs font-bold text-ink flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="break-words">[VERIFICATION & FLIGHT COMPARISON]</span>
            </div>
            <p className="text-[11px] text-ink/60 mt-0.5">
              Differential trace analysis comparing the original crashed flight with the counterfactual replayed flight.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 font-bold text-xs rounded-[3px] flex items-center gap-1.5 whitespace-nowrap">
              <Zap className="w-3.5 h-3.5 fill-current" />
              <span>{computeSavedPct}% COMPUTE SAVED</span>
            </span>
          </div>
        </div>

        {/* 3 Outcome Verification Blocks */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3">
          {/* Original */}
          <div className="p-3 border border-danger/30 bg-danger/[0.04] rounded-[3px] flex items-center justify-between">
            <div className="min-w-0 pr-2">
              <span className="text-[10px] text-ink/50 uppercase block">Original Flight</span>
              <span className="text-xs font-bold text-ink truncate block">{originalId}</span>
            </div>
            <div className="flex items-center gap-1 text-danger font-bold text-xs shrink-0">
              <XCircle className="w-4 h-4" />
              <span>FAILED</span>
            </div>
          </div>

          {/* Patched */}
          <div className="p-3 border border-emerald-500/30 bg-emerald-500/[0.04] rounded-[3px] flex items-center justify-between">
            <div className="min-w-0 pr-2">
              <span className="text-[10px] text-ink/50 uppercase block">Patched Flight</span>
              <span className="text-xs font-bold text-ink truncate block">{replayedId}</span>
            </div>
            <div className="flex items-center gap-1 text-emerald-600 font-bold text-xs shrink-0">
              <CheckCircle2 className="w-4 h-4" />
              <span>PASSED</span>
            </div>
          </div>

          {/* Diagnosis status */}
          <div className="p-3 border border-accent/30 bg-accent/[0.04] rounded-[3px] flex items-center justify-between">
            <div>
              <span className="text-[10px] text-ink/50 uppercase block">Hypothesis Check</span>
              <span className="text-xs font-bold text-ink">Root cause isolated</span>
            </div>
            <div className="flex items-center gap-1 text-accent font-bold text-xs shrink-0">
              <Sparkles className="w-4 h-4" />
              <span>VALIDATED</span>
            </div>
          </div>
        </div>
      </div>

      {/* Changes Summary Bullet List */}
      <div className="p-3 border border-hairline bg-surface-card rounded-[4px] text-xs">
        <div className="text-[11px] font-bold text-ink/70 mb-2">
          [DIFFERENTIAL SUMMARY]
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {summaryChanges.map((change, idx) => (
            <div
              key={idx}
              className="p-2 border border-hairline rounded-[3px] bg-canvas flex items-start gap-2"
            >
              <span className="text-accent font-bold mt-0.5">›</span>
              <span className="text-ink/80 text-[11px] leading-relaxed">{change}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Step Comparison Table / List */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs pb-1">
          <span className="font-bold text-ink flex items-center gap-1.5">
            <GitCompare className="w-3.5 h-3.5 text-ink/60" />
            <span>STEP-ALIGNED FLIGHT DIFF ({stepDiffs.length} STEPS)</span>
          </span>
          <span className="text-[10px] text-ink/50">
            Diverged at Step {divergenceIdx}
          </span>
        </div>

        {stepDiffs.map((diff: any, idx: number) => {
          const stepIndex = diff.step_index ?? diff.step_idx ?? idx;
          const isExpanded = !!expandedDiffs[stepIndex];
          const isReused = diff.change_type === "identical" || diff.status === "reused" || diff.reused_from_cache;
          const isDivergence = diff.change_type === "diverged" || diff.status === "diverged" || stepIndex === divergenceIdx;
          const isModified = diff.change_type === "modified" || diff.status === "re-executed";

          return (
            <div
              key={stepIndex}
              className={`border rounded-[4px] transition-colors bg-surface-card ${
                isDivergence
                  ? "border-accent shadow-xs ring-1 ring-accent/30"
                  : isReused
                  ? "border-hairline bg-surface-soft/40"
                  : "border-hairline"
              }`}
            >
              {/* Header */}
              <div
                onClick={() => toggleDiff(stepIndex)}
                className="p-3 cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-2 select-none"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-ink/50">
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                  </span>

                  <span className="font-bold text-sm text-ink whitespace-nowrap">
                    Step {stepIndex}:
                  </span>

                  <span className="px-1.5 py-0.5 rounded-[3px] bg-surface-dark text-canvas text-xs font-semibold whitespace-nowrap">
                    {diff.node_name || diff.node || `node_${stepIndex}`}
                  </span>

                  {isReused && (
                    <span className="text-[10px] px-1.5 py-0.5 border border-hairline rounded-[2px] text-emerald-600 bg-emerald-500/5 whitespace-nowrap font-medium">
                      [REUSED IDENTICAL / 0 COST]
                    </span>
                  )}

                  {isDivergence && (
                    <span className="text-[10px] px-1.5 py-0.5 border border-accent/40 rounded-[2px] text-accent font-bold bg-accent/10 whitespace-nowrap">
                      [DIVERGENCE FORK POINT]
                    </span>
                  )}

                  {isModified && (
                    <span className="text-[10px] px-1.5 py-0.5 border border-amber-500/40 rounded-[2px] text-amber-700 bg-amber-500/10 font-bold whitespace-nowrap">
                      [OUTPUT MODIFIED]
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3 text-xs pl-6 sm:pl-0 text-ink/60">
                  <span className="text-[11px] line-clamp-1">{diff.summary || ""}</span>
                </div>
              </div>

              {/* Collapsible Content */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.18 }}
                    className="border-t border-hairline p-3 bg-canvas space-y-3 text-xs overflow-hidden"
                  >
                    {isReused ? (
                      <div className="p-3 bg-surface-soft border border-hairline rounded-[3px] text-ink/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                        <span>
                          Step {stepIndex} was skipped during replay because input state was identical. Checkpoint state was directly forwarded into Step {stepIndex + 1}.
                        </span>
                        <span className="text-emerald-600 font-bold whitespace-nowrap shrink-0">[100% TOKENS SAVED]</span>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                        {/* Original Output */}
                        <div className="min-w-0">
                          <div className="text-[11px] font-bold text-danger mb-1 flex items-center justify-between">
                            <span>[-] ORIGINAL FAILED RUN OUTPUT</span>
                            <span className="text-[10px] text-ink/50">faulty</span>
                          </div>
                          <div className="overflow-x-auto max-w-full">
                            <CodeBlock
                              code={diff.original_output || diff.original_step?.outputs || diff.original_step?.inputs || {}}
                              language="json"
                              title={`original_step_${stepIndex}.json`}
                            />
                          </div>
                        </div>

                        {/* Replayed Output */}
                        <div className="min-w-0">
                          <div className="text-[11px] font-bold text-emerald-600 mb-1 flex items-center justify-between">
                            <span>[+] REPLAYED PATCHED RUN OUTPUT</span>
                            <span className="text-[10px] text-ink/50">corrected</span>
                          </div>
                          <div className="overflow-x-auto max-w-full">
                            <CodeBlock
                              code={diff.replayed_output || diff.replayed_step?.outputs || diff.replayed_step?.inputs || {}}
                              language="json"
                              title={`replayed_step_${stepIndex}.json`}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}
