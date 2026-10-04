"use client";

import React, { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { Run } from "@/types/run";
import { getRuns } from "@/services/api";
import { AsciiBadge } from "@/components/ui/AsciiBadge";
import {
  Search,
  Filter,
  ArrowRight,
  History,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
} from "lucide-react";

export default function RunsPage() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | "Successful" | "Failed" | "Diagnosed" | "Replayed">("All");

  useEffect(() => {
    getRuns().then((data) => setRuns(data));
  }, []);

  const filteredRuns = useMemo(() => {
    return runs.filter((r) => {
      const agent = (r.agent_name || "Text2SQL-Agent").toLowerCase();
      const taskText = (r.task || r.task_text || "").toLowerCase();
      const runId = r.id.toLowerCase();

      const matchesSearch =
        runId.includes(search.toLowerCase()) ||
        agent.includes(search.toLowerCase()) ||
        taskText.includes(search.toLowerCase());

      if (!matchesSearch) return false;

      if (statusFilter === "All") return true;
      if (statusFilter === "Successful") {
        return r.status === "success" || r.outcome === "success";
      }
      if (statusFilter === "Failed") {
        return r.status === "failed" || r.outcome === "fail";
      }
      if (statusFilter === "Diagnosed") {
        return r.status === "failed" || Boolean(r.failure_type);
      }
      if (statusFilter === "Replayed") {
        return r.status === "replayed" || r.parent_run_id !== null;
      }
      return true;
    });
  }, [runs, search, statusFilter]);

  const filterTabs: Array<"All" | "Successful" | "Failed" | "Diagnosed" | "Replayed"> = [
    "All",
    "Successful",
    "Failed",
    "Diagnosed",
    "Replayed",
  ];

  return (
    <div className="font-mono space-y-6 py-2 text-ink">
      {/* ==================================================
          PAGE TITLE & SUBTITLE
          ================================================== */}
      <div className="pb-4 border-b border-hairline flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">
            Execution Runs
          </h1>
          <p className="text-xs text-ink/70 mt-1">
            Inspect every recorded agent execution.
          </p>
        </div>

        <div className="text-xs text-ink/60 border border-hairline px-3 py-1.5 rounded-[4px] bg-surface-card">
          Showing {filteredRuns.length} of {runs.length} executions
        </div>
      </div>

      {/* ==================================================
          SEARCH & FILTERS
          ================================================== */}
      <div className="p-4 border border-hairline bg-surface-card rounded-[4px] space-y-3">
        {/* Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink/40" />
          <input
            type="text"
            placeholder="Search runs, agents, tasks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs bg-canvas border border-hairline rounded-[3px] focus:outline-none focus:border-ink transition-colors placeholder:text-ink/40 text-ink"
          />
        </div>

        {/* Filter Bar */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-[11px] text-ink/50 uppercase tracking-wider mr-2 flex items-center gap-1">
            <Filter className="w-3 h-3" />
            <span>Filter:</span>
          </span>
          {filterTabs.map((tab) => {
            const isActive = statusFilter === tab;
            return (
              <button
                key={tab}
                onClick={() => setStatusFilter(tab)}
                className={`px-3 py-1 rounded-[3px] text-xs font-semibold transition-all ${
                  isActive
                    ? "bg-ink text-canvas shadow-xs"
                    : "bg-canvas text-ink/70 border border-hairline hover:text-ink hover:bg-surface-soft"
                }`}
              >
                {tab}
              </button>
            );
          })}
        </div>
      </div>

      {/* Status Definitions Legend */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-[11px] text-ink/60 p-3 bg-surface-soft rounded-[4px] border border-hairline">
        <div>
          <span className="font-bold text-emerald-700">Successful:</span> Execution completed successfully.
        </div>
        <div>
          <span className="font-bold text-danger">Failed:</span> Execution requires investigation.
        </div>
        <div>
          <span className="font-bold text-warning">Diagnosed:</span> A probable root-cause step has been identified.
        </div>
        <div>
          <span className="font-bold text-accent">Replayed:</span> Execution has been replayed from a checkpoint.
        </div>
      </div>

      {/* ==================================================
          RUNS LIST / TABLE & MOBILE CARDS
          ================================================== */}
      <div className="border border-hairline bg-canvas rounded-[4px] overflow-hidden shadow-xs">
        {/* Mobile Cards (visible below md) */}
        <div className="block md:hidden divide-y divide-hairline">
          {filteredRuns.length === 0 ? (
            <div className="p-8 text-center space-y-2">
              <p className="text-sm font-bold text-ink">No runs found.</p>
              <p className="text-xs text-ink/60">
                Try changing your filters or record a new agent execution.
              </p>
            </div>
          ) : (
            filteredRuns.map((run) => {
              const failureLabel = run.failure_type || (run.status === "failed" ? "Runtime Fault" : null);
              const createdDate = new Date(run.created_at).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              });

              return (
                <div key={run.id} className="p-4 space-y-2.5 hover:bg-surface-soft transition-colors">
                  <div className="flex items-center justify-between gap-2">
                    <Link href={`/runs/${run.id}`} className="font-bold text-ink hover:underline text-sm truncate">
                      {run.id}
                    </Link>
                    <AsciiBadge status={run.status} size="sm" />
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-[10px]">
                    <span className="border border-hairline px-1.5 py-0.5 rounded-[2px] bg-surface-card text-ink/75">
                      {run.agent_name || "Text2SQL-Agent"}
                    </span>
                    <span className="text-ink/50">{createdDate}</span>
                  </div>

                  <p className="text-xs text-ink/80 leading-relaxed line-clamp-2">
                    {run.task || run.task_text || "—"}
                  </p>

                  {failureLabel && (
                    <div className="text-[11px] text-warning bg-warning/10 border border-warning/30 px-2 py-1 rounded-[2px] font-semibold">
                      [!] {failureLabel}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-1 border-t border-hairline/60 text-xs">
                    <div className="flex items-center gap-3 text-ink/60 text-[11px]">
                      <span>{run.steps?.length ?? run.step_count ?? 5} steps</span>
                      <span>•</span>
                      <span>{run.duration_ms}ms</span>
                    </div>

                    <Link
                      href={`/runs/${run.id}`}
                      className="px-3 py-1 bg-ink text-canvas hover:bg-accent rounded-[3px] text-xs font-semibold inline-flex items-center gap-1 transition-colors"
                    >
                      <span>Inspect</span>
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Desktop Table (hidden on mobile, visible on md+) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-hairline bg-surface-soft text-ink/70 font-semibold uppercase text-[11px]">
                <th className="py-3 px-4">Run</th>
                <th className="py-3 px-4">Agent</th>
                <th className="py-3 px-4">Task</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-center">Steps</th>
                <th className="py-3 px-4 text-right">Duration</th>
                <th className="py-3 px-4">Failure</th>
                <th className="py-3 px-4">Created</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {filteredRuns.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 px-4 text-center">
                    {/* Empty State */}
                    <div className="max-w-md mx-auto space-y-2">
                      <p className="text-sm font-bold text-ink">No runs found.</p>
                      <p className="text-xs text-ink/60">
                        Try changing your filters or record a new agent execution.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRuns.map((run) => {
                  const failureLabel = run.failure_type || (run.status === "failed" ? "Unclassified Error" : "—");
                  const createdDate = new Date(run.created_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  });

                  return (
                    <tr
                      key={run.id}
                      className="hover:bg-surface-soft transition-colors group"
                    >
                      <td className="py-3 px-4 font-bold text-ink whitespace-nowrap">
                        <Link
                          href={`/runs/${run.id}`}
                          className="hover:underline flex items-center gap-1.5"
                        >
                          <span>{run.id}</span>
                        </Link>
                      </td>
                      <td className="py-3 px-4 text-ink/80 whitespace-nowrap">
                        <span className="border border-hairline px-1.5 py-0.5 rounded-[2px] text-[10px] bg-surface-card">
                          {run.agent_name || "Text2SQL-Agent"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-ink/80 max-w-xs truncate">
                        {run.task || run.task_text || "—"}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <AsciiBadge status={run.status} size="sm" />
                      </td>
                      <td className="py-3 px-4 text-center text-ink/75 font-mono">
                        {run.steps?.length ?? run.step_count ?? 5}
                      </td>
                      <td className="py-3 px-4 text-right text-ink/75 whitespace-nowrap">
                        {run.duration_ms}ms
                      </td>
                      <td className="py-3 px-4 text-xs whitespace-nowrap">
                        {run.failure_type ? (
                          <span className="text-warning font-semibold">
                            {run.failure_type}
                          </span>
                        ) : run.status === "failed" ? (
                          <span className="text-danger">Runtime Fault</span>
                        ) : (
                          <span className="text-ink/40">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-ink/50 whitespace-nowrap text-[11px]">
                        {createdDate}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <Link
                          href={`/runs/${run.id}`}
                          className="px-2.5 py-1 bg-ink text-canvas hover:bg-accent rounded-[3px] text-[11px] font-semibold inline-flex items-center gap-1 transition-colors shadow-xs"
                        >
                          <span>Inspect Run</span>
                          <ArrowRight className="w-3 h-3" />
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
