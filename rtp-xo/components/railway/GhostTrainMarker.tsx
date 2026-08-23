"use client";

import React from "react";
import { PredictedTrainState } from "@/types/optimization";
import { getSectionPositionCoordinates } from "@/data/topology";

interface GhostTrainMarkerProps {
  predictedTrain: PredictedTrainState;
  liveCorridorPercent: number;
  horizonSeconds: number;
  isSelected?: boolean;
}

export const GhostTrainMarker: React.FC<GhostTrainMarkerProps> = ({
  predictedTrain,
  liveCorridorPercent,
  horizonSeconds,
  isSelected = false,
}) => {
  const ghostCoords = getSectionPositionCoordinates(
    predictedTrain.currentSection,
    predictedTrain.positionPercent
  );

  const minPercent = Math.min(liveCorridorPercent, ghostCoords.corridorPercent);
  const maxPercent = Math.max(liveCorridorPercent, ghostCoords.corridorPercent);
  const deltaPercent = maxPercent - minPercent;

  return (
    <>
      {/* 1. Trajectory Projection Vector Line (Restrained Muted Grey Dashed Line) */}
      {deltaPercent > 0.5 && (
        <div
          className="absolute pointer-events-none z-10"
          style={{
            left: `${minPercent}%`,
            width: `${deltaPercent}%`,
            top: "84px",
          }}
        >
          <div className="h-[1px] w-full border-b border-dashed border-slate-400" />
          <div className="absolute right-0 top-[-2px] h-1.5 w-1.5 rounded-full bg-slate-300" />
        </div>
      )}

      {/* 2. Ghost Train Marker (Muted Grey / Analytical Style) */}
      <div
        className="absolute top-[68px] -translate-x-1/2 cursor-pointer transition-all duration-300 z-20 group"
        style={{ left: `${ghostCoords.corridorPercent}%` }}
      >
        {/* Ghost Badge Pill */}
        <div
          className={`flex items-center gap-1.5 rounded-sm border border-dashed px-1.5 py-0.5 font-mono text-[9px] shadow-sm backdrop-blur-sm transition-all ${
            isSelected
              ? "border-white bg-slate-800 text-white font-bold"
              : "border-slate-500 bg-slate-900/90 text-slate-300 hover:border-slate-300 hover:text-white"
          }`}
        >
          <span className="text-[10px]">👻</span>
          <span className="font-bold tracking-tight">{predictedTrain.trainId}</span>
          <span className="rounded-xs bg-slate-800 border border-slate-700 px-1 py-0.2 text-[8px] font-semibold text-slate-300">
            +{horizonSeconds}s
          </span>
          <span className="text-[8px] text-slate-400">{predictedTrain.speedKmH} km/h</span>
          {predictedTrain.delayMinutes > 0 && (
            <span className="rounded-xs bg-amber-950 border border-amber-800 px-1 py-0.2 text-[8px] font-bold text-amber-300">
              +{predictedTrain.delayMinutes}m
            </span>
          )}
        </div>

        {/* Hover Inspector Tooltip */}
        <div className="invisible absolute bottom-full left-1/2 mb-2 -translate-x-1/2 whitespace-nowrap rounded-sm border border-slate-700 bg-slate-900 p-2 font-mono text-[10px] text-slate-200 opacity-0 shadow-xl transition-all duration-150 group-hover:visible group-hover:opacity-100 z-50 pointer-events-none">
          <div className="flex items-center gap-1.5 text-slate-200 font-bold border-b border-slate-800 pb-1 mb-1">
            <span>🔮</span>
            <span>LOOKAHEAD PROJECTION (+{horizonSeconds}s)</span>
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-slate-300">
            <span>Train ID:</span>
            <strong className="text-white">{predictedTrain.trainId}</strong>
            <span>Predicted Section:</span>
            <strong className="text-slate-200">{predictedTrain.currentSection}</strong>
            <span>Section Position:</span>
            <strong className="text-white">{predictedTrain.positionPercent.toFixed(1)}%</strong>
            <span>Corridor Milestone:</span>
            <strong className="text-white">{ghostCoords.cumulativeKm} km ({ghostCoords.corridorPercent}%)</strong>
            <span>Projected Speed:</span>
            <strong className="text-emerald-400">{predictedTrain.speedKmH} km/h</strong>
            <span>Projected Delay:</span>
            <strong className={predictedTrain.delayMinutes > 0 ? "text-amber-400" : "text-emerald-400"}>
              {predictedTrain.delayMinutes} min
            </strong>
          </div>
        </div>
      </div>
    </>
  );
};
