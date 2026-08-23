"use client";

import React from "react";
import { Signal } from "@/types/railway";

interface SignalHeadProps {
  signal: Signal;
  orientation?: "horizontal" | "vertical";
  compact?: boolean;
  onSelect?: (signal: Signal) => void;
}

export const SignalHead: React.FC<SignalHeadProps> = ({
  signal,
  orientation = "vertical",
  compact = false,
  onSelect,
}) => {
  const isRed = signal.aspect === "RED";
  const isYellow = signal.aspect === "YELLOW" || signal.aspect === "DOUBLE_YELLOW";
  const isGreen = signal.aspect === "GREEN";

  if (compact) {
    return (
      <div
        onClick={() => onSelect?.(signal)}
        title={`${signal.name} (${signal.id}): ${signal.aspect}\n${signal.reason || ""}`}
        className="group relative flex cursor-pointer flex-col items-center"
      >
        {/* Compact Signal Mast */}
        <div className="flex flex-col items-center rounded-xs border border-slate-700 bg-slate-900 p-0.5 shadow-sm transition hover:border-slate-400">
          <div className="flex flex-col gap-0.5">
            {/* Red Lamp */}
            <div
              className={`h-2 w-2 rounded-full transition-all duration-200 ${
                isRed
                  ? "bg-red-500 ring-1 ring-red-400"
                  : "bg-slate-800 opacity-40"
              }`}
            />
            {/* Yellow Lamp */}
            <div
              className={`h-2 w-2 rounded-full transition-all duration-200 ${
                isYellow
                  ? "bg-amber-400 ring-1 ring-amber-300"
                  : "bg-slate-800 opacity-40"
              }`}
            />
            {/* Green Lamp */}
            <div
              className={`h-2 w-2 rounded-full transition-all duration-200 ${
                isGreen
                  ? "bg-emerald-500 ring-1 ring-emerald-400"
                  : "bg-slate-800 opacity-40"
              }`}
            />
          </div>
        </div>

        {/* Signal Tag */}
        <span className="mt-0.5 font-mono text-[8px] font-bold tracking-tight text-slate-400">
          {signal.id.replace("SIG-", "")}
        </span>

        {/* Floating Tooltip on Hover */}
        <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-sm border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-left text-xs shadow-xl group-hover:block font-mono">
          <div className="flex items-center justify-between gap-3 font-bold text-white">
            <span>{signal.id}</span>
            <span
              className={`rounded-xs px-1.5 py-0.2 text-[9px] ${
                isRed
                  ? "bg-red-950 text-red-300 border border-red-800"
                  : isYellow
                  ? "bg-amber-950 text-amber-300 border border-amber-800"
                  : "bg-emerald-950 text-emerald-300 border border-emerald-800"
              }`}
            >
              {signal.aspect}
            </span>
          </div>
          <p className="mt-0.5 text-[10px] text-slate-300">{signal.name}</p>
          {signal.reason && (
            <p className="mt-1 max-w-[220px] text-[9px] leading-tight text-slate-400">
              {signal.reason}
            </p>
          )}
        </div>
      </div>
    );
  }

  // Full detailed card view
  return (
    <div
      onClick={() => onSelect?.(signal)}
      className="flex items-center gap-2.5 rounded-sm border border-slate-300 bg-white p-2.5 transition hover:border-slate-400 font-mono"
    >
      {/* 3-Lamp Signal Housing */}
      <div
        className={`flex ${
          orientation === "vertical" ? "flex-col" : "flex-row"
        } items-center gap-1 rounded-xs border border-slate-800 bg-slate-950 p-1`}
      >
        {/* Red Lamp */}
        <div
          className={`h-3 w-3 rounded-full transition-all duration-200 ${
            isRed
              ? "bg-red-500 ring-1 ring-red-400"
              : "bg-slate-800 opacity-30"
          }`}
        />
        {/* Yellow Lamp */}
        <div
          className={`h-3 w-3 rounded-full transition-all duration-200 ${
            isYellow
              ? "bg-amber-400 ring-1 ring-amber-300"
              : "bg-slate-800 opacity-30"
          }`}
        />
        {/* Green Lamp */}
        <div
          className={`h-3 w-3 rounded-full transition-all duration-200 ${
            isGreen
              ? "bg-emerald-500 ring-1 ring-emerald-400"
              : "bg-slate-800 opacity-30"
          }`}
        />
      </div>

      {/* Signal Info */}
      <div className="flex-1 min-w-0 text-xs">
        <div className="flex items-center justify-between">
          <span className="font-bold text-slate-900 truncate">
            {signal.id}
          </span>
          <span
            className={`text-[10px] font-bold ${
              isRed
                ? "text-red-700"
                : isYellow
                ? "text-amber-700"
                : "text-emerald-700"
            }`}
          >
            {signal.aspect}
          </span>
        </div>
        <p className="text-[11px] text-slate-600 truncate">{signal.name}</p>
        {signal.reason && (
          <p className="mt-0.5 text-[10px] leading-tight text-slate-500 line-clamp-2">
            {signal.reason}
          </p>
        )}
      </div>
    </div>
  );
};
