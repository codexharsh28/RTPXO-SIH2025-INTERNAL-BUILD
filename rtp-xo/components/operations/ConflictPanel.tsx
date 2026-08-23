"use client";

import React, { useState } from "react";
import { TrainConflict } from "@/types/railway";
import { PredictedConflict } from "@/types/advisor";

interface ConflictPanelProps {
  conflicts: TrainConflict[];
  predictedConflicts: PredictedConflict[];
  onSelectTrain?: (trainId: string) => void;
}

export const ConflictPanel: React.FC<ConflictPanelProps> = ({
  conflicts,
  predictedConflicts,
  onSelectTrain,
}) => {
  const [tab, setTab] = useState<"ACTIVE" | "PREDICTED">("ACTIVE");

  const getSeverityStyle = (severity: string) => {
    switch (severity) {
      case "CRITICAL":
      case "HIGH":
        return "bg-red-100 text-red-800 border-red-300 font-bold";
      case "MEDIUM":
        return "bg-amber-100 text-amber-800 border-amber-300 font-semibold";
      default:
        return "bg-slate-100 text-slate-700 border-slate-300";
    }
  };

  return (
    <div className="flex flex-col h-full rounded-lg border border-slate-300 bg-white p-4 shadow-xs">
      {/* Header & Tabs */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
        <div>
          <h3 className="font-mono text-xs font-black uppercase tracking-wider text-slate-900">
            CONFLICT & SAFETY MONITOR
          </h3>
          <p className="text-[11px] text-slate-500">
            Real-Time Headway & Trajectory Verification
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 rounded-sm border border-slate-300 bg-slate-100 p-0.5 font-mono text-[10px]">
          <button
            type="button"
            onClick={() => setTab("ACTIVE")}
            className={`rounded-sm px-2 py-1 font-bold transition ${
              tab === "ACTIVE"
                ? "bg-slate-900 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            ACTIVE ({conflicts.length})
          </button>
          <button
            type="button"
            onClick={() => setTab("PREDICTED")}
            className={`rounded-sm px-2 py-1 font-bold transition ${
              tab === "PREDICTED"
                ? "bg-slate-900 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            LOOKAHEAD ({predictedConflicts.length})
          </button>
        </div>
      </div>

      {/* Content Feed */}
      <div className="flex-1 overflow-y-auto mt-3 space-y-2 pr-1">
        {tab === "ACTIVE" ? (
          conflicts.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-sm border border-dashed border-slate-300 py-10 text-center text-slate-500">
              <span className="text-emerald-700 text-xl mb-1">✓</span>
              <span className="font-mono text-xs font-bold text-slate-800">
                NO ACTIVE CONFLICTS
              </span>
              <span className="text-[10px] text-slate-500 mt-0.5 font-mono">
                All trains maintaining required block headway (≥ 2.0 km).
              </span>
            </div>
          ) : (
            conflicts.map((conflict, idx) => (
              <div
                key={idx}
                className="rounded-sm border border-red-300 bg-red-50/70 p-3 shadow-xs font-mono"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`rounded-sm border px-1.5 py-0.2 text-[9px] uppercase ${getSeverityStyle(
                        conflict.severity
                      )}`}
                    >
                      {conflict.severity} CONFLICT
                    </span>
                    <span className="text-xs font-bold text-slate-900">
                      <button
                        type="button"
                        onClick={() => onSelectTrain?.(conflict.trainA)}
                        className="text-slate-900 hover:underline"
                      >
                        {conflict.trainA}
                      </button>{" "}
                      ↔{" "}
                      <button
                        type="button"
                        onClick={() => onSelectTrain?.(conflict.trainB)}
                        className="text-slate-900 hover:underline"
                      >
                        {conflict.trainB}
                      </button>
                    </span>
                  </div>

                  {conflict.junctionId !== "NONE" && (
                    <span className="text-[10px] text-slate-600 font-semibold">
                      Jct: {conflict.junctionId}
                    </span>
                  )}
                </div>

                <p className="mt-1.5 text-xs text-red-950 leading-relaxed font-sans font-medium">
                  {conflict.reason}
                </p>

                <div className="mt-2 flex items-center gap-3 text-[10px] text-slate-600 border-t border-red-200 pt-1">
                  <span>Section: <strong className="text-slate-900">{conflict.sectionA}</strong></span>
                </div>
              </div>
            ))
          )
        ) : (
          predictedConflicts.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-sm border border-dashed border-slate-300 py-10 text-center text-slate-500">
              <span className="text-slate-600 text-xl mb-1">⏱</span>
              <span className="font-mono text-xs font-bold text-slate-800">
                NO PREDICTED CONFLICTS
              </span>
              <span className="text-[10px] text-slate-500 mt-0.5 font-mono">
                Forward trajectory lookahead forecast is clear.
              </span>
            </div>
          ) : (
            predictedConflicts.map((pred) => (
              <div
                key={pred.id}
                className="rounded-sm border border-amber-300 bg-amber-50/70 p-3 shadow-xs font-mono"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`rounded-sm border px-1.5 py-0.2 text-[9px] uppercase ${getSeverityStyle(
                        pred.severity
                      )}`}
                    >
                      {pred.severity} PREDICTION
                    </span>
                    <span className="text-xs font-bold text-slate-900">
                      {pred.trainA} ↔ {pred.trainB}
                    </span>
                  </div>

                  <span className="rounded-sm bg-amber-100 border border-amber-300 px-1.5 py-0.2 text-[10px] font-bold text-amber-900">
                    in ~{pred.predictedTimeToConflictSeconds}s
                  </span>
                </div>

                <p className="mt-1.5 text-xs text-amber-950 leading-relaxed font-sans font-medium">
                  {pred.reason}
                </p>

                <div className="mt-2 flex items-center justify-between text-[10px] text-slate-600 border-t border-amber-200 pt-1">
                  <span>Location: <strong className="text-slate-900">{pred.locationKm} km</strong></span>
                  <span>Section: <strong className="text-slate-900">{pred.sectionId}</strong></span>
                </div>
              </div>
            ))
          )
        )}
      </div>
    </div>
  );
};
