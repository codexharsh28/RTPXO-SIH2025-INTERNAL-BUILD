"use client";

import React, { useState } from "react";
import { Train } from "@/types/railway";
import { corridorTopology } from "@/data/topology";
import { simulationEngine } from "@/engine/simulationEngine";

import { getTrainVisualState, useNetworkState } from "@/hooks/useNetworkState";

interface TrainTableProps {
  trains: Train[];
  selectedTrain: Train | null;
  conflicts?: import("@/types/railway").TrainConflict[];
  bottlenecks?: import("@/types/advisor").Bottleneck[];
  onSelectTrain: (train: Train) => void;
}

export const TrainTable: React.FC<TrainTableProps> = ({
  trains,
  selectedTrain,
  conflicts = [],
  bottlenecks = [],
  onSelectTrain,
}) => {
  const net = useNetworkState();
  const [filterQuery, setFilterQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const isTrainInConflict = (trainId: string) =>
    conflicts.some(
      (c) =>
        (c.trainA === trainId || c.trainB === trainId) &&
        (c.severity === "CRITICAL" || c.severity === "HIGH")
    );
  const isTrainInBottleneck = (trainId: string) =>
    bottlenecks.some((b) => b.trainsQueued?.includes(trainId));

  const filteredTrains = trains.filter((t) => {
    const matchesQuery =
      t.id.toLowerCase().includes(filterQuery.toLowerCase()) ||
      t.name.toLowerCase().includes(filterQuery.toLowerCase()) ||
      t.currentSection.toLowerCase().includes(filterQuery.toLowerCase());
    const matchesStatus = statusFilter === "ALL" || 
      (statusFilter === "CONFLICT" ? isTrainInConflict(t.id) : t.status === statusFilter);
    return matchesQuery && matchesStatus;
  });

  const handleHoldToggle = (e: React.MouseEvent, train: Train, inConflict?: boolean) => {
    e.stopPropagation();
    const isHeld = train.status === "HELD" || train.status === "STOPPED" || train.status === "HOLDING";

    if (inConflict || isHeld) {
      net.requestConfirmation({
        title: isHeld ? `Release Train ${train.id}` : `Emergency Safety Hold: Train ${train.id}`,
        description: isHeld
          ? `Resume nominal trajectory for ${train.name} (${train.id}) in section ${train.currentSection}.`
          : `Command absolute STOP aspect for ${train.name} (${train.id}) at current signal to resolve safety conflict.`,
        impactSummary: isHeld ? "Target Speed: 80 km/h" : "Safety Hold at Signal Boundary",
        actor: "DISPATCHER_01 (HUMAN OPERATOR)",
        affectedTrainId: train.id,
        onConfirm: () => {
          if (isHeld) {
            simulationEngine.releaseTrain(train.id, 80);
          } else {
            simulationEngine.holdTrain(train.id);
          }
        },
      });
    } else {
      simulationEngine.holdTrain(train.id);
      net.showToast(`⏸ Train ${train.id} held by dispatcher`);
    }
  };

  return (
    <div className="flex flex-col h-full rounded-sm border border-slate-800 bg-slate-950 p-2 text-xs font-mono select-none overflow-hidden">
      {/* Search & Filter Bar */}
      <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-800 flex-shrink-0">
        <div className="flex items-center gap-1.5 flex-1">
          <input
            type="text"
            placeholder="Search train ID, name, section..."
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            className="w-full max-w-[220px] rounded-xs bg-slate-900 border border-slate-800 px-2 py-1 text-[11px] text-slate-100 placeholder-slate-500 focus:border-cyan-500 focus:outline-hidden font-data"
          />
        </div>

        <div className="flex items-center gap-1 text-[10px]">
          <span className="text-slate-500 uppercase">FILTER:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xs bg-slate-900 border border-slate-800 px-2 py-1 text-[10px] text-slate-200 focus:border-cyan-500 focus:outline-hidden"
          >
            <option value="ALL">ALL FLEET ({trains.length})</option>
            <option value="ON_TIME">ON TIME</option>
            <option value="DELAYED">DELAYED</option>
            <option value="CONFLICT">CONFLICT</option>
            <option value="HELD">HELD</option>
          </select>
        </div>
      </div>

      {/* Train Fleet Table */}
      <div className="flex-1 min-h-0 overflow-y-auto mt-1">
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 bg-slate-900/90 backdrop-blur border-b border-slate-800 text-[10px] uppercase text-slate-400 font-bold">
            <tr>
              <th className="py-2 px-2.5">Train</th>
              <th className="py-2 px-2">Type</th>
              <th className="py-2 px-2">Pri</th>
              <th className="py-2 px-2">Speed</th>
              <th className="py-2 px-2">Location</th>
              <th className="py-2 px-2">Progress</th>
              <th className="py-2 px-2">Delay</th>
              <th className="py-2 px-2">Status</th>
              <th className="py-2 px-2.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/70 text-slate-200 text-[11px]">
            {filteredTrains.map((train) => {
              const isSelected = selectedTrain?.id === train.id;
              const inConflict = isTrainInConflict(train.id);
              const inBottleneck = isTrainInBottleneck(train.id);
              const sectionRange = corridorTopology.sectionMap[train.currentSection];
              const sectionName = sectionRange ? sectionRange.name : train.currentSection;
              const visual = getTrainVisualState(train, { isSelected, inConflict, inBottleneck });
              const isHeld = train.status === "HELD" || train.status === "STOPPED" || train.status === "HOLDING";

              return (
                <tr
                  key={train.id}
                  onClick={() => onSelectTrain(train)}
                  className={`cursor-pointer transition-colors duration-150 ${
                    isSelected
                      ? "bg-cyan-950/50 text-cyan-200 font-bold border-l-2 border-cyan-400"
                      : inConflict
                      ? "bg-red-950/40 text-red-200 border-l-2 border-red-500 hover:bg-red-950/60"
                      : inBottleneck
                      ? "bg-amber-950/30 text-amber-100 border-l-2 border-amber-500/80 hover:bg-amber-950/50"
                      : "hover:bg-slate-800/60"
                  }`}
                >
                  <td className="py-2 px-2.5 font-bold text-slate-100">
                    <div className="flex items-center gap-1.5">
                      <span>🚆</span>
                      <span className="text-cyan-400 font-data">{train.id}</span>
                      {inConflict && (
                        <span className="rounded-2xs bg-red-900/90 border border-red-500 px-1 py-0 text-[8px] text-red-200 font-extrabold animate-pulse">
                          🚨 CONFLICT
                        </span>
                      )}
                      {inBottleneck && !inConflict && (
                        <span className="rounded-2xs bg-amber-900/90 border border-amber-500/70 px-1 py-0 text-[8px] text-amber-200 font-extrabold" title="Causal factor in section bottleneck">
                          ⚠️ BOTTLENECK
                        </span>
                      )}
                    </div>
                    <span className="block font-sans text-[10px] font-normal text-slate-400">
                      {train.name}
                    </span>
                  </td>

                  <td className="py-2 px-2 text-[10px] text-slate-300">
                    {train.type}
                  </td>

                  <td className="py-2 px-2">
                    <span className="rounded-2xs bg-slate-800 border border-slate-700 px-1.5 py-0.2 text-[10px] font-bold text-slate-200 font-data">
                      P{train.priority}
                    </span>
                  </td>

                  <td className="py-2 px-2 font-bold text-slate-100 font-data">
                    {Math.round(train.speed)} <span className="text-[9px] font-normal text-slate-400">km/h</span>
                  </td>

                  <td className="py-2 px-2 text-[10px] text-slate-300 font-data">
                    {sectionName}
                    <span className="block text-[8px] text-sky-400 font-data">[{train.currentBlock || train.currentSection}]</span>
                  </td>

                  <td className="py-2 px-2 text-[10px] text-slate-300 font-data">
                    <div className="flex items-center gap-1.5">
                      <div className="w-12 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-cyan-400 h-full rounded-full"
                          style={{ width: `${Math.min(100, Math.round(train.position))}%` }}
                        />
                      </div>
                      <span className="text-[9px] font-data">{Math.round(train.position)}%</span>
                    </div>
                  </td>

                  <td className="py-2 px-2 font-data">
                    <span
                      className={`text-[10px] font-bold font-data ${
                        train.delayMinutes > 0 ? "text-amber-400" : "text-emerald-400"
                      }`}
                    >
                      {train.delayMinutes > 0 ? `+${train.delayMinutes}m` : "0m"}
                    </span>
                  </td>

                  <td className="py-2 px-2">
                    <span
                      className={`rounded-2xs border px-1.5 py-0.2 text-[9px] font-bold ${visual.badgeText}`}
                      style={{
                        backgroundColor: visual.badgeBg,
                        borderColor: visual.badgeBorder,
                      }}
                    >
                      {visual.statusText}
                    </span>
                  </td>

                  <td className="py-2 px-2.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {/* Contextual Action Button */}
                      <button
                        type="button"
                        onClick={(e) => handleHoldToggle(e, train, inConflict)}
                        className={`rounded-2xs px-2.5 py-1 font-mono text-[9px] tracking-wider transition ${
                          isHeld
                            ? "bg-emerald-600 hover:bg-emerald-500 text-white font-black shadow-xs"
                            : inConflict
                            ? "bg-red-600 hover:bg-red-500 text-white font-black animate-pulse shadow-md"
                            : inBottleneck || train.delayMinutes > 0
                            ? "bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold shadow-xs"
                            : "bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-400 hover:text-slate-200"
                        }`}
                        title={
                          isHeld
                            ? "Release train back to standard speed trajectory"
                            : inConflict
                            ? "Emergency Hold to avert safety conflict"
                            : "Hold train at section signal"
                        }
                      >
                        {isHeld
                          ? "▶ RELEASE"
                          : inConflict
                          ? "⏸ HOLD (SAFETY)"
                          : inBottleneck || train.delayMinutes > 0
                          ? "⏸ HOLD (PACE)"
                          : "⏸ HOLD"}
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectTrain(train);
                        }}
                        className="rounded-2xs border border-slate-700 bg-slate-800 px-2 py-1 text-[9px] font-bold text-slate-200 hover:bg-slate-700"
                      >
                        INSPECT
                      </button>
                    </div>
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
