"use client";

import React, { useState, useEffect } from "react";
import { Train } from "@/types/railway";
import { simulationEngine } from "@/engine/simulationEngine";
import { getTrainCorridorCoordinates } from "@/data/topology";

interface TrainDetailDrawerProps {
  train: Train | null;
  onClose: () => void;
}

export const TrainDetailDrawer: React.FC<TrainDetailDrawerProps> = ({
  train,
  onClose,
}) => {
  const [customSpeed, setCustomSpeed] = useState<number>(train?.speed || 80);

  useEffect(() => {
    if (train) {
      setCustomSpeed(Math.round(train.speed) || 80);
    }
  }, [train?.id, train?.speed]);

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
    <div className="fixed inset-y-0 right-0 z-50 w-80 bg-slate-950/95 border-l border-slate-800 shadow-2xl backdrop-blur-md flex flex-col font-mono text-xs text-white p-4 animate-slide-in-right">
      {/* Drawer Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xl">🚆</span>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm text-sky-300">{train.id}</h3>
              <span className="rounded-2xs bg-slate-800 border border-slate-700 px-1.5 py-0.2 text-[9px] font-bold text-slate-300">
                P{train.priority}/10
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-sans">{train.name}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-sm text-slate-400 hover:text-white hover:bg-slate-800 text-sm"
        >
          ✕
        </button>
      </div>

      {/* Telemetry Metrics Grid */}
      <div className="mt-3 grid grid-cols-2 gap-2 flex-shrink-0 text-[11px]">
        <div className="bg-slate-900 border border-slate-800 rounded-sm p-2">
          <span className="text-[9px] text-slate-500 uppercase block font-semibold">STATUS</span>
          <strong
            className={`font-bold ${
              train.status === "ON_TIME"
                ? "text-emerald-400"
                : train.status === "DELAYED"
                ? "text-amber-400"
                : "text-red-400"
            }`}
          >
            {train.status}
          </strong>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-sm p-2">
          <span className="text-[9px] text-slate-500 uppercase block font-semibold">SPEED</span>
          <strong className="text-slate-100 font-bold">{Math.round(train.speed)} km/h</strong>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-sm p-2">
          <span className="text-[9px] text-slate-500 uppercase block font-semibold">POSITION</span>
          <strong className="text-slate-100 font-bold">{coords.cumulativeKm} km ({Math.round(train.position)}%)</strong>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-sm p-2">
          <span className="text-[9px] text-slate-500 uppercase block font-semibold">DELAY</span>
          <strong className={train.delayMinutes > 0 ? "text-amber-400 font-bold" : "text-emerald-400"}>
            +{train.delayMinutes} min
          </strong>
        </div>
      </div>

      {/* Corridor Section & Block Info */}
      <div className="mt-3 bg-slate-900 border border-slate-800 rounded-sm p-2.5 space-y-1 text-[11px]">
        <div className="flex justify-between text-slate-400">
          <span>Current Section:</span>
          <strong className="text-slate-200">{train.currentSection}</strong>
        </div>
        <div className="flex justify-between text-slate-400">
          <span>Current Block:</span>
          <strong className="text-sky-300 font-mono">{train.currentBlock || `${train.currentSection}-BLK-01`}</strong>
        </div>
        <div className="flex justify-between text-slate-400">
          <span>Destination:</span>
          <strong className="text-slate-200">{train.destination}</strong>
        </div>
        <div className="flex justify-between text-slate-400">
          <span>Max Authorized Speed:</span>
          <strong className="text-slate-200">{train.maxSpeed || 130} km/h</strong>
        </div>
      </div>

      {/* Manual Operator Override Controls */}
      <div className="mt-4 bg-slate-900/80 border border-slate-800 rounded-sm p-3 space-y-3 flex-1 flex flex-col justify-between">
        <div>
          <h4 className="text-[10px] uppercase font-bold text-slate-400 border-b border-slate-800 pb-1 mb-2">
            MANUAL OPERATOR OVERRIDE
          </h4>

          {/* Speed Slider */}
          <div className="space-y-1">
            <div className="flex justify-between text-[10px]">
              <span className="text-slate-400">Target Speed:</span>
              <strong className="text-sky-300 font-bold">{customSpeed} km/h</strong>
            </div>
            <input
              type="range"
              min="0"
              max={train.maxSpeed}
              value={customSpeed}
              onChange={(e) => setCustomSpeed(Number(e.target.value))}
              className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
            />
          </div>

          <button
            type="button"
            onClick={handleApplySpeed}
            className="w-full mt-2 py-1.5 rounded-sm bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shadow-sm"
          >
            APPLY SPEED OVERRIDE
          </button>
        </div>

        {/* Hold / Release Action */}
        <div className="pt-2 border-t border-slate-800">
          {train.status === "HELD" || train.status === "STOPPED" || train.status === "HOLDING" ? (
            <button
              type="button"
              onClick={handleRelease}
              className="w-full py-2 rounded-sm bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs tracking-wider shadow-sm"
            >
              ▶ RELEASE TRAIN (PROCEED)
            </button>
          ) : (
            <button
              type="button"
              onClick={handleHold}
              className="w-full py-2 rounded-sm bg-amber-600 hover:bg-amber-500 text-slate-950 font-black text-xs tracking-wider shadow-sm"
            >
              ⏸ HOLD TRAIN (RED SIGNAL)
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
