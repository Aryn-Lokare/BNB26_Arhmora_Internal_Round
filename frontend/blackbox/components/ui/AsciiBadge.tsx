import React from "react";

export type BadgeVariant =
  | "success"
  | "danger"
  | "warning"
  | "info"
  | "neutral"
  | "accent";

interface AsciiBadgeProps {
  status?: string;
  variant?: BadgeVariant;
  label?: string;
  className?: string;
}

export function AsciiBadge({
  status,
  variant,
  label,
  className = "",
}: AsciiBadgeProps) {
  // Determine variant from status if not explicitly given
  let calculatedVariant: BadgeVariant = variant || "neutral";
  let prefix = "[·]";

  if (!variant && status) {
    const s = status.toLowerCase();
    if (s === "success" || s === "passed" || s === "completed" || s === "ok") {
      calculatedVariant = "success";
      prefix = "[OK]";
    } else if (s === "failed" || s === "error" || s === "failure") {
      calculatedVariant = "danger";
      prefix = "[FAIL]";
    } else if (s === "suspect" || s === "suspicious" || s === "root_cause") {
      calculatedVariant = "warning";
      prefix = "[SUSPECT]";
    } else if (s === "replayed" || s === "forked") {
      calculatedVariant = "accent";
      prefix = "[REPLAY]";
    } else if (s === "running" || s === "recording") {
      calculatedVariant = "info";
      prefix = "[REC]";
    }
  }

  const text = label || status || "";

  const variantStyles: Record<BadgeVariant, string> = {
    success: "border-success/30 text-success bg-success/5",
    danger: "border-danger/30 text-danger bg-danger/5",
    warning: "border-warning/40 text-warning bg-warning/5 font-semibold",
    accent: "border-accent/40 text-accent bg-accent/5",
    info: "border-ink/20 text-ink/80 bg-surface-soft",
    neutral: "border-hairline text-ink/70 bg-canvas",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 font-mono text-[11px] tracking-tight border rounded-[3px] select-none ${variantStyles[calculatedVariant]} ${className}`}
    >
      <span className="opacity-80 text-[10px]">{prefix}</span>
      <span>{text}</span>
    </span>
  );
}
