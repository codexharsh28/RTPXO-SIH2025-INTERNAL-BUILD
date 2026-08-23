"use client";

import React from "react";
import { Train } from "@/types/railway";
import { getTrainCorridorCoordinates } from "@/data/topology";
import { getTrainVisualState } from "@/hooks/useNetworkState";

interface TrainMarkerProps {
  train: Train;
  isSelected?: boolean;
  hasAiAdvisory?: boolean;
  hasStrategy?: boolean;
  inConflict?: boolean;
  inBottleneck?: boolean;
  onSelect?: (train: Train) => void;
}

export const TrainMarker: React.FC<TrainMarkerProps> = ({
  train,
  isSelected = false,
  hasAiAdvisory = false,
  hasStrategy = false,
  inConflict = false,
  inBottleneck = false,
  onSelect,
}) => {
  const coords = getTrainCorridorCoordinates(train);
  const clampedPercent = Math.max(3, Math.min(coords.corridorPercent, 97));
  const isCompleted = train.status === "COMPLETED" || train.completed;

  if (isCompleted) return null;

  // Derive visual state strictly from canonical getTrainVisualState function
  const visual = getTrainVisualState(train, {
    isSelected,
    inConflict: inConflict || train.status === "CONFLICT",
    inBottleneck,
  });

  const priorityOffset = train.priority % 2 === 0 ? 0 : 2;
  const directionSymbol = train.direction === "UP" ? "→" : "←";
  const blockShortName = train.currentBlock
    ? train.currentBlock.split("-").slice(-2).join("-")
    : train.currentSection;

  const isNominalOnTime = visual.statusCategory === "ON_TIME" && !isSelected && !hasAiAdvisory && !hasStrategy;

  return (
    <div
      onClick={() => onSelect?.(train)}
      className={`group absolute top-[104px] z-30 -translate-x-1/2 cursor-pointer transition-all duration-500 ease-linear ${
        isNominalOnTime ? "opacity-70 hover:opacity-100" : "opacity-100"
      }`}
      style={{
        left: `${clampedPercent}%`,
        marginTop: `${priorityOffset}px`,
      }}
    >
      <div className="flex flex-col items-center">
        {/* Fixed 2-Row Stacked Train HUD Card (Zero Text Overlap Guaranteed) */}
        <div
          className={`flex flex-col rounded-2xs border px-1.5 py-1 shadow-lg transition-all duration-150 group-hover:scale-105 select-none font-data min-w-[82px] ${
            isSelected
              ? "ring-2 ring-cyan-400 font-black scale-105"
              : visual.isPulsing
              ? "animate-pulse shadow-[0_0_12px_rgba(239,68,68,0.5)]"
              : isNominalOnTime
              ? "border-emerald-700/60 bg-emerald-950/70"
              : ""
          }`}
          style={{
            backgroundColor: isNominalOnTime ? "#042f2e" : visual.badgeBg,
            borderColor: isNominalOnTime ? "#059669" : visual.badgeBorder,
          }}
        >
          {/* Row 1: Train ID + Priority + Block/Section Bounded Badge */}
          <div className="flex items-center justify-between gap-1 border-b border-white/15 pb-0.5">
            <div className="flex items-center gap-1 flex-shrink-0">
              <span className="text-[9px]">🚆</span>
              <span className="font-extrabold text-[10px] text-white tracking-tight">
                {train.id}
              </span>
            </div>

            <div className="flex items-center gap-0.5 flex-shrink-0">
              <span className="rounded-2xs bg-black/40 border border-white/20 px-1 py-0 text-[7.5px] font-extrabold text-slate-200">
                P{train.priority}
              </span>
              <span className="rounded-2xs bg-black/30 px-1 py-0 text-[7px] text-slate-300 whitespace-nowrap">
                {blockShortName}
              </span>
            </div>
          </div>

          {/* Row 2: Speed + Delay/Status Pill + Direction */}
          <div className="flex items-center justify-between gap-1 pt-0.5 text-[8.5px]">
            <div className="flex items-center gap-0.5 text-white font-bold flex-shrink-0">
              <span>{Math.round(train.speed)}</span>
              <span className="text-[6.5px] text-slate-300 font-normal">km/h</span>
            </div>

            <div className="flex items-center gap-1 flex-shrink-0">
              <span
                className={`font-bold px-1 py-0 rounded-2xs text-[7.5px] bg-black/40 border border-white/20 whitespace-nowrap ${visual.badgeText}`}
              >
                {visual.shortStatusText || visual.statusLabel}
              </span>
              <span className="text-[7.5px] text-cyan-300 font-bold">
                {directionSymbol}
              </span>
            </div>
          </div>
        </div>

        {/* Live Sub-Badge: AI Advisory / Strategy indicator */}
        {(hasAiAdvisory || hasStrategy) && (
          <div className="mt-0.5 flex items-center gap-1 rounded-2xs bg-slate-950/95 border border-slate-800 px-1 py-0 font-data text-[7.5px] shadow-xs">
            {hasAiAdvisory && (
              <span className="text-cyan-300 font-extrabold animate-pulse">
                ⚡ AI REC
              </span>
            )}
            {hasStrategy && (
              <span className="text-purple-300 font-extrabold">
                ⛊ STRAT
              </span>
            )}
          </div>
        )}

        {/* Hover Telemetry Card */}
        <div className="pointer-events-none absolute top-full mt-1.5 hidden -translate-x-1/2 whitespace-nowrap rounded-sm border border-slate-700 bg-slate-950 p-2 text-left text-xs shadow-2xl group-hover:block z-50 font-data">
          <div className="flex items-center justify-between gap-3 font-bold text-white">
            <span className="text-cyan-300">
              {train.name} ({train.id})
            </span>
            <span className="text-slate-400">{coords.cumulativeKm} km</span>
          </div>
          <div className="mt-1 space-y-0.5 text-[10px] text-slate-300">
            <p>
              Status: <strong className={visual.badgeText}>{visual.statusText}</strong> ({train.status})
            </p>
            <p>
              Section: <strong className="text-white">{train.currentSection}</strong> ({Math.round(train.position)}%)
            </p>
            <p>
              Block: <strong className="text-cyan-300">{train.currentBlock || `${train.currentSection}-BLK-01`}</strong>
            </p>
            <p>
              Speed: <strong className="text-white">{Math.round(train.speed)} km/h</strong> | Priority: P{train.priority}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
