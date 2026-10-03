import React from "react";
import Link from "next/link";
import Image from "next/image";
import { getRuns } from "@/services/api";
import { StatCard } from "@/components/ui/StatCard";
import { AsciiBadge } from "@/components/ui/AsciiBadge";
import {
  AlertTriangle,
  ArrowRight,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Terminal,
  Activity,
  Layers,
  Sparkles,
  ExternalLink,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const runs = await getRuns();

  const totalRuns = runs.length;
  const failedRuns = runs.filter((r) => r.status === "failed");
  const successRuns = runs.filter((r) => r.status === "success");
  const replayedRuns = runs.filter((r) => r.status === "replayed");

  const avgDuration = Math.round(
    runs.reduce((acc, r) => acc + r.duration_ms, 0) / (totalRuns || 1)
  );

  return (
    <div className="space-y-8 font-mono">
      {/* Hero Section */}
      <section className="border border-hairline bg-surface-card rounded-[4px] p-6 lg:p-8 relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="flex items-center gap-2 text-xs text-ink/60">
              <span className="px-1.5 py-0.5 rounded-[2px] bg-ink text-canvas font-bold text-[10px]">
                LIVE SYSTEM
              </span>
              <span>›</span>
              <span>DETERMINISTIC FLIGHT RECORDER & DEBUGGER</span>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative w-10 h-10 rounded-[4px] overflow-hidden border border-hairline bg-surface-dark p-0.5 shadow-xs shrink-0">
                <Image
                  src="/blackbox-logo.jpg"
                  alt="Black Box Logo"
                  width={40}
                  height={40}
                  className="object-cover w-full h-full rounded-[2px]"
                />
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-ink">
                BLACK BOX — FLIGHT RECORDER FOR AI AGENTS
              </h1>
            </div>

            <p className="text-xs sm:text-sm text-ink/75 leading-relaxed">
              When an AI agent fails in production, don&apos;t guess what went wrong.
              Black Box continuously records deterministic execution frames, localizes root causes,
              and allows you to rewind back to any checkpoint, inject a patch, and replay the future.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link
                href="/runs/run-9a1b2c3d"
                className="px-4 py-2 bg-ink text-canvas hover:bg-accent text-xs rounded-[3px] font-semibold flex items-center gap-2 transition-colors shadow-xs"
              >
                <span>Launch Interactive Demo Run</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <Link
                href="/runs"
                className="px-3.5 py-2 border border-hairline rounded-[3px] bg-canvas hover:bg-surface-soft text-xs text-ink flex items-center gap-1.5 transition-colors"
              >
                <span>Browse All Recorded Runs</span>
                <span className="text-[10px] text-ink/50">({totalRuns})</span>
              </Link>
            </div>
          </div>

          {/* Hero TUI Visual / Status Panel */}
          <div className="w-full lg:w-96 border border-hairline bg-surface-dark text-canvas p-4 rounded-[4px] text-xs space-y-2.5 shadow-sm">
            <div className="flex items-center justify-between text-[11px] pb-2 border-b border-[#2b2727] text-[#888]">
              <span className="flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-accent" />
                <span>RECORDER_TELEMETRY.SYS</span>
              </span>
              <span className="text-emerald-400 font-bold">[ONLINE]</span>
            </div>

            <div className="space-y-1.5 text-[11px]">
              <div className="flex justify-between">
                <span className="text-[#888]">TARGET AGENT:</span>
                <span className="text-[#eee]">LangGraph v0.2</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#888]">STATE STORAGE:</span>
                <span className="text-[#eee]">SQLite + JSON Checkpoints</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#888]">TIME TRAVEL ENGINE:</span>
                <span className="text-accent font-semibold">Deterministic Replay</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#888]">ROOT CAUSE LOCALIZER:</span>
                <span className="text-[#eee]">Counterfactual Diff Engine</span>
              </div>
            </div>

            <div className="pt-2 border-t border-[#2b2727] flex items-center justify-between text-[10px] text-[#777]">
              <span>Active Hook: @record_step</span>
              <span>Overhead: &lt;1.8ms/step</span>
            </div>
          </div>
        </div>
      </section>

      {/* KPI Stats Grid */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="TOTAL RECORDED RUNS"
          value={totalRuns}
          subtext="Captured in execution journal"
          prefix="[FLIGHTS]"
        />
        <StatCard
          label="FAILED FLIGHTS"
          value={failedRuns.length}
          subtext="Require triage & root cause"
          variant="danger"
          prefix="[CRASH]"
        />
        <StatCard
          label="SUCCESS RATE"
          value={`${Math.round((successRuns.length / (totalRuns || 1)) * 100)}%`}
          subtext={`${successRuns.length} completed clean runs`}
          variant="success"
          prefix="[HEALTH]"
        />
        <StatCard
          label="AVG STEP DURATION"
          value={`${avgDuration}ms`}
          subtext="Per-step latency overhead"
          prefix="[SPEED]"
        />
      </section>

      {/* Immediate Triage: Failed Runs Alert Banner */}
      {failedRuns.length > 0 && (
        <section className="p-4 border border-danger/30 bg-danger/[0.03] rounded-[4px] space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-danger animate-pulse" />
              <span className="font-bold text-xs text-danger tracking-wide">
                [FAILED FLIGHTS REQUIRING TRIAGE]
              </span>
            </div>
            <span className="text-[11px] text-ink/60">
              {failedRuns.length} runs halted prematurely
            </span>
          </div>

          <div className="space-y-2">
            {failedRuns.map((r) => (
              <div
                key={r.id}
                className="p-3 bg-canvas border border-danger/20 rounded-[3px] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-ink">{r.id}</span>
                    <span className="text-ink/40">›</span>
                    <span className="font-semibold text-ink/80">{r.agent_name}</span>
                    <span className="text-[10px] px-1.5 py-0.2 bg-danger/10 text-danger border border-danger/30 rounded-[2px]">
                      {r.failure_type || "Logic Error"}
                    </span>
                  </div>
                  <p className="text-[11px] text-ink/60 truncate max-w-xl">
                    Task: {r.task}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-[11px] text-ink/50">
                    {r.steps?.length ?? r.step_count ?? 0} steps · {r.duration_ms}ms
                  </div>
                  <Link
                    href={`/runs/${r.id}`}
                    className="px-2.5 py-1 bg-ink text-canvas hover:bg-danger text-[11px] rounded-[3px] font-semibold flex items-center gap-1 transition-colors"
                  >
                    <span>Debug Root Cause</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Recent Runs Table */}
      <section className="border border-hairline bg-surface-card rounded-[4px] p-4 space-y-4">
        <div className="flex items-center justify-between text-xs pb-2 border-b border-hairline">
          <div className="flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-ink/70" />
            <span className="font-bold text-ink">[RECENT RECORDED AGENT FLIGHTS]</span>
          </div>
          <Link
            href="/runs"
            className="text-[11px] text-accent hover:underline flex items-center gap-1"
          >
            <span>View All Runs</span>
            <ExternalLink className="w-3 h-3" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-hairline text-ink/50 text-[10px] uppercase">
                <th className="py-2 px-3">Run ID</th>
                <th className="py-2 px-3">Agent</th>
                <th className="py-2 px-3">Task Prompt</th>
                <th className="py-2 px-3">Status</th>
                <th className="py-2 px-3">Steps</th>
                <th className="py-2 px-3">Duration</th>
                <th className="py-2 px-3">Failure Type</th>
                <th className="py-2 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {runs.map((r) => (
                <tr
                  key={r.id}
                  className="hover:bg-surface-soft/60 transition-colors group"
                >
                  <td className="py-2.5 px-3 font-bold text-ink whitespace-nowrap">
                    {r.id}
                  </td>
                  <td className="py-2.5 px-3 text-ink/80 whitespace-nowrap">
                    {r.agent_name}
                  </td>
                  <td className="py-2.5 px-3 text-ink/70 max-w-xs truncate" title={r.task}>
                    {r.task}
                  </td>
                  <td className="py-2.5 px-3 whitespace-nowrap">
                    <AsciiBadge status={r.status} />
                  </td>
                  <td className="py-2.5 px-3 text-ink/60 whitespace-nowrap">
                    {r.steps?.length ?? r.step_count ?? 0}
                  </td>
                  <td className="py-2.5 px-3 text-ink/60 whitespace-nowrap">
                    {r.duration_ms}ms
                  </td>
                  <td className="py-2.5 px-3 text-ink/60 whitespace-nowrap">
                    {r.failure_type ? (
                      <span className="text-danger text-[11px] font-medium">
                        {r.failure_type}
                      </span>
                    ) : (
                      <span className="text-ink/30">—</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-right whitespace-nowrap">
                    <Link
                      href={`/runs/${r.id}`}
                      className="inline-flex items-center gap-1 px-2 py-0.5 border border-hairline rounded-[3px] text-[11px] bg-canvas group-hover:bg-ink group-hover:text-canvas transition-colors"
                    >
                      <span>inspect</span>
                      <ArrowRight className="w-2.5 h-2.5" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
