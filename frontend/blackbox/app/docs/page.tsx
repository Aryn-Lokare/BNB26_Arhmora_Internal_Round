import React from "react";
import Link from "next/link";
import {
  Terminal,
  BookOpen,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Code,
  Wrench,
  Search,
  Layers,
  RotateCcw,
} from "lucide-react";

export default function DocsPage() {
  return (
    <div className="font-mono space-y-12 py-4 max-w-4xl text-ink">
      {/* ==================================================
          PAGE TITLE & SUBTITLE
          ================================================== */}
      <div className="border-b border-hairline pb-4 space-y-1.5">
        <div className="inline-flex items-center gap-1.5 text-xs text-ink/60 uppercase">
          <BookOpen className="w-3.5 h-3.5" />
          <span>DOCUMENTATION // MCP INTEGRATION</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-ink">
          Connect Black Box with MCP
        </h1>
        <p className="text-xs sm:text-sm text-ink/75 leading-relaxed">
          Use the Black Box MCP server to inspect, diagnose, rewind, and replay agent executions directly from an MCP-compatible AI client.
        </p>
      </div>

      {/* ==================================================
          WHAT IS THE BLACK BOX MCP SERVER?
          ================================================== */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-ink border-b border-hairline pb-1.5">
          What is the Black Box MCP Server?
        </h2>
        <div className="text-xs sm:text-sm text-ink/80 space-y-3 leading-relaxed">
          <p>
            The MCP server exposes Black Box debugging capabilities as tools that an AI assistant can call during development.
          </p>
          <p>
            Instead of manually opening the dashboard, your AI client can inspect traces, find suspicious steps, restore checkpoints, and trigger replay workflows.
          </p>
        </div>
      </section>

      {/* ==================================================
          SETUP
          ================================================== */}
      <section className="space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-ink border-b border-hairline pb-1.5">
          Setup
        </h2>

        <ol className="list-decimal list-inside text-xs sm:text-sm text-ink/80 space-y-2 leading-relaxed">
          <li>Install / start the Black Box MCP server.</li>
          <li>Add the server to your MCP-compatible client configuration.</li>
          <li>Start your Black Box backend.</li>
          <li>Connect your agent and begin recording executions.</li>
        </ol>

        {/* Dynamic Project MCP Configuration Code Block */}
        <div className="border border-hairline bg-surface-dark text-canvas rounded-[4px] p-4 text-xs font-mono space-y-2">
          <div className="flex items-center justify-between text-[11px] text-[#9a9898] border-b border-[#302c2c] pb-2">
            <span>mcp_config.json</span>
            <span>JSON</span>
          </div>
          <pre className="text-[11px] leading-relaxed overflow-x-auto text-[#eee]">
{`{
  "mcpServers": {
    "blackbox": {
      "command": "python",
      "args": ["mcp_server.py"],
      "cwd": "n:/bnb/blackbox-worker",
      "env": {
        "PYTHONUNBUFFERED": "1"
      }
    }
  }
}`}
          </pre>
        </div>
      </section>

      {/* ==================================================
          AVAILABLE TOOLS (FROM PROJECT IMPLEMENTATION)
          ================================================== */}
      <section className="space-y-6">
        <div className="border-b border-hairline pb-1.5 flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-ink">
            Available Tools
          </h2>
          <span className="text-[11px] text-ink/50">5 TOOLS DISCOVERED</span>
        </div>

        <div className="space-y-6">
          {/* 1. diagnose_failure */}
          <div className="border border-hairline bg-canvas p-4 rounded-[4px] space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-ink">diagnose_failure</span>
              <span className="px-1.5 py-0.5 rounded-[2px] bg-warning/15 text-warning font-semibold text-[10px]">DIAGNOSIS</span>
            </div>
            <p className="text-xs text-ink/75">
              Analyzes an agent execution trace and localizes the root-cause failure step with calibrated confidence.
            </p>
            <div className="text-[11px] text-ink/60">
              <span className="font-semibold text-ink">Required parameters:</span> <code>run_id</code> (or <code>trace</code>)
            </div>
            <div className="bg-surface-soft p-2.5 rounded-[3px] border border-hairline text-[11px]">
              <div className="text-ink/50 mb-1">Example usage:</div>
              <code>{`{"run_id": "run-9a1b2c3d", "top_k": 3}`}</code>
            </div>
          </div>

          {/* 2. simulate_counterfactual_patch */}
          <div className="border border-hairline bg-canvas p-4 rounded-[4px] space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-ink">simulate_counterfactual_patch</span>
              <span className="px-1.5 py-0.5 rounded-[2px] bg-accent/15 text-accent font-semibold text-[10px]">REPLAY</span>
            </div>
            <p className="text-xs text-ink/75">
              Forks agent state from a specific checkpoint, applies a patch, and verifies whether downstream failures are resolved.
            </p>
            <div className="text-[11px] text-ink/60">
              <span className="font-semibold text-ink">Required parameters:</span> <code>run_id</code>, <code>forked_at_step</code>, <code>patch</code>
            </div>
            <div className="bg-surface-soft p-2.5 rounded-[3px] border border-hairline text-[11px]">
              <div className="text-ink/50 mb-1">Example usage:</div>
              <code>{`{"run_id": "run-9a1b2c3d", "forked_at_step": 2, "patch": {"query": "SELECT MAX(budget) FROM departments;"}}`}</code>
            </div>
          </div>

          {/* 3. record_step */}
          <div className="border border-hairline bg-canvas p-4 rounded-[4px] space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-ink">record_step</span>
              <span className="px-1.5 py-0.5 rounded-[2px] bg-emerald-500/15 text-emerald-700 font-semibold text-[10px]">TRACING</span>
            </div>
            <p className="text-xs text-ink/75">
              Allows external agents (CrewAI, AutoGen, custom loops) to stream execution steps into Black Box for tracing and replay.
            </p>
            <div className="text-[11px] text-ink/60">
              <span className="font-semibold text-ink">Required parameters:</span> <code>run_id</code>, <code>step_idx</code>, <code>node</code>
            </div>
            <div className="bg-surface-soft p-2.5 rounded-[3px] border border-hairline text-[11px]">
              <div className="text-ink/50 mb-1">Example usage:</div>
              <code>{`{"run_id": "run-custom-01", "step_idx": 1, "node": "select_tool", "step_type": "tool_call", "input": {"action": "fetch_user"}}`}</code>
            </div>
          </div>

          {/* 4. get_run_trace */}
          <div className="border border-hairline bg-canvas p-4 rounded-[4px] space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-ink">get_run_trace</span>
              <span className="px-1.5 py-0.5 rounded-[2px] bg-ink/10 text-ink font-semibold text-[10px]">INSPECTION</span>
            </div>
            <p className="text-xs text-ink/75">
              Retrieves the complete step-by-step trace, state transitions, and checkpoint history for a run.
            </p>
            <div className="text-[11px] text-ink/60">
              <span className="font-semibold text-ink">Required parameters:</span> <code>run_id</code>
            </div>
            <div className="bg-surface-soft p-2.5 rounded-[3px] border border-hairline text-[11px]">
              <div className="text-ink/50 mb-1">Example usage:</div>
              <code>{`{"run_id": "run-9a1b2c3d"}`}</code>
            </div>
          </div>

          {/* 5. list_runs */}
          <div className="border border-hairline bg-canvas p-4 rounded-[4px] space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-ink">list_runs</span>
              <span className="px-1.5 py-0.5 rounded-[2px] bg-ink/10 text-ink font-semibold text-[10px]">INSPECTION</span>
            </div>
            <p className="text-xs text-ink/75">
              Lists recent executions with status, step counts, and error classifications.
            </p>
            <div className="text-[11px] text-ink/60">
              <span className="font-semibold text-ink">Required parameters:</span> None (optional <code>limit</code>)
            </div>
            <div className="bg-surface-soft p-2.5 rounded-[3px] border border-hairline text-[11px]">
              <div className="text-ink/50 mb-1">Example usage:</div>
              <code>{`{"limit": 10}`}</code>
            </div>
          </div>
        </div>
      </section>

      {/* ==================================================
          TYPICAL WORKFLOW
          ================================================== */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-ink border-b border-hairline pb-1.5">
          Typical Workflow
        </h2>

        <div className="p-4 border border-hairline bg-surface-card rounded-[4px] text-xs font-mono">
          <div className="flex flex-wrap items-center gap-2 text-ink font-semibold">
            <span>Connect</span>
            <span className="text-ink/40">→</span>
            <span>Record</span>
            <span className="text-ink/40">→</span>
            <span>Inspect</span>
            <span className="text-ink/40">→</span>
            <span>Diagnose</span>
            <span className="text-ink/40">→</span>
            <span>Rewind</span>
            <span className="text-ink/40">→</span>
            <span>Patch</span>
            <span className="text-ink/40">→</span>
            <span>Replay</span>
            <span className="text-ink/40">→</span>
            <span>Verify</span>
          </div>
        </div>
      </section>

      {/* ==================================================
          EXAMPLE PROMPT
          ================================================== */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-ink border-b border-hairline pb-1.5">
          Example Prompt
        </h2>

        <div className="p-4 border border-hairline bg-surface-soft rounded-[4px] text-xs sm:text-sm text-ink italic leading-relaxed">
          &ldquo;Inspect the latest failed run, identify the most likely root-cause step, rewind to its checkpoint, and explain what would need to change before replaying it.&rdquo;
        </div>
      </section>

      {/* ==================================================
          TROUBLESHOOTING
          ================================================== */}
      <section className="space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-ink border-b border-hairline pb-1.5">
          Troubleshooting
        </h2>

        <div className="space-y-3 text-xs leading-relaxed">
          <div className="border border-hairline p-3.5 rounded-[4px] bg-canvas space-y-1">
            <span className="font-bold text-danger">MCP server not connecting</span>
            <p className="text-ink/75">
              Verify that the <code>cwd</code> in your MCP config points to the directory containing <code>mcp_server.py</code>. Ensure Python has <code>PYTHONUNBUFFERED=1</code> enabled to prevent standard I/O buffer blocking.
            </p>
          </div>

          <div className="border border-hairline p-3.5 rounded-[4px] bg-canvas space-y-1">
            <span className="font-bold text-danger">Backend unavailable</span>
            <p className="text-ink/75">
              Verify your local Node.js backend (port 8000) or Python worker is running. The MCP server will automatically fallback to local JSON trace storage if remote database connections are unavailable.
            </p>
          </div>

          <div className="border border-hairline p-3.5 rounded-[4px] bg-canvas space-y-1">
            <span className="font-bold text-danger">No runs found</span>
            <p className="text-ink/75">
              Confirm your agent is invoking <code>record_step</code> or check if the <code>traces/</code> directory contains recorded JSON files. You can test with the flagship demo run ID <code>run-9a1b2c3d</code>.
            </p>
          </div>

          <div className="border border-hairline p-3.5 rounded-[4px] bg-canvas space-y-1">
            <span className="font-bold text-danger">Invalid run/checkpoint ID</span>
            <p className="text-ink/75">
              Call <code>list_runs</code> to inspect valid recorded identifiers. Checkpoint IDs match the step numbering format (e.g., <code>cp_01</code>, <code>cp_02</code>).
            </p>
          </div>

          <div className="border border-hairline p-3.5 rounded-[4px] bg-canvas space-y-1">
            <span className="font-bold text-danger">Replay failure</span>
            <p className="text-ink/75">
              Ensure <code>forked_at_step</code> points to a valid intermediate node in the trace history. Confirm the patch payload matches the input schema expected by the target node.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
