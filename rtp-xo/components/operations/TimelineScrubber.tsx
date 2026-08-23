"use client";

import React from "react";
import { SimulationSnapshot } from "@/types/simulation";
import { simulationEngine } from "@/engine/simulationEngine";
import { TimelineCheckpoint } from "@/types/optimization";

interface TimelineScrubberProps {
  snapshot: SimulationSnapshot;
}

export const TimelineScrubber: React.FC<TimelineScrubberProps> = ({ snapshot }) => {
  const timeline = snapshot.predictedForwardState?.timeline || [];
  const selectedOffset = snapshot.selectedTimelineOffset ?? 0;

  const currentCheckpoint: TimelineCheckpoint | undefined =
    timeline.find((cp) => cp.offsetSeconds === selectedOffset) || timeline[0];

  const handleSelectOffset = (offset: number) => {
    simulationEngine.setSelectedTimelineOffset(offset);
  };

  if (timeline.length === 0) {
    return null;
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 text-xs shadow-sm text-white font-mono">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-100 flex items-center gap-1.5 uppercase tracking-wide">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400" />
            Predictive Timeline Scrubber
          </span>
          <span className="text-[9px] uppercase px-1.5 py-0.2 rounded-sm bg-slate-800 text-slate-300 border border-slate-700 font-semibold">
            Operational Replay
          </span>
        </div>
        <div className="text-[11px] text-slate-400">
          Horizon: <strong className="text-white">{snapshot.predictionHorizonSeconds}s</strong> | Checkpoints: <strong className="text-white">{timeline.length}</strong>
        </div>
      </div>

      {/* Timeline Checkpoint Buttons (Charcoal/Grey/Black Industrial Style) */}
      <div className="grid grid-cols-5 gap-1.5 mb-2">
        {timeline.map((cp) => {
          const isSelected = cp.offsetSeconds === selectedOffset;
          const hasConflict = cp.activeConflictsCount > 0;
          const hasHeadwayIssue = cp.headways.some((h) => !h.isHeadwayCompliant);

          return (
            <button
              key={cp.offsetSeconds}
              onClick={() => handleSelectOffset(cp.offsetSeconds)}
              className={`flex flex-col items-center justify-center py-1.5 px-2 rounded-sm border transition-all text-center ${
                isSelected
                  ? "bg-slate-100 border-white text-slate-950 font-bold shadow-xs"
                  : "bg-slate-800 hover:bg-slate-750 border-slate-700 text-slate-300 hover:text-white"
              }`}
            >
              <span className="font-bold text-[11px]">
                {cp.offsetSeconds === 0 ? "T+0s (LIVE)" : `+${cp.offsetSeconds}s`}
              </span>
              <div className="flex items-center gap-1 mt-0.5">
                {hasConflict && (
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500" title="Active Conflict" />
                )}
                {hasHeadwayIssue && (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" title="Headway < 2.0km" />
                )}
                {!hasConflict && !hasHeadwayIssue && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" title="Clear / Nominal" />
                )}
                <span className={`text-[9px] ${isSelected ? "text-slate-700" : "text-slate-400"}`}>
                  {cp.trains.length}T
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Active Checkpoint Telemetry Details */}
      {currentCheckpoint && (
        <div className="bg-slate-950 rounded-sm p-2 border border-slate-800 text-[11px] grid grid-cols-4 gap-2 text-center">
          <div>
            <span className="text-slate-500 block text-[9px] uppercase font-semibold">Active Lookahead</span>
            <strong className="text-white">
              {currentCheckpoint.offsetSeconds === 0 ? "Live State (+0s)" : `T + ${currentCheckpoint.offsetSeconds}s`}
            </strong>
          </div>
          <div>
            <span className="text-slate-500 block text-[9px] uppercase font-semibold">Predicted Conflicts</span>
            <strong
              className={
                currentCheckpoint.activeConflictsCount > 0 ? "text-red-400" : "text-emerald-400"
              }
            >
              {currentCheckpoint.activeConflictsCount}
            </strong>
          </div>
          <div>
            <span className="text-slate-500 block text-[9px] uppercase font-semibold">Bottleneck</span>
            <strong className="text-slate-300">
              {currentCheckpoint.bottleneckSection || "None"}
            </strong>
          </div>
          <div>
            <span className="text-slate-500 block text-[9px] uppercase font-semibold">Headways</span>
            <strong
              className={
                currentCheckpoint.headways.every((h) => h.isHeadwayCompliant)
                  ? "text-emerald-400"
                  : "text-amber-400"
              }
            >
              {currentCheckpoint.headways.length > 0
                ? `${currentCheckpoint.headways.filter((h) => h.isHeadwayCompliant).length}/${currentCheckpoint.headways.length} Safe`
                : "No Pairs"}
            </strong>
          </div>
        </div>
      )}
    </div>
  );
};
