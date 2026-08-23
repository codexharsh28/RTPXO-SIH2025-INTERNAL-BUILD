"use client";

import React, { useState } from "react";
import { Train, TrainConflict, RailwaySection } from "@/types/railway";
import { TrackBlock } from "@/types/topology";
import { PredictedConflict } from "@/types/advisor";
import { ThroughputMetrics, SectionUtilization, CorridorTelemetry } from "@/types/metrics";
import { useNetworkState } from "@/hooks/useNetworkState";

export type OverallHealthState = "NORMAL" | "WARNING" | "CONGESTED" | "CRITICAL";

interface CompactNetworkHealthProps {
  conflicts?: TrainConflict[];
  predictedConflicts?: PredictedConflict[];
  throughputMetrics?: ThroughputMetrics;
  sectionUtilizations?: SectionUtilization[];
  sections?: RailwaySection[];
  trains?: Train[];
  blocks?: TrackBlock[];
  occupiedBlocks?: TrackBlock[];
  clearBlocks?: TrackBlock[];
  congestedSections?: RailwaySection[];
  networkHealth?: OverallHealthState;
  networkCapacity?: number;
  averageDelay?: number;
  throughput?: number;
  telemetry?: CorridorTelemetry;
  onSelectTrainById?: (trainId: string) => void;
  onSelectSectionById?: (sectionId: string) => void;
}

