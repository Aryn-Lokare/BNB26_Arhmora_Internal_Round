"use client";

import React, { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { Run } from "@/types/run";
import { getRuns } from "@/services/api";
import { AsciiBadge } from "@/components/ui/AsciiBadge";
import {
  Search,
  Filter,
  ArrowUpDown,
  ArrowRight,
  RotateCcw,
  SlidersHorizontal,
  History,
} from "lucide-react";

export default function RunsPage() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [failureTypeFilter, setFailureTypeFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"created_at" | "duration_ms" | "steps">("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    getRuns().then((data) => setRuns(data));
  }, []);

  // Filter and sort runs
  const filteredRuns = useMemo(() => {
    return runs
      .filter((r) => {
        const agent = (r.agent_name || "Text2SQL-Agent").toLowerCase();
        const taskText = (r.task || r.task_text || "").toLowerCase();
        const runStatus = (r.status || (r.outcome === "fail" ? "failed" : r.outcome)).toLowerCase();

        const matchesSearch =
          r.id.toLowerCase().includes(search.toLowerCase()) ||
          agent.includes(search.toLowerCase()) ||
          taskText.includes(search.toLowerCase());

        const matchesStatus =
          statusFilter === "all" || runStatus === statusFilter.toLowerCase();

        const matchesFailureType =
          failureTypeFilter === "all" ||
          (r.failure_type &&
            r.failure_type.toLowerCase().includes(failureTypeFilter.toLowerCase()));

        return matchesSearch && matchesStatus && matchesFailureType;
      })
      .sort((a, b) => {
        let valA: number | string = 0;
        let valB: number | string = 0;

        if (sortBy === "steps") {
          valA = a.steps?.length ?? a.step_count ?? 0;
          valB = b.steps?.length ?? b.step_count ?? 0;
        } else if (sortBy === "duration_ms") {
          valA = a.duration_ms;
          valB = b.duration_ms;
        } else {
          valA = a.created_at;
          valB = b.created_at;
        }

        if (valA < valB) return sortOrder === "asc" ? -1 : 1;
        if (valA > valB) return sortOrder === "asc" ? 1 : -1;
        return 0;
      });
  }, [runs, search, statusFilter, failureTypeFilter, sortBy, sortOrder]);

  const failureTypes = Array.from(
    new Set(runs.map((r) => r.failure_type).filter(Boolean) as string[])
  );

  return (
    <div className="font-mono space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-hairline">
        <div>
          <div className="flex items-center gap-2 text-xs text-ink/60 mb-1">
            <History className="w-3.5 h-3.5 text-ink/70" />
            <span>[FLIGHT JOURNAL INDEX]</span>
          </div>
          <h1 className="text-xl font-bold text-ink">RECORDED AGENT RUNS</h1>
          <p className="text-xs text-ink/60 mt-0.5">
            Query and inspect all captured agent executions, checkpoints, and counterfactual replays.
          </p>
        </div>

        <div className="text-xs text-ink/60">
          Showing {filteredRuns.length} of {runs.length} recorded flights
        </div>
      </div>

      {/* Filter and Search Controls */}
      <div className="p-4 border border-hairline bg-surface-card rounded-[4px] space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-ink/40" />
            <input
              type="text"
              placeholder="Search by Run ID, Agent name, or Task prompt..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-canvas border border-hairline rounded-[3px] focus:outline-none focus:border-ink/40 text-ink placeholder:text-ink/40"
            />
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-ink/60 text-[11px] uppercase">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-canvas border border-hairline rounded-[3px] text-xs focus:outline-none focus:border-ink/40 text-ink"
            >
              <option value="all">All Statuses</option>
              <option value="failed">[FAIL] Failed</option>
              <option value="success">[OK] Success</option>
              <option value="replayed">[REPLAY] Replayed</option>
            </select>
          </div>

          {/* Failure Type Filter */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-ink/60 text-[11px] uppercase">Failure Type:</span>
            <select
              value={failureTypeFilter}
              onChange={(e) => setFailureTypeFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-canvas border border-hairline rounded-[3px] text-xs focus:outline-none focus:border-ink/40 text-ink"
            >
              <option value="all">All Types</option>
              {failureTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Quick Filter Badges */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-hairline text-xs">
          <span className="text-[10px] text-ink/50 uppercase">Quick Filter:</span>
          <button
            onClick={() => {
              setStatusFilter("failed");
              setFailureTypeFilter("all");
            }}
            className={`px-2 py-0.5 rounded-[2px] text-[11px] border transition-colors ${
              statusFilter === "failed"
                ? "bg-danger text-canvas border-danger font-semibold"
                : "border-hairline bg-canvas text-ink/70 hover:bg-surface-soft"
            }`}
          >
            Failed Only
          </button>
          <button
            onClick={() => {
              setStatusFilter("replayed");
              setFailureTypeFilter("all");
            }}
            className={`px-2 py-0.5 rounded-[2px] text-[11px] border transition-colors ${
              statusFilter === "replayed"
                ? "bg-accent text-canvas border-accent font-semibold"
                : "border-hairline bg-canvas text-ink/70 hover:bg-surface-soft"
            }`}
          >
            Replayed Only
          </button>
          <button
            onClick={() => {
              setStatusFilter("all");
              setFailureTypeFilter("all");
              setSearch("");
            }}
            className="px-2 py-0.5 rounded-[2px] text-[11px] text-ink/50 hover:text-ink underline ml-auto"
          >
            Reset filters
          </button>
        </div>
      </div>

      {/* Runs Table */}
      <div className="border border-hairline bg-surface-card rounded-[4px] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-hairline bg-surface-soft/60 text-ink/60 text-[10px] uppercase">
                <th
                  onClick={() => {
                    setSortBy("created_at");
                    setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                  }}
                  className="py-2.5 px-3 cursor-pointer hover:text-ink select-none"
                >
                  <div className="flex items-center gap-1">
                    <span>Run ID</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="py-2.5 px-3">Agent</th>
                <th className="py-2.5 px-3">Task Prompt</th>
                <th className="py-2.5 px-3">Status</th>
                <th
                  onClick={() => {
                    setSortBy("steps");
                    setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                  }}
                  className="py-2.5 px-3 cursor-pointer hover:text-ink select-none"
                >
                  <div className="flex items-center gap-1">
                    <span>Steps</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  onClick={() => {
                    setSortBy("duration_ms");
                    setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                  }}
                  className="py-2.5 px-3 cursor-pointer hover:text-ink select-none"
                >
                  <div className="flex items-center gap-1">
                    <span>Duration</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="py-2.5 px-3">Failure Type</th>
                <th className="py-2.5 px-3">Timestamp</th>
                <th className="py-2.5 px-3 text-right">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {filteredRuns.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-ink/50 text-xs">
                    No recorded runs found matching your search criteria.
                  </td>
                </tr>
              ) : (
                filteredRuns.map((r) => (
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
                    <td className="py-2.5 px-3 text-ink/70 max-w-sm truncate" title={r.task}>
                      {r.task}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <AsciiBadge status={r.status} />
                    </td>
                    <td className="py-2.5 px-3 text-ink/60 whitespace-nowrap">
                      {(r.steps || []).length || r.step_count || 0}
                    </td>
                    <td className="py-2.5 px-3 text-ink/60 whitespace-nowrap">
                      {r.duration_ms}ms
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      {r.failure_type ? (
                        <span className="text-danger text-[11px] font-semibold">
                          {r.failure_type}
                        </span>
                      ) : (
                        <span className="text-ink/30">—</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-ink/50 text-[11px] whitespace-nowrap">
                      {new Date(r.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </td>
                    <td className="py-2.5 px-3 text-right whitespace-nowrap">
                      <Link
                        href={`/runs/${r.id}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 border border-hairline rounded-[3px] text-[11px] bg-canvas group-hover:bg-ink group-hover:text-canvas transition-colors"
                      >
                        <span>open</span>
                        <ArrowRight className="w-2.5 h-2.5" />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
