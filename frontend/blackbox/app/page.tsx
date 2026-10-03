import React from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  Terminal,
  Activity,
  Layers,
  RotateCcw,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  GitBranch,
  Wrench,
  Search,
} from "lucide-react";

export default function LandingPage() {
  return (
    <div className="font-mono space-y-16 py-4 sm:py-8 text-ink">
      {/* ==================================================
          HERO SECTION
          ================================================== */}
      <section className="border border-hairline bg-surface-card rounded-[4px] p-6 sm:p-10 lg:p-12 relative overflow-hidden">
        <div className="max-w-3xl space-y-6">
          {/* Eyebrow */}
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-[2px] bg-ink text-canvas text-[11px] font-semibold tracking-wider uppercase">
            <span>[SYS]</span>
            <span>AI AGENT DEBUGGING</span>
          </div>

          {/* Headline */}
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-ink leading-tight">
            When an AI agent fails, find the step that broke it.
          </h1>

          {/* Subheadline */}
          <p className="text-sm sm:text-base text-ink/75 leading-relaxed max-w-2xl">
            Black Box records every decision, tool call, state change, and checkpoint—then helps you locate the root cause, rewind execution, test a fix, and verify the result.
          </p>

          {/* CTAs */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Link
              href="/dashboard"
              className="px-5 py-2.5 bg-ink text-canvas hover:bg-accent text-xs rounded-[4px] font-semibold flex items-center gap-2 transition-colors shadow-xs"
            >
              <span>Explore Dashboard</span>
              <ArrowRight className="w-4 h-4" />
            </Link>

            <Link
              href="/docs"
              className="px-5 py-2.5 border border-hairline rounded-[4px] bg-canvas hover:bg-surface-soft text-xs text-ink font-semibold flex items-center gap-2 transition-colors"
            >
              <span>Read the Docs</span>
            </Link>
          </div>

          {/* Small Supporting Text */}
          <div className="pt-2 text-xs text-ink/50 tracking-wider">
            <code>Trace. Diagnose. Rewind. Fix. Verify.</code>
          </div>
        </div>

        {/* Hero Terminal TUI Mockup (from DESIGN-opencode.ai.md) */}
        <div className="mt-8 border border-hairline bg-surface-dark text-canvas p-5 rounded-[4px] text-xs font-mono shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-[#302c2c] pb-3 text-[#9a9898] text-[11px]">
            <div className="flex items-center gap-2">
              <Terminal className="w-3.5 h-3.5 text-accent" />
              <span>BLACKBOX_TRACE_VIEWER // RUN: run-9a1b2c3d</span>
            </div>
            <span className="text-warning font-semibold">[ROOT_CAUSE_LOCATED: STEP 02]</span>
          </div>

          <div className="space-y-1.5 text-[11px] font-mono leading-relaxed">
            <div className="text-canvas/60">01 [plan]        formulate_plan               status=success</div>
            <div className="text-warning bg-warning/10 p-1 rounded-[2px] border border-warning/30">
              02 [select_tool] query_database               status=success  &lt;-- [!] ROOT CAUSE (P=0.94)
              <div className="text-[10px] text-warning/80 pl-4 mt-0.5">
                Observed: SELECT MIN(budget)... | Expected: SELECT MAX(budget)...
              </div>
            </div>
            <div className="text-canvas/60">03 [run_tool]    execute_query                status=success  (Poisoned payload propagated)</div>
            <div className="text-canvas/60">04 [reflect]     evaluate_output              status=success  (Pass-through)</div>
            <div className="text-danger">
              05 [answer]      assert_gold_sql              status=failed   &lt;-- Final symptom crash
            </div>
          </div>

          <div className="pt-2 border-t border-[#302c2c] flex flex-wrap items-center justify-between text-[11px] text-[#9a9898]">
            <span>REWIND TARGET: checkpoint_cp_02</span>
            <span className="text-emerald-400">COMPUTE SAVED VIA CHECKPOINT REPLAY: 60.0%</span>
          </div>
        </div>
      </section>

      {/* ==================================================
          FEATURES SECTION
          ================================================== */}
      <section className="space-y-6">
        <div className="border-b border-hairline pb-2 flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-ink/60">
            [+] CORE CAPABILITIES
          </h2>
          <span className="text-[11px] text-ink/40">4 MODULES</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Feature 1 */}
          <div className="border border-hairline bg-canvas p-6 rounded-[4px] space-y-2 hover:border-ink/40 transition-colors">
            <div className="flex items-center gap-2 text-ink text-sm font-bold">
              <Layers className="w-4 h-4 text-accent" />
              <span>Execution Traces</span>
            </div>
            <p className="text-xs text-ink/75 leading-relaxed">
              See exactly what your agent did, step by step.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="border border-hairline bg-canvas p-6 rounded-[4px] space-y-2 hover:border-ink/40 transition-colors">
            <div className="flex items-center gap-2 text-ink text-sm font-bold">
              <Search className="w-4 h-4 text-warning" />
              <span>Failure Diagnosis</span>
            </div>
            <p className="text-xs text-ink/75 leading-relaxed">
              Identify the suspicious step instead of guessing from the final error.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="border border-hairline bg-canvas p-6 rounded-[4px] space-y-2 hover:border-ink/40 transition-colors">
            <div className="flex items-center gap-2 text-ink text-sm font-bold">
              <RotateCcw className="w-4 h-4 text-emerald-600" />
              <span>Checkpoint Replay</span>
            </div>
            <p className="text-xs text-ink/75 leading-relaxed">
              Rewind to any checkpoint and continue execution without rerunning everything.
            </p>
          </div>

          {/* Feature 4 */}
          <div className="border border-hairline bg-canvas p-6 rounded-[4px] space-y-2 hover:border-ink/40 transition-colors">
            <div className="flex items-center gap-2 text-ink text-sm font-bold">
              <Wrench className="w-4 h-4 text-ink" />
              <span>Patch &amp; Verify</span>
            </div>
            <p className="text-xs text-ink/75 leading-relaxed">
              Apply a fix, replay the affected path, and compare the result.
            </p>
          </div>
        </div>
      </section>

      {/* ==================================================
          PROBLEM SECTION
          ================================================== */}
      <section className="border border-hairline bg-surface-soft rounded-[4px] p-6 sm:p-10 space-y-4">
        <div className="text-[11px] font-semibold text-danger uppercase tracking-wider">
          [!] THE DIAGNOSTIC GAP
        </div>

        <h2 className="text-xl sm:text-2xl font-extrabold text-ink">
          The final error is rarely the real problem.
        </h2>

        <div className="space-y-3 text-xs sm:text-sm text-ink/80 leading-relaxed max-w-3xl">
          <p>
            Agent failures propagate. One incorrect decision can corrupt state, trigger the wrong tool, and surface as an unrelated error several steps later.
          </p>
          <p className="font-semibold text-ink">
            Black Box works backward through the execution to find where the failure started.
          </p>
        </div>
      </section>

      {/* ==================================================
          HOW IT WORKS (6-STEP WORKFLOW)
          ================================================== */}
      <section className="space-y-6">
        <div className="border-b border-hairline pb-2 flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-ink/60">
            [+] WORKFLOW ARCHITECTURE
          </h2>
          <span className="text-[11px] text-ink/40">END-TO-END PIPELINE</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* 01 — Record */}
          <div className="border border-hairline bg-canvas p-5 rounded-[4px] space-y-2">
            <div className="text-xs font-bold text-ink">01 — Record</div>
            <p className="text-xs text-ink/75 leading-relaxed">
              Capture the complete agent execution.
            </p>
          </div>

          {/* 02 — Diagnose */}
          <div className="border border-hairline bg-canvas p-5 rounded-[4px] space-y-2">
            <div className="text-xs font-bold text-ink">02 — Diagnose</div>
            <p className="text-xs text-ink/75 leading-relaxed">
              Analyze the trace and identify suspicious steps.
            </p>
          </div>

          {/* 03 — Rewind */}
          <div className="border border-hairline bg-canvas p-5 rounded-[4px] space-y-2">
            <div className="text-xs font-bold text-ink">03 — Rewind</div>
            <p className="text-xs text-ink/75 leading-relaxed">
              Restore the agent to a previous checkpoint.
            </p>
          </div>

          {/* 04 — Patch */}
          <div className="border border-hairline bg-canvas p-5 rounded-[4px] space-y-2">
            <div className="text-xs font-bold text-ink">04 — Patch</div>
            <p className="text-xs text-ink/75 leading-relaxed">
              Change the broken decision or state.
            </p>
          </div>

          {/* 05 — Replay */}
          <div className="border border-hairline bg-canvas p-5 rounded-[4px] space-y-2">
            <div className="text-xs font-bold text-ink">05 — Replay</div>
            <p className="text-xs text-ink/75 leading-relaxed">
              Rerun only the affected execution path.
            </p>
          </div>

          {/* 06 — Verify */}
          <div className="border border-hairline bg-canvas p-5 rounded-[4px] space-y-2">
            <div className="text-xs font-bold text-ink">06 — Verify</div>
            <p className="text-xs text-ink/75 leading-relaxed">
              Compare the original and repaired runs.
            </p>
          </div>
        </div>
      </section>

      {/* ==================================================
          FINAL CTA
          ================================================== */}
      <section className="border border-hairline bg-surface-card rounded-[4px] p-8 sm:p-12 text-center space-y-6">
        <h2 className="text-2xl sm:text-3xl font-extrabold text-ink">
          Debug agents like you debug code.
        </h2>

        <div>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-6 py-3 bg-ink text-canvas hover:bg-accent text-xs rounded-[4px] font-semibold transition-colors shadow-xs"
          >
            <span>Open Black Box</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
