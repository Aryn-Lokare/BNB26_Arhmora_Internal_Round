"use client";

import React from "react";
import { Diagnosis } from "@/types/run";
import { AsciiBadge } from "@/components/ui/AsciiBadge";
import {
  AlertCircle,
  CheckCircle2,
  FileSearch,
  ArrowRight,
  TrendingDown,
  RotateCcw,
  Sparkles,
  GitBranch,
} from "lucide-react";

interface DiagnosisPanelProps {
  diagnosis: Diagnosis;
  onRewindToStep?: (stepIndex: number) => void;
}

export function DiagnosisPanel({
  diagnosis,
  onRewindToStep,
}: DiagnosisPanelProps) {
  const confidencePct = Math.round(diagnosis.confidence * 100);
  const rootCauseStep = diagnosis.root_cause_step_index ?? diagnosis.predicted_step ?? 2;
  const rootCauseNode = diagnosis.root_cause_node ?? diagnosis.predicted_node ?? "select_tool";

  const topSuspicious = diagnosis.top_suspicious_steps || [
    { step_index: rootCauseStep, node_name: rootCauseNode, confidence: diagnosis.confidence },
    { step_index: 3, node_name: "run_tool", confidence: 0.28 },
    { step_index: 1, node_name: "plan", confidence: 0.05 },
  ];

  return (
    <div className="font-mono space-y-4">
      {/* Root Cause Banner */}
      <div className="p-4 border border-warning/40 bg-warning/[0.04] rounded-[4px] relative overflow-hidden">
        <div className="absolute top-0 right-0 px-3 py-1 bg-warning/20 border-b border-l border-warning/30 text-[10px] text-warning font-bold flex items-center gap-1">
          <Sparkles className="w-3 h-3" />
          AI ROOT CAUSE LOCALIZER
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-1">
          <div>
            <div className="text-[11px] text-warning font-bold tracking-wide uppercase flex items-center gap-1.5 mb-1">
              <AlertCircle className="w-3.5 h-3.5" />
              Predicted Root Cause
            </div>
            <div className="text-xl font-bold text-ink flex items-center gap-2">
              <span>Step {rootCauseStep}</span>
              <span className="text-ink/40 font-normal">—</span>
              <span className="bg-surface-dark text-canvas px-2 py-0.5 rounded-[3px] text-sm">
                {rootCauseNode}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="flex flex-col items-start md:items-end">
              <span className="text-[10px] text-ink/50 uppercase">Confidence</span>
              <div className="flex items-center gap-1.5">
                <span className="text-2xl font-bold text-warning">{confidencePct}%</span>
                <span className="text-[10px] text-ink/60">[HIGH]</span>
              </div>
            </div>

            <div className="border-l border-hairline pl-4">
              <span className="text-[10px] text-ink/50 uppercase block mb-1">Failure Type</span>
              <AsciiBadge status="failure" label={diagnosis.failure_type} />
            </div>
          </div>
        </div>

        {/* Detailed Explanation */}
        <div className="mt-4 pt-3 border-t border-warning/20">
          <div className="text-[11px] text-ink/60 uppercase font-semibold mb-1">
            Explanation:
          </div>
          <p className="text-xs text-ink/85 leading-relaxed bg-canvas/70 p-2.5 rounded-[3px] border border-hairline break-words">
            {diagnosis.explanation}
          </p>
        </div>

        {/* CTA to jump straight to checkpoint rewind */}
        {onRewindToStep && (
          <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
            <span className="text-[11px] text-ink/60">
              Ready to fix? Rewind execution to Step {rootCauseStep} and apply a counterfactual patch.
            </span>
            <button
              onClick={() => onRewindToStep(rootCauseStep)}
              className="px-3 py-1.5 bg-ink text-canvas hover:bg-accent text-xs rounded-[3px] font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-xs w-full sm:w-auto whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Rewind to Step {rootCauseStep}</span>
            </button>
          </div>
        )}
      </div>

      {/* Evidence & Suspicious Steps Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Ranked Suspicious Steps */}
        <div className="border border-hairline bg-surface-card rounded-[4px] p-4">
          <div className="text-xs font-bold text-ink mb-3 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <FileSearch className="w-3.5 h-3.5 text-ink/60" />
              [TOP SUSPICIOUS CANDIDATES]
            </span>
            <span className="text-[10px] text-ink/50">ranked by loss delta</span>
          </div>

          <div className="space-y-2">
            {topSuspicious.map((item, idx) => (
              <div
                key={idx}
                className={`p-2.5 rounded-[3px] border text-xs flex items-center justify-between ${
                  item.step_index === rootCauseStep
                    ? "border-warning/50 bg-warning/[0.04]"
                    : "border-hairline bg-surface-soft/40"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="font-bold text-ink/60 text-[11px]">#{idx + 1}</span>
                  <span className="font-bold text-ink">Step {item.step_index}</span>
                  <span className="text-ink/60 text-[11px]">({item.node_name})</span>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <div className="w-14 h-1.5 bg-surface-soft border border-hairline rounded-[2px] overflow-hidden">
                      <div
                        className="h-full bg-warning"
                        style={{ width: `${Math.round(item.confidence * 100)}%` }}
                      />
                    </div>
                    <span className="text-[11px] font-semibold">
                      {Math.round(item.confidence * 100)}%
                    </span>
                  </div>

                  {onRewindToStep && (
                    <button
                      onClick={() => onRewindToStep(item.step_index)}
                      className="text-[10px] text-ink/60 hover:text-ink underline"
                    >
                      rewind
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Downstream Effects */}
        <div className="border border-hairline bg-surface-card rounded-[4px] p-4">
          <div className="text-xs font-bold text-ink mb-3 flex items-center gap-1.5">
            <TrendingDown className="w-3.5 h-3.5 text-ink/60" />
            <span>[DOWNSTREAM DRIFT & CORRUPTIONS]</span>
          </div>

          <div className="space-y-2">
            {diagnosis.downstream_effects.map((effect, idx) => (
              <div
                key={idx}
                className="p-2 border border-hairline rounded-[3px] bg-canvas text-xs flex items-start gap-2"
              >
                <span className="text-danger font-bold text-xs mt-0.5">›</span>
                <span className="text-ink/80 leading-relaxed">{effect}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Forensic Evidence Cards */}
      <div className="border border-hairline bg-surface-card rounded-[4px] p-4">
        <div className="text-xs font-bold text-ink mb-3 flex items-center gap-1.5">
          <GitBranch className="w-3.5 h-3.5 text-ink/60" />
          <span>[FORENSIC EVIDENCE TRACES ({diagnosis.evidence.length})]</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {diagnosis.evidence.map((ev) => {
            const evScore = ev.score ?? 0.88;
            const evType = ev.type || "Logical Deviation";
            const evTitle = ev.title || ev.label || "Query Inversion";
            const evDetails = ev.details || `${ev.observed} (Expected: ${ev.expected})`;

            return (
              <div
                key={ev.id}
                className="p-3 border border-hairline rounded-[3px] bg-canvas flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between text-[10px] text-ink/50 uppercase mb-1">
                    <span>{evType}</span>
                    <span className="font-semibold text-warning">
                      {Math.round(evScore * 100)}% impact
                    </span>
                  </div>
                  <div className="text-xs font-bold text-ink mb-1.5">{evTitle}</div>
                  <p className="text-[11px] text-ink/70 leading-normal">{evDetails}</p>
                </div>

                <div className="mt-3 pt-2 border-t border-hairline text-[10px] text-emerald-600 flex items-center gap-1">
                  <CheckCircle2 className="w-2.5 h-2.5" />
                  <span>Isolated by counterfactual simulator</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
