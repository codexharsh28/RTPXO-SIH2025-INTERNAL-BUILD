"use client";

import React from "react";
import { Train } from "@/types/railway";

interface HeadwayBracketProps {
  trainA: Train;
  trainB: Train;
  diffKm: number;
  leftPercent: number;
  rightPercent: number;
}

export const HeadwayBracket: React.FC<HeadwayBracketProps> = ({
  trainA,
  trainB,
  diffKm,
  leftPercent,
  rightPercent,
}) => {
  const minLeft = Math.max(0, Math.min(leftPercent, rightPercent));
  const maxRight = Math.min(100, Math.max(leftPercent, rightPercent));
  const widthPercent = Math.max(1.5, maxRight - minLeft);

  const isCritical = diffKm < 1.5;
  const isCaution = diffKm >= 1.5 && diffKm < 2.0;

  const getStyle = () => {
    if (isCritical) {
      return {
        line: "border-red-600",
        badge: "border-red-600 bg-red-950 text-red-100 font-bold",
        text: "text-red-400",
        label: "HEADWAY BREACH (< 1.5 km)",
      };
    }
    if (isCaution) {
      return {
        line: "border-amber-600",
        badge: "border-amber-600 bg-amber-950 text-amber-100 font-bold",
        text: "text-amber-400",
        label: "HEADWAY CAUTION (1.5 - 2.0 km)",
      };
    }
    return {
      line: "border-slate-500",
      badge: "border-slate-600 bg-slate-900 text-slate-200 font-semibold",
      text: "text-slate-400",
      label: "SAFE HEADWAY (≥ 2.0 km)",
    };
  };

  const style = getStyle();

  return (
    <div
      className="absolute top-[135px] pointer-events-auto z-15 group"
      style={{
        left: `${minLeft}%`,
        width: `${widthPercent}%`,
      }}
    >
      {/* Horizontal bracket line with vertical end caps */}
      <div className={`relative h-2 border-b ${style.line}`}>
        <div className={`absolute left-0 -top-1 h-2.5 w-0.5 bg-current ${style.text}`} />
        <div className={`absolute right-0 -top-1 h-2.5 w-0.5 bg-current ${style.text}`} />

        {/* Center Pill */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <div
            className={`flex items-center gap-1 rounded-xs border px-1.5 py-0.2 font-mono text-[8px] whitespace-nowrap ${style.badge}`}
          >
            <span>⟷</span>
            <span>{diffKm.toFixed(1)} km</span>
          </div>
        </div>
      </div>

      {/* Hover Tooltip */}
      <div className="invisible absolute bottom-full left-1/2 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-sm border border-slate-700 bg-slate-900 p-2 font-mono text-[9px] text-slate-200 opacity-0 shadow-xl transition-all duration-150 group-hover:visible group-hover:opacity-100 z-50 pointer-events-none">
        <div className="flex items-center gap-1 font-bold border-b border-slate-800 pb-1 mb-1">
          <span className={style.text}>📏 {style.label}</span>
        </div>
        <div className="text-slate-300">
          Spatial Separation: <strong className="text-white">{diffKm.toFixed(2)} km</strong>
        </div>
        <div className="text-slate-400">
          Between: <span className="text-slate-200">{trainA.id}</span> & <span className="text-slate-200">{trainB.id}</span>
        </div>
      </div>
    </div>
  );
};
