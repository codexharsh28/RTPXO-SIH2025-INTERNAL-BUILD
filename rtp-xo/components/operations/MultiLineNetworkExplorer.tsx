"use client";

import React, { useState } from "react";
import { multiLineNetworkGraph } from "@/data/topology";
import { SimulationSnapshot } from "@/types/simulation";
import { RailwaySection, Train } from "@/types/railway";

interface MultiLineNetworkExplorerProps {
  snapshot: SimulationSnapshot;
  onSelectTrain?: (train: Train) => void;
  onSelectSection?: (section: RailwaySection) => void;
}

export const MultiLineNetworkExplorer: React.FC<MultiLineNetworkExplorerProps> = ({
  snapshot,
  onSelectTrain,
  onSelectSection,
}) => {
  const [activeTab, setActiveTab] = useState<"LINES" | "STATIONS" | "JUNCTIONS" | "SECTIONS">("LINES");
  const [selectedLineFilter, setSelectedLineFilter] = useState<string>("ALL");

  const lines = multiLineNetworkGraph.lines;
  const stations = Object.values(multiLineNetworkGraph.stations);
  const junctions = Object.values(multiLineNetworkGraph.junctions);
  const sections = Object.values(multiLineNetworkGraph.sections);

  const filteredSections = selectedLineFilter === "ALL" 
    ? sections 
    : sections.filter(s => s.lineId === selectedLineFilter);

  return (
    <div className="h-full flex flex-col bg-slate-900/90 border border-slate-800 rounded-sm font-mono text-xs overflow-hidden">
      {/* Tab Navigation */}
      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950 px-2 py-1 flex-shrink-0">
        <div className="flex items-center gap-1">
          {(["LINES", "STATIONS", "JUNCTIONS", "SECTIONS"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`px-2 py-0.5 rounded-2xs text-[10px] font-bold transition ${
                activeTab === tab
                  ? "bg-sky-600 text-white shadow-xs"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-850"
              }`}
            >
              {tab === "LINES" && `🛤️ LINES (${lines.length})`}
              {tab === "STATIONS" && `🏢 STATIONS (${stations.length})`}
              {tab === "JUNCTIONS" && `🔀 JUNCTIONS (${junctions.length})`}
              {tab === "SECTIONS" && `📍 SECTIONS (${sections.length})`}
            </button>
          ))}
        </div>

        {activeTab === "SECTIONS" && (
          <div className="flex items-center gap-1 text-[9px]">
            <span className="text-slate-500">FILTER:</span>
            <select
              value={selectedLineFilter}
              onChange={(e) => setSelectedLineFilter(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-slate-200 rounded-2xs px-1 py-0.5"
            >
              <option value="ALL">All Lines</option>
              {lines.map((l) => (
                <option key={l.id} value={l.id}>{l.shortName}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Tab Content */}
      <div className="flex-1 min-h-0 overflow-y-auto p-2">
        {/* 1. LINES OVERVIEW */}
        {activeTab === "LINES" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {lines.map((line) => {
              const lineSections = sections.filter((s) => s.lineId === line.id);
              const activeTrains = snapshot.trains.filter((t) => lineSections.some((s) => s.id === t.currentSection));

              return (
                <div key={line.id} className="p-2.5 rounded-sm border border-slate-800 bg-slate-950 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: line.color }} />
                        <span className="font-bold text-slate-100">{line.name}</span>
                      </div>
                      <span className="px-1.5 py-0.2 rounded-2xs bg-slate-900 border border-slate-700 text-[9px] text-sky-300">
                        {line.code}
                      </span>
                    </div>

                    <div className="space-y-1 text-[10px] text-slate-400">
                      <div className="flex justify-between">
                        <span>Total Corridor:</span>
                        <strong className="text-slate-200">{line.totalLengthKm} km</strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Stations ({line.stationIds.length}):</span>
                        <span className="text-slate-300 font-bold">{line.stationIds.join(" → ")}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Track Sections:</span>
                        <span className="text-slate-300">{line.sectionIds.length} segments</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Interchange Junctions:</span>
                        <span className="text-amber-400 font-bold">{line.junctionStationIds.join(", ")}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-2 pt-1.5 border-t border-slate-850 flex items-center justify-between text-[9px]">
                    <span className="text-slate-500">ACTIVE FLEET ON LINE:</span>
                    <span className="text-emerald-400 font-bold">{activeTrains.length} trains</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 2. STATIONS DIRECTORY */}
        {activeTab === "STATIONS" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
            {stations.map((st) => (
              <div key={st.id} className="p-2 rounded-sm border border-slate-800 bg-slate-950 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-slate-100">{st.name}</span>
                    <span className="px-1 py-0.2 rounded-2xs bg-slate-900 border border-slate-700 text-[9px] text-sky-400 font-bold">
                      {st.code}
                    </span>
                  </div>
                  <div className="text-[10px] space-y-0.5 text-slate-400">
                    <div className="flex justify-between">
                      <span>Station ID:</span>
                      <span className="text-slate-200 font-bold">{st.id}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Platforms:</span>
                      <span className="text-emerald-400 font-bold">{st.platforms} tracks</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Type:</span>
                      <span className={st.isJunction ? "text-amber-400 font-bold" : "text-slate-400"}>
                        {st.isJunction ? `Grand Junction (${st.junctionId})` : "Terminal / Waypoint"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Connected Lines:</span>
                      <span className="text-slate-300">{st.connectedLineIds.join(", ")}</span>
                    </div>
                  </div>
                </div>
                <div className="mt-1.5 pt-1 border-t border-slate-850 text-[9px] text-slate-500 truncate">
                  Outlets: {st.connectedSectionIds.join(", ")}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 3. JUNCTIONS & INTERLOCKING */}
        {activeTab === "JUNCTIONS" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
            {junctions.map((j) => (
              <div key={j.id} className="p-2.5 rounded-sm border border-slate-800 bg-slate-950">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-amber-400 font-black">🔀</span>
                    <span className="font-bold text-slate-100">{j.name} ({j.id})</span>
                  </div>
                  <span className="px-1.5 py-0.2 rounded-2xs bg-amber-950/70 border border-amber-500/50 text-[9px] text-amber-300">
                    INTERLOCKING
                  </span>
                </div>

                <div className="space-y-2 text-[10px]">
                  <div>
                    <span className="text-slate-500 uppercase font-bold text-[9px]">AVAILABLE ROUTES ({j.availableRoutes.length}):</span>
                    <div className="mt-1 space-y-1">
                      {j.availableRoutes.map((r) => (
                        <div key={r.id} className="p-1 rounded-2xs bg-slate-900 border border-slate-800 flex items-center justify-between">
                          <span className="text-sky-300 font-bold">{r.id}</span>
                          <span className="text-slate-400">{r.fromSection} → {r.toSection}</span>
                          <span className="text-slate-300">{r.speedLimitKmH} km/h</span>
                          <span className={`px-1 rounded-2xs text-[8px] ${r.isAligned ? "bg-emerald-950 text-emerald-300 border border-emerald-500" : "bg-slate-950 text-slate-500"}`}>
                            {r.isAligned ? "ALIGNED" : "STANDBY"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {j.conflictRelationships.length > 0 && (
                    <div>
                      <span className="text-slate-500 uppercase font-bold text-[9px]">CONFLICT MATRIX:</span>
                      <div className="mt-1 space-y-1">
                        {j.conflictRelationships.map((cr, idx) => (
                          <div key={idx} className="p-1 rounded-2xs bg-red-950/40 border border-red-900/60 text-[9px] text-red-300 flex items-start gap-1">
                            <span className="text-red-400">⚠️</span>
                            <div>
                              <strong className="text-red-200">{cr.conflictType}</strong>: {cr.routeA} vs {cr.routeB}
                              <p className="text-slate-400 text-[8px] mt-0.5">{cr.description}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 4. TRACK SECTIONS & BLOCK SIGNALING */}
        {activeTab === "SECTIONS" && (
          <div className="space-y-1.5">
            {filteredSections.map((sec) => {
              const liveSec = snapshot.sections.find((s) => s.id === sec.id);
              const isOccupied = liveSec ? liveSec.status === "OCCUPIED" : sec.status === "OCCUPIED";

              return (
                <div
                  key={sec.id}
                  onClick={() => liveSec && onSelectSection?.(liveSec)}
                  className={`p-2 rounded-sm border transition cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-2 ${
                    isOccupied
                      ? "bg-amber-950/20 border-amber-500/40"
                      : "bg-slate-950 border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${isOccupied ? "bg-amber-400 animate-pulse" : "bg-emerald-400"}`} />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <strong className="text-slate-100">{sec.id}</strong>
                        <span className="text-slate-400 font-normal">({sec.name})</span>
                      </div>
                      <div className="text-[9px] text-slate-500">
                        {sec.startStationId} (0km) → {sec.endStationId} ({sec.lengthKm}km) • Max {sec.maximumSpeed} km/h • {sec.tracks === 2 ? "Double Track" : "Single Track"}
                      </div>
                    </div>
                  </div>

                  {/* Block occupancy strip */}
                  <div className="flex items-center gap-1">
                    {sec.blocks.map((blk) => (
                      <div
                        key={blk.id}
                        title={`${blk.id}: ${blk.startKm}-${blk.endKm}km (${blk.status})`}
                        className={`h-4 w-6 rounded-2xs border text-[8px] flex items-center justify-center font-bold ${
                          isOccupied && blk.blockIndex === 1
                            ? "bg-amber-500 text-black border-amber-300 animate-pulse"
                            : "bg-slate-900 text-slate-400 border-slate-700"
                        }`}
                      >
                        B{blk.blockIndex}
                      </div>
                    ))}
                    <span className={`ml-2 px-1.5 py-0.5 rounded-2xs text-[8px] font-bold border ${
                      isOccupied
                        ? "bg-amber-950 text-amber-300 border-amber-500"
                        : "bg-emerald-950 text-emerald-300 border-emerald-500/50"
                    }`}>
                      {isOccupied ? "OCCUPIED" : "AVAILABLE"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
