"use client";

import React, { useState, useEffect } from "react";
import { Train } from "@/types/railway";
import { simulationEngine } from "@/engine/simulationEngine";
import { getTrainCorridorCoordinates } from "@/data/topology";

interface TrainDetailPanelProps {
  train: Train | null;
  onClose: () => void;
}

export const TrainDetailPanel: React.FC<TrainDetailPanelProps> = ({
  train,
  onClose,
}) => {
  const [customSpeed, setCustomSpeed] = useState<number>(train?.speed || 80);

  useEffect(() => {
    if (train) {
      setCustomSpeed(train.speed || 80);
    }
  }, [train?.id]);

  if (!train) return null;

  const coords = getTrainCorridorCoordinates(train);

  const handleApplySpeed = () => {
    simulationEngine.overrideTrainSpeed(train.id, customSpeed);
  };

  const handleHold = () => {
    simulationEngine.holdTrain(train.id);
  };

  const handleRelease = () => {
    simulationEngine.releaseTrain(train.id, customSpeed || 80);
  };

  return (
    <div className="rounded-lg border border-slate-300 bg-white p-4 shadow-xs">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
        <div className="flex items-center gap-2">
          <span className="text-lg">🚆</span>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-mono text-sm font-black text-slate-900">
                {train.id}
              </h3>
              <span className="rounded-sm bg-slate-100 border border-slate-300 px-1.5 py-0.2 font-mono text-[9px] font-bold text-slate-800">
                Priority {train.priority}/10
              </span>
            </div>
            <p className="text-xs text-slate-600">{train.name}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="rounded-sm border border-slate-300 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-100 hover:text-slate-900"
        >
          ✕ Close
        </button>
      </div>

      {/* Grid of Telemetry */}
      <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2.5 font-mono text-xs">
        <div className="rounded-sm border border-slate-200 bg-slate-50 p-2.5">
          <span className="block text-[9px] font-semibold text-slate-500 uppercase">Status</span>
          <strong
            className={`text-xs font-bold ${
              train.status === "ON_TIME"
                ? "text-emerald-700"
                : train.status === "DELAYED"
                ? "text-amber-700"
                : train.status === "CRITICAL"
                ? "text-red-700"
                : "text-slate-800"
            }`}
          >
            {train.status}
          </strong>
        </div>

        <div className="rounded-sm border border-slate-200 bg-slate-50 p-2.5">
          <span className="block text-[9px] font-semibold text-slate-500 uppercase">Speed</span>
          <strong className="text-xs font-bold text-slate-900">
            {train.speed} km/h
          </strong>
        </div>

        <div className="rounded-sm border border-slate-200 bg-slate-50 p-2.5">
          <span className="block text-[9px] font-semibold text-slate-500 uppercase">Position</span>
          <strong className="text-xs font-bold text-slate-900">
            {Math.round(train.position)}% ({coords.cumulativeKm} km)
          </strong>
        </div>

        <div className="rounded-sm border border-slate-200 bg-slate-50 p-2.5">
          <span className="block text-[9px] font-semibold text-slate-500 uppercase">Delay</span>
          <strong
            className={`text-xs font-bold ${
              train.delayMinutes > 0 ? "text-amber-700" : "text-emerald-700"
            }`}
          >
            {train.delayMinutes > 0 ? `+${train.delayMinutes} min` : "On Time"}
          </strong>
        </div>
      </div>

      {/* Route & Schedule Information */}
      <div className="mt-2.5 flex items-center justify-between rounded-sm border border-slate-200 bg-slate-50 p-2.5 font-mono text-xs text-slate-700">
        <div>
          <span className="text-slate-500">Route: </span>
          <strong className="text-slate-900">{train.origin}</strong> → <strong className="text-slate-900">{train.destination}</strong>
        </div>
        <div>
          <span className="text-slate-500">Section: </span>
          <strong className="text-slate-900">{train.currentSection}</strong>
        </div>
        <div>
          <span className="text-slate-500">ETA: </span>
          <strong className="text-slate-900">{train.expectedArrival}</strong> (Sched: {train.scheduledArrival})
        </div>
      </div>

      {/* Operator Manual Override Controls */}
      <div className="mt-3 rounded-sm border border-slate-300 bg-slate-50 p-3">
        <div className="flex items-center justify-between font-mono text-xs">
          <span className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
            Operator Dispatch Override
          </span>
          <span className="text-[10px] text-slate-500">
            Manual Kinematic Command
          </span>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2.5">
          {train.status === "HELD" || train.status === "STOPPED" ? (
            <button
              type="button"
              onClick={handleRelease}
              className="rounded-sm bg-emerald-700 hover:bg-emerald-800 px-3.5 py-1.5 font-mono text-xs font-bold text-white shadow-xs"
            >
              RELEASE TRAIN
            </button>
          ) : (
            <button
              type="button"
              onClick={handleHold}
              className="rounded-sm bg-red-700 hover:bg-red-800 px-3.5 py-1.5 font-mono text-xs font-bold text-white shadow-xs"
            >
              HOLD TRAIN (0 km/h)
            </button>
          )}

          <div className="flex items-center gap-2 border-l border-slate-300 pl-3">
            <span className="font-mono text-xs text-slate-600 font-medium">Target Speed:</span>
            <input
              type="range"
              min="0"
              max="140"
              step="5"
              value={customSpeed}
              onChange={(e) => setCustomSpeed(Number(e.target.value))}
              className="w-28 accent-slate-800"
            />
            <span className="font-mono text-xs font-bold text-slate-900 w-16">
              {customSpeed} km/h
            </span>
            <button
              type="button"
              onClick={handleApplySpeed}
              className="rounded-sm border border-slate-300 bg-white hover:bg-slate-100 px-3 py-1 font-mono text-xs font-bold text-slate-800"
            >
              Set Speed
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
