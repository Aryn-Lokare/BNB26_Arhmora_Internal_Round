"use client";

import React, { useState } from "react";
import { TraceStep } from "@/types/run";
import { AsciiBadge } from "@/components/ui/AsciiBadge";
import { CodeBlock } from "@/components/ui/CodeBlock";
import {
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  RotateCcw,
  Clock,
  Database,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface ExecutionTimelineProps {
  steps: TraceStep[];
  onSelectCheckpoint?: (step: TraceStep) => void;
  rootCauseStepIndex?: number;
}

export function ExecutionTimeline({
  steps,
  onSelectCheckpoint,
  rootCauseStepIndex = 2,
}: ExecutionTimelineProps) {
  const [expandedSteps, setExpandedSteps] = useState<Record<number, boolean>>({
    [rootCauseStepIndex]: true,
  });

  const toggleStep = (idx: number) => {
    setExpandedSteps((prev) => ({
      ...prev,
      [idx]: !prev[idx],
    }));
  };

  const expandAll = () => {
    const all: Record<number, boolean> = {};
    steps.forEach((s) => {
      const idx = s.step_index ?? s.step_idx ?? 0;
      all[idx] = true;
    });
    setExpandedSteps(all);
  };

  const collapseAll = () => {
    setExpandedSteps({});
  };

  return (
    <div className="font-mono flex flex-col gap-3">
      {/* Controls Header */}
      <div className="flex items-center justify-between pb-2 border-b border-hairline text-xs">
        <div className="flex items-center gap-2">
          <span className="text-ink font-bold">[TIMELINE]</span>
          <span className="text-ink/60">{steps.length} sequential execution frames</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={expandAll}
            className="px-2 py-0.5 border border-hairline rounded-[3px] text-ink/70 hover:text-ink hover:bg-surface-soft text-[11px]"
          >
            expand all
          </button>
          <button
            onClick={collapseAll}
            className="px-2 py-0.5 border border-hairline rounded-[3px] text-ink/70 hover:text-ink hover:bg-surface-soft text-[11px]"
          >
            collapse all
          </button>
        </div>
      </div>

      {/* Step List */}
      <div className="relative pl-7 sm:pl-8 space-y-3 before:absolute before:left-[13px] before:top-2 before:bottom-2 before:w-[1px] before:bg-hairline">
        {steps.map((step) => {
          const stepIndex = step.step_index ?? step.step_idx ?? 0;
          const isExpanded = !!expandedSteps[stepIndex];
          const isRootCause = step.is_suspicious || step.is_suspect || stepIndex === rootCauseStepIndex;
          const failureProb = step.failure_probability || 0;
          const nodeName = step.node_name || step.node;
          const duration = step.duration_ms ?? step.latency_ms ?? 0;
          const inputs = step.inputs || step.input || {};
          const outputs = step.outputs || step.output || {};

          return (
            <motion.div
              key={stepIndex}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.15 }}
              className={`relative border rounded-[4px] transition-all bg-surface-card min-w-0 ${
                isRootCause
                  ? "border-warning/60 shadow-xs ring-1 ring-warning/30 bg-warning/[0.02]"
                  : "border-hairline hover:border-ink/20"
              }`}
            >
              {/* Timeline Node Indicator on line */}
              <div
                className={`absolute -left-[27px] top-3.5 w-4 h-4 rounded-full border flex items-center justify-center text-[9px] bg-canvas z-10 shrink-0 ${
                  isRootCause
                    ? "border-warning text-warning font-bold ring-2 ring-warning/20"
                    : step.status === "failed" || step.is_suspect
                    ? "border-danger text-danger font-bold"
                    : "border-ink/40 text-ink/70"
                }`}
              >
                {stepIndex}
              </div>

              {/* Step Card Header */}
              <div
                onClick={() => toggleStep(stepIndex)}
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
                    {nodeName}
                  </span>

                  {step.tool_name && (
                    <span className="text-xs text-ink/70 flex items-center gap-1">
                      <span>›</span>
                      <span className="underline decoration-dotted">{step.tool_name}</span>
                    </span>
                  )}

                  {isRootCause && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-warning/15 border border-warning/40 text-warning text-[10px] rounded-[3px] font-bold animate-pulse whitespace-nowrap">
                      <AlertTriangle className="w-3 h-3" />
                      PREDICTED ROOT CAUSE
                    </span>
                  )}
                </div>

                {/* Right Meta details */}
                <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs pl-6 sm:pl-0">
                  {/* Probability meter if present */}
                  {failureProb > 0 && (
                    <div className="flex items-center gap-1.5" title={`Failure probability: ${Math.round(failureProb * 100)}%`}>
                      <span className="text-[10px] text-ink/50">P(ERR):</span>
                      <div className="w-12 h-2 bg-surface-soft border border-hairline rounded-[2px] overflow-hidden">
                        <div
                          className={`h-full ${
                            failureProb > 0.8
                              ? "bg-warning"
                              : failureProb > 0.4
                              ? "bg-amber-400"
                              : "bg-emerald-400"
                          }`}
                          style={{ width: `${Math.round(failureProb * 100)}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-semibold">
                        {Math.round(failureProb * 100)}%
                      </span>
                    </div>
                  )}

                  <div className="flex items-center gap-1 text-ink/50 text-[11px] whitespace-nowrap">
                    <Clock className="w-3 h-3" />
                    <span>{duration}ms</span>
                  </div>

                  <AsciiBadge status={step.status || (step.is_suspect ? "failed" : "success")} />

                  {onSelectCheckpoint && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectCheckpoint(step);
                      }}
                      className="flex items-center gap-1 px-2 py-0.5 text-[10px] border border-hairline rounded-[3px] bg-canvas hover:bg-ink hover:text-canvas transition-colors ml-1 whitespace-nowrap"
                      title="Rewind execution to this checkpoint"
                    >
                      <RotateCcw className="w-2.5 h-2.5" />
                      <span>rewind</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Collapsible Details Body */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.18 }}
                    className="border-t border-hairline p-3 bg-surface-soft/40 space-y-3 text-xs overflow-hidden"
                  >
                    {/* Checkpoint ID banner */}
                    {step.checkpoint_id && (
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 px-2.5 py-1.5 bg-canvas border border-hairline rounded-[3px] text-[11px] text-ink/70">
                        <div className="flex items-center gap-1.5">
                          <Database className="w-3 h-3 text-ink/50 shrink-0" />
                          <span className="text-ink/50">Checkpoint:</span>
                          <span className="font-semibold text-ink">{step.checkpoint_id}</span>
                        </div>
                        <span className="text-[10px] text-emerald-600 font-medium">
                          [STATE SNAPSHOT PRESERVED]
                        </span>
                      </div>
                    )}

                    {/* Inputs and Outputs Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                      <div className="min-w-0">
                        <div className="text-[11px] font-bold text-ink/70 mb-1 flex items-center justify-between">
                          <span>[INPUT PAYLOAD]</span>
                          <span className="text-[10px] font-normal text-ink/50">parameters</span>
                        </div>
                        <div className="overflow-x-auto max-w-full">
                          <CodeBlock
                            code={inputs}
                            language="json"
                            title={`step_${stepIndex}_input.json`}
                          />
                        </div>
                      </div>

                      <div className="min-w-0">
                        <div className="text-[11px] font-bold text-ink/70 mb-1 flex items-center justify-between">
                          <span>[OUTPUT ARTIFACT]</span>
                          <span className="text-[10px] font-normal text-ink/50">result / return</span>
                        </div>
                        <div className="overflow-x-auto max-w-full">
                          <CodeBlock
                            code={outputs}
                            language="json"
                            title={`step_${stepIndex}_output.json`}
                          />
                        </div>
                      </div>
                    </div>

                    {/* State Delta / Snapshots if available */}
                    {step.state_delta && Object.keys(step.state_delta).length > 0 && (
                      <div>
                        <div className="text-[11px] font-bold text-ink/70 mb-1">
                          [STATE DELTA RECORDED]
                        </div>
                        <CodeBlock
                          code={step.state_delta}
                          language="json"
                          title="state_mutation_delta"
                        />
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
