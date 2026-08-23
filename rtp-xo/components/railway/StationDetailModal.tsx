"use client";

import React from "react";
import { StationTopologyNode, PlatformDefinition } from "@/types/topology";
import { Train } from "@/types/railway";

interface StationDetailModalProps {
  station: StationTopologyNode | null;
  trainsAtStation: Train[];
  onClose: () => void;
  onSelectTrain?: (train: Train) => void;
}

export const StationDetailModal: React.FC<StationDetailModalProps> = ({
  station,
  trainsAtStation,
  onClose,
  onSelectTrain,
}) => {
  if (!station) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-fade-in">
      <div className="w-full max-w-lg rounded-sm border border-slate-700 bg-slate-900 shadow-2xl font-mono text-xs overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950 px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-sky-400" />
            <span className="font-bold text-slate-100 uppercase tracking-wider text-sm">
              {station.name} ({station.code})
            </span>
            {station.isJunction && (
              <span className="px-1.5 py-0.5 rounded-2xs bg-amber-950 border border-amber-500/60 text-amber-300 text-[9px] font-bold">
                JUNCTION INTERCHANGE
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white px-1.5 py-0.5 rounded-2xs bg-slate-800 hover:bg-slate-700 font-bold"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="p-3 space-y-3">
          {/* Metadata Grid */}
          <div className="grid grid-cols-2 gap-2 text-[10px]">
            <div className="p-2 rounded-2xs bg-slate-950 border border-slate-800">
              <span className="text-slate-500">STATION ID:</span>
              <p className="text-slate-100 font-bold text-xs">{station.id}</p>
            </div>
            <div className="p-2 rounded-2xs bg-slate-950 border border-slate-800">
              <span className="text-slate-500">TOTAL PLATFORMS:</span>
              <p className="text-emerald-400 font-bold text-xs">{station.platforms} Tracks</p>
            </div>
            <div className="p-2 rounded-2xs bg-slate-950 border border-slate-800">
              <span className="text-slate-500">CONNECTED LINES:</span>
              <p className="text-sky-300 font-bold">{station.connectedLineIds.join(", ")}</p>
            </div>
            <div className="p-2 rounded-2xs bg-slate-950 border border-slate-800">
              <span className="text-slate-500">SECTION OUTLETS:</span>
              <p className="text-slate-300">{station.connectedSectionIds.join(", ")}</p>
            </div>
          </div>

          {/* Platforms Track Occupation */}
          <div>
            <span className="text-slate-400 uppercase font-bold text-[9px]">PLATFORM TRACK ALLOCATION:</span>
            <div className="mt-1.5 grid grid-cols-3 gap-1.5">
              {Array.from({ length: station.platforms }, (_, i) => {
                const pltNum = i + 1;
                const trainOnPlt = trainsAtStation[i] || null;

                return (
                  <div
                    key={pltNum}
                    onClick={() => trainOnPlt && onSelectTrain?.(trainOnPlt)}
                    className={`p-1.5 rounded-2xs border text-[9px] transition ${
                      trainOnPlt
                        ? "bg-amber-950/60 border-amber-500 text-amber-200 cursor-pointer hover:border-amber-300"
                        : "bg-slate-950 border-slate-800 text-slate-400"
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold">
                      <span>PLT {pltNum}</span>
                      <span className={`h-1.5 w-1.5 rounded-full ${trainOnPlt ? "bg-amber-400 animate-pulse" : "bg-emerald-400"}`} />
                    </div>
                    <div className="mt-0.5 text-[8px] truncate">
                      {trainOnPlt ? `🚆 ${trainOnPlt.id} (${Math.round(trainOnPlt.speed)}k)` : "VACANT"}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Active Trains at Station / Section Approach */}
          <div>
            <span className="text-slate-400 uppercase font-bold text-[9px]">APPROACHING & DWELLING TRAINS ({trainsAtStation.length}):</span>
            {trainsAtStation.length === 0 ? (
              <div className="mt-1 p-2 rounded-2xs bg-slate-950 border border-slate-800 text-slate-500 text-center text-[10px]">
                No active train dwell or immediate station queue.
              </div>
            ) : (
              <div className="mt-1 space-y-1">
                {trainsAtStation.map((train) => (
                  <div
                    key={train.id}
                    onClick={() => onSelectTrain?.(train)}
                    className="p-1.5 rounded-2xs bg-slate-950 border border-slate-800 hover:border-sky-500 cursor-pointer flex items-center justify-between transition"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="text-sky-300 font-bold">🚆 {train.id}</span>
                      <span className="text-slate-400 font-normal">({train.name})</span>
                    </div>
                    <div className="flex items-center gap-2 text-[9px]">
                      <span className="text-slate-300">{Math.round(train.speed)} km/h</span>
                      <span className="text-amber-400 font-bold">{train.delayMinutes > 0 ? `+${train.delayMinutes}m` : "ON-TIME"}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-800 bg-slate-950 px-3 py-1.5 text-right">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 rounded-2xs bg-sky-600 hover:bg-sky-500 text-white font-bold text-[10px]"
          >
            CLOSE
          </button>
        </div>
      </div>
    </div>
  );
};
