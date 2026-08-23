"use client";

import React from "react";
import { Train, TrainConflict } from "@/types/railway";
import { corridorTopology, getTrainCorridorCoordinates } from "@/data/topology";
import { simulationEngine } from "@/engine/simulationEngine";
import { getTrainVisualState } from "@/hooks/useNetworkState";

interface CompactFleetRosterProps {
  trains: Train[];
  selectedTrainId: string | null;
  conflicts?: TrainConflict[];
  bottlenecks?: import("@/types/advisor").Bottleneck[];
  onSelectTrain: (train: Train) => void;
}

export const CompactFleetRoster: React.FC<CompactFleetRosterProps> = ({
  trains,
  selectedTrainId,
  conflicts = [],
  bottlenecks = [],
  onSelectTrain,
}) => {

  const handleQuickHoldToggle = (e: React.MouseEvent, train: Train) => {
    e.stopPropagation();
    if (train.status === "HELD" || train.status === "STOPPED" || train.status === "HOLDING") {
      simulationEngine.releaseTrain(train.id, 80);
    } else {
      simulationEngine.holdTrain(train.id);
    }
  };

  return (
    <div className="flex flex-col h-full rounded-sm border border-slate-800/90 bg-slate-900/95 p-2 shadow-sm font-mono text-xs overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-1.5 flex-shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-sky-400" />
          <h3 className="font-mono text-xs font-black uppercase tracking-wider text-slate-100">
            ACTIVE FLEET ({trains.length})
          </h3>
        </div>
        <span className="text-[9px] text-slate-400">Click train to focus on map</span>
      </div>

      {/* High-Density Multi-Train Operations Table */}
      <div className="flex-1 overflow-y-auto mt-1 min-h-0">
        <table className="w-full text-left font-mono text-[10px] border-collapse">
          <thead className="sticky top-0 bg-slate-950/95 z-10">
            <tr className="border-b border-slate-800 text-[8px] uppercase tracking-wider text-slate-400">
              <th className="py-1 px-1">TRAIN</th>
              <th className="py-1 px-1">TYPE</th>
              <th className="py-1 px-1">SPEED</th>
              <th className="py-1 px-1">SECTION</th>
              <th className="py-1 px-1">POSITION</th>
              <th className="py-1 px-1">DELAY</th>
              <th className="py-1 px-1">STATUS</th>
              <th className="py-1 px-1 text-right">ACTION</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-855/60 text-slate-200">
            {trains.map((train) => {
              const isSelected = selectedTrainId === train.id;
              const coords = getTrainCorridorCoordinates(train);
              const isBottleneckCause = bottlenecks.some((b) => b.trainsQueued?.includes(train.id));
              const inConflict = conflicts.some((c) => c.trainA === train.id || c.trainB === train.id);
              const visual = getTrainVisualState(train, {
                isSelected,
                inConflict,
                inBottleneck: isBottleneckCause,
              });

              return (
                <tr
                  key={train.id}
                  onClick={() => onSelectTrain(train)}
                  className={`cursor-pointer transition-colors duration-100 ${
                    isSelected
                      ? "bg-sky-950/80 text-sky-200 font-bold border-l-2 border-sky-400"
                      : isBottleneckCause
                      ? "bg-amber-950/30 text-slate-100 border-l-2 border-amber-500/80 hover:bg-amber-950/50"
                      : "hover:bg-slate-850/80"
                  }`}
                >
                  {/* TRAIN */}
                  <td className="py-1 px-1 font-bold text-slate-100 whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      <span>🚆</span>
                      <span className="text-white font-bold font-data">{train.id}</span>
                      <span className="rounded-2xs bg-slate-800 border border-slate-700 px-1 py-0 text-[7px] text-slate-300 font-data">
                        P{train.priority}
                      </span>
                      {isBottleneckCause && (
                        <span className="rounded-2xs bg-amber-900/90 border border-amber-500/60 px-1 py-0 text-[7px] text-amber-200 font-extrabold" title="Train actively contributing to section saturation bottleneck">
                          BN
                        </span>
                      )}
                    </div>
                  </td>

                  {/* TYPE */}
                  <td className="py-1 px-1 text-[9px] text-slate-300">
                    {train.type}
                  </td>

                  {/* SPEED */}
                  <td className="py-1 px-1 font-bold text-slate-100 font-data whitespace-nowrap">
                    {Math.round(train.speed)} <span className="text-[7px] font-normal text-slate-400">km/h</span>
                  </td>

                  {/* SECTION */}
                  <td className="py-1 px-1 text-[9px] text-slate-300 font-data">
                    <span className="truncate block max-w-[80px]" title={train.currentSection}>
                      {train.currentSection}
                    </span>
                  </td>

                  {/* POSITION */}
                  <td className="py-1 px-1 text-[9px] text-slate-300 font-data whitespace-nowrap">
                    {Math.round(train.position)}% ({coords.cumulativeKm}km)
                  </td>

                  {/* DELAY */}
                  <td className="py-1 px-1 whitespace-nowrap font-data">
                    <span className={train.delayMinutes > 0 ? "text-amber-400 font-bold" : "text-emerald-400"}>
                      +{train.delayMinutes}m
                    </span>
                  </td>

                  {/* STATUS */}
                  <td className="py-1 px-1 whitespace-nowrap">
                    <span
                      className={`rounded-2xs border px-1 py-0.2 text-[7px] font-bold uppercase ${visual.badgeText}`}
                      style={{
                        backgroundColor: visual.badgeBg,
                        borderColor: visual.badgeBorder,
                      }}
                    >
                      {visual.statusText}
                    </span>
                  </td>

                  {/* ACTION */}
                  <td className="py-1 px-1 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={(e) => handleQuickHoldToggle(e, train)}
                      className={`px-1.5 py-0.5 rounded-2xs text-[8px] font-black transition tracking-wider ${
                        train.status === "HELD" || train.status === "STOPPED" || train.status === "HOLDING"
                          ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs"
                          : inConflict
                          ? "bg-red-600 hover:bg-red-500 text-white font-black animate-pulse shadow-md"
                          : isBottleneckCause || train.delayMinutes > 0
                          ? "bg-amber-600 hover:bg-amber-500 text-slate-950 shadow-xs"
                          : "bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-400"
                      }`}
                    >
                      {train.status === "HELD" || train.status === "STOPPED" || train.status === "HOLDING" ? "▶" : "⏸"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
