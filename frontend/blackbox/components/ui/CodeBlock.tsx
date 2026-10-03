"use client";

import React, { useState } from "react";
import { Check, Copy } from "lucide-react";

interface CodeBlockProps {
  code: string | object;
  language?: string;
  title?: string;
  className?: string;
}

export function CodeBlock({
  code,
  language = "json",
  title,
  className = "",
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const formattedContent =
    typeof code === "object" ? JSON.stringify(code, null, 2) : String(code);

  const handleCopy = () => {
    navigator.clipboard.writeText(formattedContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const lines = formattedContent.split("\n");

  return (
    <div
      className={`border border-hairline bg-surface-dark text-[#ececec] rounded-[4px] overflow-hidden font-mono text-xs ${className}`}
    >
      {/* Header bar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#141212] border-b border-[#2a2626] text-[11px] text-[#999]">
        <div className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-[#3a3535]" />
          <span>{title || language.toUpperCase()}</span>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-[#aaa] hover:text-white hover:bg-[#252222] transition-colors"
          title="Copy code"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-emerald-400" />
              <span className="text-emerald-400">copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              <span>copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code contents with line numbers */}
      <div className="p-3 overflow-x-auto max-h-[360px] scrollbar-thin">
        <pre className="table w-full">
          {lines.map((line, idx) => (
            <div key={idx} className="table-row hover:bg-[#1a1717]">
              <span className="table-cell pr-4 text-right select-none text-[#555] text-[11px] w-6">
                {idx + 1}
              </span>
              <span className="table-cell whitespace-pre text-[#e0dede] leading-relaxed">
                {line}
              </span>
            </div>
          ))}
        </pre>
      </div>
    </div>
  );
}
