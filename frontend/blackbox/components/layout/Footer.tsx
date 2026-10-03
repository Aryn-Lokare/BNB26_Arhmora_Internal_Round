import React from "react";

export function Footer() {
  return (
    <footer className="w-full border-t border-hairline bg-canvas font-mono text-xs py-8 text-ink/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="font-bold text-ink text-sm">BLACK BOX</span>
            <span>—</span>
            <span>Deterministic Flight Recorder & Time-Travel Debugger</span>
          </div>
          <p className="text-[11px] text-ink/50">
            Capturing agent traces, localizing root causes, and replaying from checkpoints with state injection.
          </p>
        </div>

        <div className="flex items-center gap-6 text-[11px]">
          <span className="flex items-center gap-1.5">
            <span className="text-ink/40">[SYS]</span> LangGraph v0.2 + SQLite
          </span>
          <span className="flex items-center gap-1.5">
            <span className="text-ink/40">[DIAG]</span> Counterfactual Reasoning Engine
          </span>
          <span className="text-ink/40">© 2026 BLACKBOX</span>
        </div>
      </div>
    </footer>
  );
}
