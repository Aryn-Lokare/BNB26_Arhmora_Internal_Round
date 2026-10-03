import React from "react";

interface StatCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  prefix?: string;
  badge?: string;
  trend?: "up" | "down" | "neutral";
  variant?: "default" | "danger" | "warning" | "success";
}

export function StatCard({
  label,
  value,
  subtext,
  prefix = "[STAT]",
  badge,
  variant = "default",
}: StatCardProps) {
  const borderStyles = {
    default: "border-hairline",
    danger: "border-danger/30 bg-danger/5",
    warning: "border-warning/30 bg-warning/5",
    success: "border-success/30 bg-success/5",
  };

  const textStyles = {
    default: "text-ink",
    danger: "text-danger font-bold",
    warning: "text-warning font-bold",
    success: "text-success font-bold",
  };

  return (
    <div
      className={`p-4 bg-surface-card border rounded-[4px] font-mono transition-colors hover:border-ink/20 ${borderStyles[variant]}`}
    >
      <div className="flex items-center justify-between text-[11px] text-ink/60 mb-2">
        <span className="tracking-wide">
          <span className="opacity-60 mr-1.5">{prefix}</span>
          {label}
        </span>
        {badge && (
          <span className="text-[10px] px-1.5 py-0.2 border border-hairline rounded-[2px] bg-canvas">
            {badge}
          </span>
        )}
      </div>

      <div className={`text-2xl font-bold tracking-tight ${textStyles[variant]}`}>
        {value}
      </div>

      {subtext && (
        <div className="mt-1.5 text-[11px] text-ink/60 flex items-center gap-1">
          <span>›</span>
          <span>{subtext}</span>
        </div>
      )}
    </div>
  );
}
