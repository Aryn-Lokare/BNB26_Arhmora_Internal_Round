import React from "react";
import Link from "next/link";
import { getRuns } from "@/services/api";
import { AsciiBadge } from "@/components/ui/AsciiBadge";
import {
  ArrowRight,
  Terminal,
  History,
  Activity,
  PlusCircle,
  Search,
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const runs = await getRuns();

  const totalRuns = runs.length;
  const successRuns = runs.filter((r) => r.status === "success" || r.outcome === "success");
  const failedRuns = runs.filter((r) => r.status === "failed" || r.outcome === "fail");
  const diagnosedRuns = runs.filter((r) => r.status === "failed" || r.failure_type);
  const replayedRuns = runs.filter((r) => r.status === "replayed");

  return (
    <div className="font-mono space-y-8 py-2 text-ink">
      {/* ==================================================
          PAGE TITLE & SUBTITLE
          ================================================== */}
      <div className="border-b border-hairline pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">
            Agent Overview
          </h1>
          <p className="text-xs text-ink/70 mt-1">
            Monitor executions, failures, and diagnoses across your agents.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/runs/run-9a1b2c3d"
            className="px-3.5 py-1.5 bg-ink text-canvas hover:bg-accent text-xs rounded-[4px] font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
          >
            <span>Live Flagship Run</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* ==================================================
          STAT CARDS
          ================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Runs */}
        <div className="border border-hairline bg-canvas p-5 rounded-[4px] space-y-2">
          <div className="flex items-center justify-between text-xs text-ink/60">
            <span className="font-bold uppercase tracking-wider">Total Runs</span>
            <History className="w-3.5 h-3.5 text-ink/40" />
          </div>
          <div className="text-3xl font-extrabold text-ink">{totalRuns}</div>
          <p className="text-[11px] text-ink/65 leading-tight">
            All recorded agent executions.
          </p>
        </div>

        {/* Successful */}
        <div className="border border-hairline bg-canvas p-5 rounded-[4px] space-y-2">
          <div className="flex items-center justify-between text-xs text-ink/60">
            <span className="font-bold uppercase tracking-wider">Successful</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="text-3xl font-extrabold text-emerald-700">
            {successRuns.length}
          </div>
          <p className="text-[11px] text-ink/65 leading-tight">
            Runs completed without a detected root-cause failure.
          </p>
        </div>

        {/* Failed */}
        <div className="border border-hairline bg-canvas p-5 rounded-[4px] space-y-2">
          <div className="flex items-center justify-between text-xs text-ink/60">
            <span className="font-bold uppercase tracking-wider">Failed</span>
            <AlertTriangle className="w-3.5 h-3.5 text-danger" />
          </div>
          <div className="text-3xl font-extrabold text-danger">
            {failedRuns.length}
          </div>
          <p className="text-[11px] text-ink/65 leading-tight">
            Runs requiring investigation.
          </p>
        </div>

        {/* Diagnosed */}
        <div className="border border-hairline bg-canvas p-5 rounded-[4px] space-y-2">
          <div className="flex items-center justify-between text-xs text-ink/60">
            <span className="font-bold uppercase tracking-wider">Diagnosed</span>
            <Search className="w-3.5 h-3.5 text-warning" />
          </div>
          <div className="text-3xl font-extrabold text-warning">
            {diagnosedRuns.length}
          </div>
          <p className="text-[11px] text-ink/65 leading-tight">
            Failures with a localized suspicious step.
          </p>
        </div>
      </div>

      {/* ==================================================
          ACTIVITY & QUICK ACTIONS
          ================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Execution Activity */}
        <div className="lg:col-span-2 border border-hairline bg-surface-card rounded-[4px] p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-hairline pb-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-ink/80 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-accent" />
              <span>Execution Activity</span>
            </h2>
            <span className="text-[10px] text-ink/50">TELEMETRY TIMELINE</span>
          </div>

          {/* Activity Labels */}
          <div className="flex flex-wrap items-center gap-4 text-xs pt-1">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              <span className="text-ink/80">Success</span>
              <span className="text-[10px] text-ink/50 font-semibold">({successRuns.length})</span>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-danger"></span>
              <span className="text-ink/80">Failed</span>
              <span className="text-[10px] text-ink/50 font-semibold">({failedRuns.length})</span>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-warning"></span>
              <span className="text-ink/80">Diagnosed</span>
              <span className="text-[10px] text-ink/50 font-semibold">({diagnosedRuns.length})</span>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-accent"></span>
              <span className="text-ink/80">Replayed</span>
              <span className="text-[10px] text-ink/50 font-semibold">({replayedRuns.length})</span>
            </div>
          </div>

          {/* Visual Activity Bar */}
          <div className="h-3 w-full bg-surface-soft rounded-[2px] overflow-hidden flex border border-hairline">
            <div
              style={{ width: `${(successRuns.length / Math.max(totalRuns, 1)) * 100}%` }}
              className="bg-emerald-500 h-full"
              title="Success"
            />
            <div
              style={{ width: `${(failedRuns.length / Math.max(totalRuns, 1)) * 100}%` }}
              className="bg-danger h-full"
              title="Failed"
            />
            <div
              style={{ width: `${(replayedRuns.length / Math.max(totalRuns, 1)) * 100}%` }}
              className="bg-accent h-full"
              title="Replayed"
            />
          </div>

          <p className="text-[11px] text-ink/60 leading-relaxed">
            Continuous execution monitoring streams real-time state deltas, token usage, and tool output anomalies.
          </p>
        </div>

        {/* Quick Actions */}
        <div className="border border-hairline bg-canvas rounded-[4px] p-5 space-y-4">
          <div className="border-b border-hairline pb-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-ink/80">
              Quick Actions
            </h2>
          </div>

          <div className="space-y-3">
            {/* Record Run */}
            <Link
              href="/runs"
              className="block p-3 rounded-[4px] border border-hairline bg-surface-card hover:bg-surface-soft transition-colors space-y-1 group"
            >
              <div className="flex items-center justify-between text-xs font-bold text-ink group-hover:text-accent">
                <span className="flex items-center gap-1.5">
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>Record Run</span>
                </span>
                <ArrowRight className="w-3 h-3 text-ink/40" />
              </div>
              <p className="text-[11px] text-ink/65">
                Start capturing an agent execution.
              </p>
            </Link>

            {/* Investigate Failure */}
            <Link
              href="/runs/run-9a1b2c3d"
              className="block p-3 rounded-[4px] border border-hairline bg-surface-card hover:bg-surface-soft transition-colors space-y-1 group"
            >
              <div className="flex items-center justify-between text-xs font-bold text-ink group-hover:text-warning">
                <span className="flex items-center gap-1.5">
                  <Search className="w-3.5 h-3.5" />
                  <span>Investigate Failure</span>
                </span>
                <ArrowRight className="w-3 h-3 text-ink/40" />
              </div>
              <p className="text-[11px] text-ink/65">
                Find the root cause of a failed run.
              </p>
            </Link>

            {/* View Documentation */}
            <Link
              href="/docs"
              className="block p-3 rounded-[4px] border border-hairline bg-surface-card hover:bg-surface-soft transition-colors space-y-1 group"
            >
              <div className="flex items-center justify-between text-xs font-bold text-ink group-hover:text-ink">
                <span className="flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>View Documentation</span>
                </span>
                <ArrowRight className="w-3 h-3 text-ink/40" />
              </div>
              <p className="text-[11px] text-ink/65">
                Learn how to connect Black Box to your agent.
              </p>
            </Link>
          </div>
        </div>
      </div>

      {/* ==================================================
          RECENT RUNS
          ================================================== */}
      <div className="border border-hairline bg-canvas rounded-[4px] overflow-hidden space-y-0">
        <div className="p-4 border-b border-hairline bg-surface-soft flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-ink/80 flex items-center gap-2">
            <span>Recent Executions</span>
          </h2>
          <Link
            href="/runs"
            className="text-xs text-ink/60 hover:text-ink flex items-center gap-1 transition-colors"
          >
            <span>View All Runs</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {runs.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <p className="text-xs text-ink/60">
              No executions yet. Connect an agent and start recording.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-hairline text-xs">
            {runs.slice(0, 6).map((run) => (
              <div
                key={run.id}
                className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-surface-soft transition-colors"
              >
                <div className="space-y-1 max-w-xl">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-ink">{run.id}</span>
                    <AsciiBadge status={run.status} size="sm" />
                    <span className="text-[10px] text-ink/40 border border-hairline px-1 rounded-[2px]">
                      {run.agent_name || "Text2SQL-Agent"}
                    </span>
                  </div>
                  <p className="text-[11px] text-ink/70 line-clamp-1">
                    {run.task || run.task_text || "Query task"}
                  </p>
                </div>

                <div className="flex items-center gap-4 text-[11px] text-ink/60 shrink-0">
                  <span>{run.steps?.length ?? run.step_count ?? 5} steps</span>
                  <span>{run.duration_ms}ms</span>
                  <Link
                    href={`/runs/${run.id}`}
                    className="px-2.5 py-1 bg-surface-card hover:bg-ink hover:text-canvas rounded-[3px] border border-hairline font-semibold transition-colors flex items-center gap-1 text-[11px]"
                  >
                    <span>Inspect</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
