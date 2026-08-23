"use client";

import React from "react";
import { SimulationSnapshot } from "@/types/simulation";
import { Train } from "@/types/railway";
import { simulationEngine } from "@/engine/simulationEngine";

interface ControlPanelProps {
  snapshot: SimulationSnapshot;
  selectedTrain: Train | null;
}

const SPEED_MULTIPLIERS = [1, 2, 4, 8, 10];

export const ControlPanel: React.FC<ControlPanelProps> = ({
  snapshot,
  selectedTrain,
}) => {
  const { running, speedMultiplier } = snapshot;

  return (
    <div className="rounded-lg border border-slate-300 bg-white p-3.5 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Main Master Controls */}
        <div className="flex items-center gap-2">
          {/* Start / Pause Button */}
          <button
            type="button"
            onClick={() => simulationEngine.toggle()}
            className={`flex items-center gap-1.5 rounded-sm px-4 py-2 font-mono text-xs font-bold transition-colors duration-150 ${
              running
                ? "bg-amber-600 hover:bg-amber-700 text-white"
                : "bg-emerald-700 hover:bg-emerald-800 text-white"
            }`}
          >
            <span>{running ? "⏸ PAUSE" : "▶ START SIMULATION"}</span>
          </button>

          {/* Reset Button */}
          <button
            type="button"
            onClick={() => simulationEngine.resetScenario()}
            className="flex items-center gap-1 rounded-sm border border-slate-300 bg-slate-100 hover:bg-slate-200 px-3 py-2 font-mono text-xs font-semibold text-slate-700 transition"
          >
            <span>↺ RESET</span>
          </button>
        </div>

        {/* Speed Multiplier Selectors */}
        <div className="flex items-center gap-1">
          <span className="mr-1 font-mono text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
            Speed:
          </span>
          {SPEED_MULTIPLIERS.map((multiplier) => (
            <button
              key={multiplier}
              type="button"
              onClick={() => simulationEngine.setSpeedMultiplier(multiplier)}
              className={`rounded-sm px-2 py-1 font-mono text-xs font-bold transition ${
                speedMultiplier === multiplier
                  ? "bg-slate-900 text-white"
                  : "border border-slate-300 bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              {multiplier}×
            </button>
          ))}
        </div>

        {/* Train Quick Action Override if Train Selected */}
        {selectedTrain && (
          <div className="flex flex-wrap items-center gap-1.5 border-l border-slate-300 pl-3">
            <span className="font-mono text-xs font-bold text-slate-900">
              {selectedTrain.id}:
            </span>

            {selectedTrain.status === "HELD" || selectedTrain.status === "STOPPED" ? (
              <button
                type="button"
                onClick={() => simulationEngine.releaseTrain(selectedTrain.id, 80)}
                className="rounded-sm bg-emerald-100 border border-emerald-400 px-2 py-1 font-mono text-[10px] font-bold text-emerald-800 hover:bg-emerald-200"
              >
                RELEASE (80 km/h)
              </button>
            ) : (
              <button
                type="button"
                onClick={() => simulationEngine.holdTrain(selectedTrain.id)}
                className="rounded-sm bg-red-100 border border-red-400 px-2 py-1 font-mono text-[10px] font-bold text-red-800 hover:bg-red-200"
              >
                HOLD TRAIN
              </button>
            )}

            <button
              type="button"
              onClick={() =>
                simulationEngine.overrideTrainSpeed(
                  selectedTrain.id,
                  Math.max(0, selectedTrain.speed - 15)
                )
              }
              className="rounded-sm border border-slate-300 bg-slate-100 px-2 py-1 font-mono text-[10px] font-semibold text-slate-700 hover:bg-slate-200"
            >
              -15 km/h
            </button>

            <button
              type="button"
              onClick={() =>
                simulationEngine.overrideTrainSpeed(
                  selectedTrain.id,
                  Math.min(130, selectedTrain.speed + 15)
                )
              }
              className="rounded-sm border border-slate-300 bg-slate-100 px-2 py-1 font-mono text-[10px] font-semibold text-slate-700 hover:bg-slate-200"
            >
              +15 km/h
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
