"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { ExternalLink, Terminal } from "lucide-react";

export function Navbar() {
  const pathname = usePathname();

  const navLinks = [
    { href: "/runs", label: "Runs" },
    { href: "/dashboard", label: "Dashboard" },
    { href: "/docs", label: "Docs" },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-hairline bg-canvas/95 backdrop-blur-sm font-mono text-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        {/* Brand / Logo */}
        <div className="flex items-center gap-6">
          <Link
            href="/"
            className="flex items-center gap-2.5 group focus:outline-none"
          >
            <div className="relative w-7 h-7 rounded-[4px] overflow-hidden border border-hairline bg-surface-dark p-0.5 shadow-xs">
              <Image
                src="/blackbox-logo.jpg"
                alt="Black Box Logo"
                width={28}
                height={28}
                className="object-cover w-full h-full rounded-[2px]"
                priority
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-ink tracking-tight group-hover:text-accent transition-colors">
                Black Box
              </span>
              <span className="text-[10px] text-ink/40 font-normal border border-hairline px-1 py-0.5 rounded-[2px]">
                v1.0
              </span>
            </div>
          </Link>

          {/* Navigation Items: Runs, Dashboard, Docs */}
          <nav className="flex items-center gap-1 pl-4 border-l border-hairline">
            {navLinks.map((item) => {
              const isActive =
                item.href === "/"
                  ? pathname === "/"
                  : pathname?.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3 py-1.5 rounded-[4px] transition-all text-xs ${
                    isActive
                      ? "bg-ink text-canvas font-medium shadow-xs"
                      : "text-ink/70 hover:text-ink hover:bg-surface-soft"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}

            {/* GitHub Link */}
            <a
              href="https://github.com/hardika05/BNB26_Arhmora_Internal_Round"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 px-3 py-1.5 rounded-[4px] text-ink/70 hover:text-ink hover:bg-surface-soft transition-all text-xs"
            >
              <span>GitHub</span>
              <ExternalLink className="w-3 h-3 text-ink/40" />
            </a>
          </nav>
        </div>

        {/* System Telemetry Indicator */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 text-[11px] border border-hairline rounded-[4px] bg-surface-card text-ink/80">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-[10px] tracking-wide">RECORDER // ACTIVE</span>
          </div>
        </div>
      </div>
    </header>
  );
}
