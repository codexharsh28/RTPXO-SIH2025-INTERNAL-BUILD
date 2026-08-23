"use client";

import React from "react";
import { StationMilestone } from "@/types/topology";

interface StationMarkerProps {
  station: StationMilestone;
  isFirst: boolean;
  isLast: boolean;
  isSelected?: boolean;
  onSelect?: (station: StationMilestone) => void;
}

export const StationMarker: React.FC<StationMarkerProps> = ({
  station,
  isFirst,
  isLast,
  isSelected = false,
  onSelect,
}) => {
  return (
    <div
      onClick={() => onSelect?.(station)}
      className={`group absolute top-2 z-20 flex cursor-pointer flex-col font-mono ${
        isFirst
          ? "left-0 items-start text-left"
          : isLast
          ? "right-0 items-end text-right"
          : "-translate-x-1/2 items-center text-center"
      }`}
      style={isFirst || isLast ? undefined : { left: `${station.corridorPercent}%` }}
    >
      {/* Station Node Badge */}
      <div
        className={`flex items-center gap-1.5 rounded-sm border bg-slate-900 px-2 py-0.5 shadow-sm transition-all duration-200 ${
          isSelected
            ? "border-white bg-slate-800 ring-2 ring-slate-400"
            : "border-slate-700 hover:border-slate-400"
        }`}
      >
        <div
          className={`h-1.5 w-1.5 rounded-full ${
            isSelected ? "bg-white" : "bg-slate-400"
          }`}
        />
        <span className="font-mono text-[9px] font-bold tracking-wider text-white">
          {station.id}
        </span>
      </div>

      {/* Station Name & Km Milestone */}
      <div className="mt-1 flex flex-col">
        <span className="whitespace-nowrap text-xs font-semibold tracking-wide text-slate-300 group-hover:text-white">
          {station.name}
        </span>
        <div className="flex items-center gap-1 text-[8px] text-slate-500">
          <span>{station.cumulativeKm} km</span>
          <span>•</span>
          <span>{station.platforms} Plt</span>
        </div>
      </div>
    </div>
  );
};