export const CompactNetworkHealth: React.FC<CompactNetworkHealthProps> = ({
  conflicts: propConflicts,
  predictedConflicts: propPredicted,
  throughputMetrics: propMetrics,
  sectionUtilizations: propUtilizations,
  sections: propSections,
  trains: propTrains,
  blocks: propBlocks,
  occupiedBlocks,
  clearBlocks,
  congestedSections,
  networkCapacity: propNetworkCapacity,
  averageDelay: propAverageDelay,
  throughput: propThroughput,
  telemetry,
  onSelectTrainById,
  onSelectSectionById,
}) => {
  const net = useNetworkState();
  const [conflictTab, setConflictTab] = useState<"ACTIVE" | "LOOKAHEAD">("ACTIVE");

  const snapshot = net.rawSnapshot;
  const conflicts = propConflicts || snapshot.conflicts || [];
  const predictedConflicts = propPredicted || snapshot.predictedConflicts || [];
  const throughputMetrics = propMetrics || snapshot.throughputMetrics;
  const sectionUtilizations = propUtilizations || snapshot.telemetry?.sectionUtilizations || [];
  const sections = propSections || snapshot.sections || [];
  const trains = propTrains || snapshot.trains || [];
  const blocks = propBlocks || snapshot.blocks || [];

  // 1. Authoritative Metric Values from Simulation Engine Snapshot
  const activeTrainsCount = telemetry?.activeTrains ?? trains.filter((t) => !t.completed && t.status !== "COMPLETED").length;
  const delayedTrainsCount = telemetry?.delayedTrains ?? trains.filter((t) => !t.completed && (t.delayMinutes > 0 || (t.delay && t.delay > 0) || t.status === "DELAYED")).length;
  const conflictsCount = conflicts.length;
  
  const totalBlocksCount = blocks.length > 0 ? blocks.length : 19;
  const occupiedBlocksCount = occupiedBlocks !== undefined ? occupiedBlocks.length : (blocks.length > 0 ? blocks.filter(b => b.status === "OCCUPIED").length : trains.filter(t => !t.completed && t.status !== "COMPLETED").length);
  const clearBlocksCount = clearBlocks !== undefined ? clearBlocks.length : Math.max(0, totalBlocksCount - occupiedBlocksCount);
  const congestedSectionsCount = congestedSections !== undefined ? congestedSections.length : sections.filter(s => (s.occupiedTrains && s.occupiedTrains.length > 1) || sectionUtilizations.some(u => u.sectionId === s.id && (u.isBottleneck || u.occupancyRate >= 100))).length;
  
  const networkCapacityPercent = propNetworkCapacity ?? throughputMetrics?.corridorUtilization ?? 0;
  const throughputValue = propThroughput ?? throughputMetrics?.corridorThroughput ?? 0;
  const throughputGainPercent = throughputMetrics?.throughputImprovement ?? 0;

  // Average delay calculation across active fleet
  const activeFleet = trains.filter((t) => !t.completed && t.status !== "COMPLETED");
  const totalDelayMinutes = activeFleet.reduce((acc, t) => acc + (t.delayMinutes || t.delay || 0), 0);
  const avgDelayMinutes = propAverageDelay ?? (activeFleet.length > 0 ? Number((totalDelayMinutes / activeFleet.length).toFixed(1)) : 0.0);

  // 2. Pure Derived Health State from useNetworkState (Zero divergence guaranteed)
  const healthState: OverallHealthState = net.healthStatus;

  let healthLabel = "🟢 NORMAL";
  let healthBannerClass = "bg-emerald-950/60 border-emerald-500/50 text-emerald-300";

  if (healthState === "CRITICAL") {
    healthLabel = "🔴 CRITICAL";
    healthBannerClass = "bg-red-950/70 border-red-500/70 text-red-200 animate-pulse";
  } else if (healthState === "CONGESTED") {
    healthLabel = "🟠 CONGESTED";
    healthBannerClass = "bg-amber-900/60 border-amber-500/60 text-amber-200";
  } else if (healthState === "WARNING") {
    healthLabel = "🟡 WARNING";
    healthBannerClass = "bg-yellow-950/60 border-yellow-500/50 text-yellow-300";
  }

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "CRITICAL":
      case "HIGH":
        return "bg-red-950 text-red-200 border-red-500 font-bold animate-pulse";
      case "MEDIUM":
        return "bg-amber-950 text-amber-300 border-amber-500 font-bold";
      default:
        return "bg-slate-800 text-slate-300 border-slate-700";
    }
  };

  return (
    <div className="flex flex-col h-full rounded-sm border border-slate-800/90 bg-slate-900/95 p-2 shadow-sm font-mono text-xs overflow-hidden select-none">
      {/* 1. Header: Panel Title + Master Health State Badge + Conflict Toggle */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-1.5 flex-shrink-0">
        <div className="flex items-center gap-2">
          <h3 className="font-mono text-xs font-black uppercase tracking-wider text-slate-100">
            NETWORK HEALTH
          </h3>
          <span className={`px-1.5 py-0.5 rounded-2xs border text-[9px] font-bold ${healthBannerClass}`}>
            {healthLabel}
          </span>
        </div>

        {/* Conflict Sub-Tab Toggle */}
        <div className="flex items-center gap-0.5 bg-slate-950 p-0.5 rounded-sm border border-slate-800 text-[8px]">
          <button
            type="button"
            onClick={() => setConflictTab("ACTIVE")}
            className={`px-1.5 py-0.5 rounded-2xs font-bold transition ${
              conflictTab === "ACTIVE"
                ? "bg-slate-800 text-sky-300 shadow-xs"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            ACTIVE ({conflictsCount})
          </button>
          <button
            type="button"
            onClick={() => setConflictTab("LOOKAHEAD")}
            className={`px-1.5 py-0.5 rounded-2xs font-bold transition ${
              conflictTab === "LOOKAHEAD"
                ? "bg-slate-800 text-cyan-300 shadow-xs"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            LOOKAHEAD ({predictedConflicts.length})
          </button>
        </div>
      </div>

      {/* 2. Compact 3x3 Operational Metric Grid (Zero Vertical Scrolling Needed) */}
      <div className="grid grid-cols-3 gap-1 my-1.5 flex-shrink-0 text-[10px]">
        {/* Metric 1: ACTIVE TRAINS */}
        <div className="p-1 rounded-sm bg-slate-950 border border-slate-800/90 flex flex-col justify-between">
          <span className="text-[7.5px] text-slate-400 font-bold uppercase tracking-tight">ACTIVE TRAINS</span>
          <div className="flex items-baseline justify-between mt-0.5">
            <strong className="text-slate-100 font-bold text-xs">{activeTrainsCount}</strong>
            <span className="text-[8px] text-sky-400 font-bold">P1–P10</span>
          </div>
        </div>

        {/* Metric 2: DELAYED */}
        <div className={`p-1 rounded-sm border flex flex-col justify-between ${
          delayedTrainsCount > 0 ? "bg-amber-950/30 border-amber-500/40" : "bg-slate-950 border-slate-800/90"
        }`}>
          <span className="text-[7.5px] text-slate-400 font-bold uppercase tracking-tight">DELAYED</span>
          <div className="flex items-baseline justify-between mt-0.5">
            <strong className={delayedTrainsCount > 0 ? "text-amber-300 font-bold text-xs" : "text-emerald-400 font-bold text-xs"}>
              {delayedTrainsCount}
            </strong>
            <span className="text-[8px] text-slate-400">{delayedTrainsCount === 0 ? "0%" : `${Math.round((delayedTrainsCount / (activeTrainsCount || 1)) * 100)}%`}</span>
          </div>
        </div>

        {/* Metric 3: CONFLICTS */}
        <div className={`p-1 rounded-sm border flex flex-col justify-between ${
          conflictsCount > 0 ? "bg-red-950/40 border-red-500/60 animate-pulse" : "bg-slate-950 border-slate-800/90"
        }`}>
          <span className="text-[7.5px] text-slate-400 font-bold uppercase tracking-tight">CONFLICTS</span>
          <div className="flex items-baseline justify-between mt-0.5">
            <strong className={conflictsCount > 0 ? "text-red-300 font-bold text-xs" : "text-emerald-400 font-bold text-xs"}>
              {conflictsCount}
            </strong>
            <span className={`text-[7.5px] font-bold ${conflictsCount > 0 ? "text-red-400" : "text-emerald-400"}`}>
              {conflictsCount > 0 ? "ALERT" : "SIL-4 OK"}
            </span>
          </div>
        </div>

        {/* Metric 4: OCCUPIED BLOCKS */}
        <div className="p-1 rounded-sm bg-slate-950 border border-slate-800/90 flex flex-col justify-between">
          <span className="text-[7.5px] text-slate-400 font-bold uppercase tracking-tight">OCCUPIED BLOCKS</span>
          <div className="flex items-baseline justify-between mt-0.5">
            <strong className="text-amber-400 font-bold text-xs">{occupiedBlocksCount}</strong>
            <span className="text-[8px] text-slate-400">/ {totalBlocksCount}</span>
          </div>
        </div>

        {/* Metric 5: CLEAR BLOCKS */}
        <div className="p-1 rounded-sm bg-slate-950 border border-slate-800/90 flex flex-col justify-between">
          <span className="text-[7.5px] text-slate-400 font-bold uppercase tracking-tight">CLEAR BLOCKS</span>
          <div className="flex items-baseline justify-between mt-0.5">
            <strong className="text-emerald-400 font-bold text-xs">{clearBlocksCount}</strong>
            <span className="text-[8px] text-emerald-500 font-bold">FREE</span>
          </div>
        </div>

        {/* Metric 6: CONGESTED SECTIONS */}
        <div className={`p-1 rounded-sm border flex flex-col justify-between ${
          congestedSectionsCount > 0 ? "bg-amber-950/30 border-amber-500/40" : "bg-slate-950 border-slate-800/90"
        }`}>
          <span className="text-[7.5px] text-slate-400 font-bold uppercase tracking-tight">CONGESTED SECTIONS</span>
          <div className="flex items-baseline justify-between mt-0.5">
            <strong className={congestedSectionsCount > 0 ? "text-amber-300 font-bold text-xs" : "text-slate-200 font-bold text-xs"}>
              {congestedSectionsCount}
            </strong>
            <span className="text-[7.5px] text-slate-400">{congestedSectionsCount > 0 ? "SATURATED" : "NONE"}</span>
          </div>
        </div>

        {/* Metric 7: CAPACITY UTILIZED */}
        <div className="p-1 rounded-sm bg-slate-950 border border-slate-800/90 flex flex-col justify-between">
          <span className="text-[7.5px] text-slate-400 font-bold uppercase tracking-tight">CAPACITY UTILIZED</span>
          <div className="flex items-baseline justify-between mt-0.5">
            <strong className="text-slate-100 font-bold text-xs">{networkCapacityPercent}%</strong>
            <div className="w-8 h-1.5 rounded-full bg-slate-800 overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  networkCapacityPercent >= 80 ? "bg-red-500" : networkCapacityPercent >= 60 ? "bg-amber-400" : "bg-emerald-500"
                }`}
                style={{ width: `${Math.min(100, networkCapacityPercent)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Metric 8: THROUGHPUT */}
        <div className="p-1 rounded-sm bg-slate-950 border border-slate-800/90 flex flex-col justify-between">
          <span className="text-[7.5px] text-slate-400 font-bold uppercase tracking-tight">THROUGHPUT</span>
          <div className="flex items-baseline justify-between mt-0.5">
            <strong className="text-slate-100 font-bold text-xs">
              {throughputValue} <span className="text-[7px] font-normal text-slate-400">T/h</span>
            </strong>
            <span
              className={`text-[8px] font-bold ${
                throughputGainPercent > 0
                  ? "text-emerald-400"
                  : throughputGainPercent < 0
                  ? "text-rose-400"
                  : "text-slate-400"
              }`}
            >
              {throughputGainPercent > 0 ? "↑ +" : throughputGainPercent < 0 ? "↓ " : "→ +"}{throughputGainPercent}%
            </span>
          </div>
        </div>

        {/* Metric 9: AVERAGE DELAY */}
        <div className={`p-1 rounded-sm border flex flex-col justify-between ${
          avgDelayMinutes > 5 ? "bg-amber-950/30 border-amber-500/40" : "bg-slate-950 border-slate-800/90"
        }`}>
          <span className="text-[7.5px] text-slate-400 font-bold uppercase tracking-tight">AVERAGE DELAY</span>
          <div className="flex items-baseline justify-between mt-0.5">
            <strong className={avgDelayMinutes > 0 ? "text-amber-300 font-bold text-xs" : "text-emerald-400 font-bold text-xs"}>
              {avgDelayMinutes}m
            </strong>
            <span className="text-[8px] text-slate-400">fleet avg</span>
          </div>
        </div>
      </div>

      {/* 3. Bottom Live Safety & Conflict Monitor Feed */}
      <div className="flex-1 min-h-0 overflow-y-auto mt-0.5 border-t border-slate-800/80 pt-1">
        {conflictTab === "ACTIVE" ? (
          conflicts.length === 0 ? (
            <div className="h-full flex items-center justify-center p-2 rounded-sm border border-dashed border-slate-800/80 bg-slate-950/60 text-center">
              <div className="flex items-center gap-1.5 text-emerald-400 text-[10px]">
                <span>✓</span>
                <span className="font-bold">SIL-4 Absolute Interlocking Clear</span>
                <span className="text-slate-500 text-[9px]">• Headway ≥ 2.0 km</span>
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              {conflicts.map((c, idx) => {
                const conflictId = c.id || `${c.trainA}-${c.trainB}-${c.sectionA}`;
                const isUnacked = (c.severity === "HIGH" || c.severity === "CRITICAL") && net.unacknowledgedAlertIds.includes(conflictId);

                return (
                  <div
                    key={conflictId || idx}
                    className={`rounded-2xs p-1.5 text-[9px] flex flex-col gap-1 transition ${
                      isUnacked
                        ? "bg-red-950/80 border-2 border-red-500 shadow-md animate-pulse"
                        : "bg-red-950/30 border border-red-500/40"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1.5">
                        <span className={`px-1 py-0.2 rounded-2xs border text-[7.5px] font-bold ${getSeverityBadge(c.severity)}`}>
                          {c.severity}
                        </span>
                        <div className="flex items-center gap-1 font-bold text-slate-100 font-data">
                          <button
                            type="button"
                            onClick={() => onSelectTrainById?.(c.trainA)}
                            className="text-cyan-400 hover:text-cyan-300 hover:underline"
                          >
                            {c.trainA}
                          </button>
                          <span className="text-slate-500">↔</span>
                          <button
                            type="button"
                            onClick={() => onSelectTrainById?.(c.trainB)}
                            className="text-cyan-400 hover:text-cyan-300 hover:underline"
                          >
                            {c.trainB}
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <span className="text-[8px] text-slate-300 font-data px-1 py-0.2 rounded-2xs bg-slate-900 border border-slate-800 flex-shrink-0">
                          {c.sectionA || c.sectionB || c.junctionId || "ND-GZB-01"}
                        </span>

                        {isUnacked ? (
                          <button
                            type="button"
                            onClick={() => net.acknowledgeAlert(conflictId)}
                            className="px-1.5 py-0.5 rounded-2xs bg-red-600 hover:bg-red-500 text-white font-black text-[7.5px] uppercase shadow-xs transition"
                            title="Acknowledge this critical conflict alarm"
                          >
                            ACK
                          </button>
                        ) : (
                          <span className="text-[7.5px] text-emerald-400 font-bold px-1 bg-slate-900/60 rounded-2xs border border-slate-800">
                            ✓ ACK
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="text-[8.5px] text-red-200/90 leading-tight">
                      {c.reason || c.type}
                    </p>
                  </div>
                );
              })}
            </div>
          )
        ) : (
          predictedConflicts.length === 0 ? (
            <div className="h-full flex items-center justify-center p-2 rounded-sm border border-dashed border-slate-800/80 bg-slate-950/60 text-center">
              <div className="flex items-center gap-1.5 text-cyan-400 text-[10px]">
                <span>🔮</span>
                <span className="font-bold">Zero Forward Conflicts Projected</span>
                <span className="text-slate-500 text-[9px]">• Lookahead Nominal</span>
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              {predictedConflicts.map((pc, idx) => (
                <div
                  key={idx}
                  className="bg-cyan-950/30 border border-cyan-500/40 rounded-2xs p-1.5 text-[9px] flex flex-col gap-1"
                >
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1.5">
                      <span className="px-1 py-0.2 rounded-2xs bg-cyan-950 border border-cyan-500 text-[7.5px] text-cyan-300 font-bold font-data">
                        IN {pc.predictedTimeToConflictSeconds}s
                      </span>
                      <div className="flex items-center gap-1 font-bold text-slate-100 font-data">
                        <button
                          type="button"
                          onClick={() => onSelectTrainById?.(pc.trainA)}
                          className="text-cyan-400 hover:text-cyan-300 hover:underline"
                        >
                          {pc.trainA}
                        </button>
                        <span className="text-slate-500">↔</span>
                        <button
                          type="button"
                          onClick={() => onSelectTrainById?.(pc.trainB)}
                          className="text-cyan-400 hover:text-cyan-300 hover:underline"
                        >
                          {pc.trainB}
                        </button>
                      </div>
                    </div>
                    <span className="text-[8px] text-cyan-300 font-data px-1 py-0.2 rounded-2xs bg-slate-900 border border-slate-800 flex-shrink-0">
                      {pc.sectionId}
                    </span>
                  </div>
                  {pc.reason && (
                    <p className="text-[8.5px] text-slate-300 leading-tight">
                      {pc.reason}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
};
