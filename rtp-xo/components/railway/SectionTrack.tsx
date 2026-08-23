"use client";

import React from "react";
import { RailwaySection } from "@/types/railway";
import { SectionRange } from "@/types/topology";
import { SectionUtilization } from "@/types/metrics";
import { ActiveIncident } from "@/types/incident";

interface SectionTrackProps {
  section: RailwaySection;
  topology: SectionRange;
  utilization?: SectionUtilization;
  isSelected?: boolean;
  onSelect?: (section: RailwaySection) => void;
  activeIncident?: ActiveIncident;
}

export const SectionTrack: React.FC<SectionTrackProps> = ({
  section,
  topology,
  utilization,
  isSelected = false,
  onSelect,
  activeIncident,
}) => {
  const isBlocked =
    section.status === "BLOCKED" ||
    section.status === "RESTRICTED" ||
    activeIncident?.isCompleteBlockage ||
    activeIncident?.type === "TRACK_SECTION_BLOCKAGE";
  const isTsr = activeIncident?.type === "TEMPORARY_SPEED_RESTRICTION";
  const isOccupied = section.status === "OCCUPIED" || (section.occupiedTrains && section.occupiedTrains.length > 0);
  const trainCount = section.occupiedTrains?.length || (isOccupied ? 1 : 0);

  const leftPercent = topology.startPercent;
  const widthPercent = topology.endPercent - topology.startPercent;

  return (
    <div
      onClick={() => onSelect?.(section)}
      className="group absolute top-[72px] cursor-pointer"
      style={{
        left: `${leftPercent}%`,
        width: `${widthPercent}%`,
      }}
    >
      {/* Rail Bed & Ties */}
      <div className="relative h-6 w-full flex items-center px-1">
        {/* Sleeper Track Pattern Background */}
        <div
          className="absolute inset-x-0 top-1/2 h-4 -translate-y-1/2 rounded-xs border border-slate-800 opacity-60"
          style={{
            backgroundImage:
              "repeating-linear-gradient(90deg, #334155 0, #334155 2px, transparent 2px, transparent 10px)",
          }}
        />

        {/* Dynamic Rail Line */}
        <div
          className={`relative h-2 w-full rounded-sm transition-all duration-300 ${
            isBlocked
              ? "bg-red-600 shadow-xs animate-pulse"
              : isTsr
              ? "bg-amber-500 shadow-xs"
              : isOccupied
              ? "bg-amber-400"
              : "bg-slate-600 hover:bg-slate-500"
          } ${
            isSelected ? "ring-2 ring-white ring-offset-2 ring-offset-slate-950" : ""
          }`}
        />
      </div>

      {/* Section Milestone & Meta Label */}
      <div className="mt-1 flex flex-col items-center px-2 text-center font-mono">
        <div className="flex items-center gap-1 text-[9px] font-bold text-slate-300 group-hover:text-white">
          <span>{topology.name}</span>
          {isTsr && (
            <span className="rounded-xs bg-amber-900 border border-amber-600 px-1 text-[7px] font-bold text-amber-200">
              TSR {activeIncident?.imposedSpeedLimitKmH} km/h
            </span>
          )}
          {isBlocked && (
            <span className="rounded-xs bg-red-900 border border-red-600 px-1 text-[7px] font-bold text-red-200 animate-pulse">
              BLOCK
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 text-[8px] text-slate-400">
          <span>{topology.lengthKm} km</span>
          <span>•</span>
          <span>Max {isTsr ? `${activeIncident?.imposedSpeedLimitKmH} (TSR)` : `${topology.maximumSpeed}`} km/h</span>
          <span>•</span>
          <span
            className={`font-semibold ${
              isBlocked
                ? "text-red-400"
                : isTsr
                ? "text-amber-300"
                : isOccupied
                ? "text-amber-400"
                : "text-emerald-400"
            }`}
          >
            {isBlocked ? "BLOCKED" : isTsr ? "TSR ACTIVE" : isOccupied ? `${trainCount} TRAIN` : "CLEAR"}
          </span>
        </div>

        {/* Utilization density meter if trains present */}
        {utilization && utilization.occupancyRate > 0 && (
          <div className="mt-1 h-1 w-16 overflow-hidden rounded-full bg-slate-800">
            <div
              className={`h-full transition-all duration-300 ${
                utilization.occupancyRate >= 100
                  ? "bg-red-500"
                  : utilization.occupancyRate >= 50
                  ? "bg-amber-400"
                  : "bg-emerald-500"
              }`}
              style={{ width: `${Math.min(100, utilization.occupancyRate)}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
};
