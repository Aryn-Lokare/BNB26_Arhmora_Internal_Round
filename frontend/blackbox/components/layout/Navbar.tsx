"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { Terminal, History, PlaySquare, Compass, ShieldCheck } from "lucide-react";

export function Navbar() {
  const pathname = usePathname();

  const navLinks = [
    { href: "/", label: "Dashboard", icon: Compass },
    { href: "/runs", label: "Runs", icon: History },
    { href: "/runs/run-9a1b2c3d", label: "Live Debugger Demo", icon: PlaySquare, badge: "DEMO" },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-hairline bg-canvas/95 backdrop-blur-sm font-mono">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        {/* Logo and Brand */}
        <div className="flex items-center gap-6">
          <Link
            href="/"
            className="flex items-center gap-3 group focus:outline-none"
          >
            <div className="relative w-8 h-8 rounded-[4px] overflow-hidden border border-hairline bg-surface-dark p-0.5 shadow-xs">
              <Image
                src="/blackbox-logo.jpg"
                alt="Black Box Logo"
                width={32}
                height={32}
                className="object-cover w-full h-full rounded-[2px]"
                priority
              />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5 text-sm font-bold text-ink tracking-tight group-hover:text-accent transition-colors">
                <span>BLACK BOX</span>
                <span className="text-[10px] text-ink/40 font-normal">v1.0.4</span>
              </div>
              <span className="text-[10px] text-ink/50 tracking-wider">
                FLIGHT RECORDER FOR AI AGENTS
              </span>
            </div>
          </Link>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-1 pl-4 border-l border-hairline">
            {navLinks.map((item) => {
              const isActive =
                item.href === "/"
                  ? pathname === "/"
                  : pathname?.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-[4px] transition-all ${
                    isActive
                      ? "bg-ink text-canvas font-semibold shadow-xs"
                      : "text-ink/70 hover:text-ink hover:bg-surface-soft"
                  }`}
                >
                  <item.icon className="w-3.5 h-3.5" />
                  <span>{item.label}</span>
                  {item.badge && (
                    <span
                      className={`text-[9px] px-1 py-0.2 rounded-[2px] ml-1 uppercase ${
                        isActive
                          ? "bg-accent text-canvas font-bold"
                          : "bg-accent/15 text-accent font-bold"
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right Status Indicator */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 text-[11px] border border-hairline rounded-[4px] bg-surface-card">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-ink/80 text-[10px]">RECORDER: ACTIVE</span>
          </div>

          <div className="hidden lg:flex items-center gap-1.5 text-[11px] text-ink/50">
            <Terminal className="w-3.5 h-3.5" />
            <span>PORT 8000</span>
          </div>
        </div>
      </div>
    </header>
  );
}
