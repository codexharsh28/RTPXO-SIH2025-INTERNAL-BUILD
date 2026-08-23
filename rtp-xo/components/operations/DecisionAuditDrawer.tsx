"use client";

import React, { useState } from "react";
import { SimulationSnapshot } from "@/types/simulation";
import { DecisionAuditRecord, DecisionVerificationStatus, DecisionAttributionType } from "@/types/optimization";
import { useNetworkState } from "@/hooks/useNetworkState";

interface DecisionAuditDrawerProps {
  snapshot?: SimulationSnapshot;
}

export const DecisionAuditDrawer: React.FC<DecisionAuditDrawerProps> = ({ snapshot: propSnapshot }) => {
  const net = useNetworkState();
  const [isOpen, setIsOpen] = useState(true);
  const [actorFilter, setActorFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const snapshot = propSnapshot || net.rawSnapshot;
  const decisionHistory: DecisionAuditRecord[] = snapshot.decisionHistory || [];

  const getEventBadge = (eventType: string) => {
    switch (eventType) {
      case "RECOMMENDATION_APPLIED":
        return "bg-cyan-950 text-cyan-300 border-cyan-500/60 font-bold";
      case "RECOMMENDATION_DISMISSED":
        return "bg-slate-900 text-slate-400 border-slate-700";
      case "MANUAL_SPEED_OVERRIDE":
        return "bg-amber-950 text-amber-300 border-amber-500/60 font-bold";
      case "TRAIN_HOLD":
        return "bg-red-950 text-red-300 border-red-500/60 font-black";
      case "TRAIN_RELEASE":
        return "bg-emerald-950 text-emerald-300 border-emerald-500/60 font-bold";
      default:
        return "bg-slate-900 text-slate-300 border-slate-700";
    }
  };

  const getStatusBadge = (status: DecisionVerificationStatus) => {
    switch (status) {
      case "VERIFIED_ACCURATE":
        return "bg-emerald-950 text-emerald-300 border-emerald-500/60 font-bold";
      case "DEVIATED":
        return "bg-red-950 text-red-300 border-red-500/60 font-bold";
      case "INCONCLUSIVE":
        return "bg-slate-900 text-slate-400 border-slate-700";
      case "PENDING":
      default:
        return "bg-amber-950 text-amber-300 border-amber-500/60 animate-pulse font-semibold";
    }
  };

  const getProvenanceBadge = (dec: DecisionAuditRecord) => {
    const isOperator =
      dec.eventType === "MANUAL_SPEED_OVERRIDE" ||
      dec.eventType === "TRAIN_HOLD" ||
      dec.eventType === "TRAIN_RELEASE" ||
      dec.eventType === "RECOMMENDATION_APPLIED";

    if (isOperator) {
      return (
        <span className="px-1.5 py-0.2 rounded-2xs bg-emerald-950 text-emerald-300 border border-emerald-500/60 font-bold text-[8px] flex items-center gap-1">
          <span>👤</span>
          <span>OPERATOR CONFIRMED</span>
        </span>
      );
    }

    return (
      <span className="px-1.5 py-0.2 rounded-2xs bg-purple-950 text-purple-300 border border-purple-500/60 font-bold text-[8px] flex items-center gap-1">
        <span>⚙</span>
        <span>AI AUTONOMOUS</span>
      </span>
    );
  };

  const filteredHistory = decisionHistory.filter((dec) => {
    const isOperator =
      dec.eventType === "MANUAL_SPEED_OVERRIDE" ||
      dec.eventType === "TRAIN_HOLD" ||
      dec.eventType === "TRAIN_RELEASE" ||
      dec.eventType === "RECOMMENDATION_APPLIED";

    const matchesActor =
      actorFilter === "ALL" ||
      (actorFilter === "OPERATOR" && isOperator) ||
      (actorFilter === "AI_AUTONOMOUS" && !isOperator);

    const verificationStatus = dec.actualOutcome?.verificationStatus || "PENDING";
    const matchesStatus =
      statusFilter === "ALL" || verificationStatus === statusFilter;

    const matchesSearch =
      dec.affectedTrainId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      dec.affectedSectionId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      dec.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      dec.reason.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesActor && matchesStatus && matchesSearch;
  });

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-sm p-3 text-xs shadow-md font-mono text-slate-100 select-none">
      {/* Header & Filter Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-cyan-400" />
          <h3 className="font-mono text-xs font-black uppercase tracking-wider text-slate-100">
            IMMUTABLE CLOSED-LOOP AUDIT LOG
          </h3>
          <span className="text-[9px] px-1.5 py-0.2 rounded-2xs bg-slate-900 text-cyan-300 border border-slate-800 font-bold font-data">
            {filteredHistory.length} / {decisionHistory.length} RECORDS
          </span>
          <span className="text-[8px] text-slate-500 uppercase tracking-widest">
            🔒 SIL-4 APPEND ONLY
          </span>
        </div>

        <div className="flex items-center gap-2 text-[10px]">
          {/* Search Box */}
          <input
            type="text"
            placeholder="Search train, section, action..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-44 rounded-2xs bg-slate-900 border border-slate-800 px-2 py-1 text-[10px] text-slate-200 placeholder-slate-500 focus:border-cyan-500 focus:outline-hidden font-data"
          />

          {/* Actor Filter */}
          <select
            value={actorFilter}
            onChange={(e) => setActorFilter(e.target.value)}
            className="rounded-2xs bg-slate-900 border border-slate-800 px-2 py-1 text-[10px] text-slate-200 focus:border-cyan-500 focus:outline-hidden"
          >
            <option value="ALL">ALL ACTORS</option>
            <option value="OPERATOR">👤 OPERATOR ACTIONS</option>
            <option value="AI_AUTONOMOUS">⚙ AI AUTONOMOUS</option>
          </select>

          {/* Verification Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-2xs bg-slate-900 border border-slate-800 px-2 py-1 text-[10px] text-slate-200 focus:border-cyan-500 focus:outline-hidden"
          >
            <option value="ALL">ALL STATUSES</option>
            <option value="VERIFIED_ACCURATE">VERIFIED ACCURATE</option>
            <option value="DEVIATED">DEVIATED</option>
            <option value="PENDING">PENDING</option>
          </select>

          <button
            onClick={() => setIsOpen(!isOpen)}
            className="text-[10px] px-2 py-1 rounded-2xs bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 font-bold transition"
          >
            {isOpen ? "COLLAPSE" : "EXPAND"}
          </button>
        </div>
      </div>

      {/* Audit Log Entries List */}
      {isOpen && (
        <div className="mt-2.5 space-y-2 max-h-96 overflow-y-auto pr-1">
          {filteredHistory.length === 0 ? (
            <div className="text-center py-8 text-slate-500 italic bg-slate-900/50 rounded-sm border border-slate-800">
              No audit records matching current filter criteria.
            </div>
          ) : (
            filteredHistory
              .slice()
              .reverse()
              .map((dec) => {
                const status = dec.actualOutcome?.verificationStatus || "PENDING";
                const attr = dec.actualOutcome?.attributionType;
                const simClock = `T+${Math.floor(dec.simulationTime / 60)}m ${Math.floor(dec.simulationTime % 60)}s`;

                return (
                  <div
                    key={dec.id}
                    className="bg-slate-900/80 border border-slate-800 hover:border-slate-700 rounded-sm p-2.5 text-[10.5px] space-y-2 transition"
                  >
                    {/* Header Row: Provenance + Event Type + Train + Outcome */}
                    <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-slate-800 pb-1.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {getProvenanceBadge(dec)}

                        <span
                          className={`px-1.5 py-0.2 rounded-2xs text-[8.5px] uppercase border font-bold ${getEventBadge(
                            dec.eventType
                          )}`}
                        >
                          {dec.eventType.replace(/_/g, " ")}
                        </span>

                        <strong className="text-cyan-400 font-bold font-data">
                          {dec.affectedTrainId}
                        </strong>

                        <span className="text-slate-300 font-semibold font-data">
                          [{dec.action}]
                        </span>

                        <span
                          className={`px-1.5 py-0.2 rounded-2xs text-[8px] uppercase border ${getStatusBadge(
                            status
                          )}`}
                        >
                          {status.replace(/_/g, " ")}
                        </span>

                        {attr && (
                          <span className="px-1.5 py-0.2 rounded-2xs text-[7.5px] uppercase border font-medium border-slate-700 bg-slate-950 text-slate-400">
                            ATTR: {attr.replace(/_/g, " ")}
                          </span>
                        )}
                      </div>

                      <div className="text-[9px] text-slate-400 font-data flex items-center gap-2">
                        <span>{simClock}</span>
                        <span>•</span>
                        <span>Section: <strong className="text-slate-200">{dec.affectedSectionId}</strong></span>
                      </div>
                    </div>

                    {/* Operational Reasoning */}
                    <p className="text-slate-300 text-[10px] leading-relaxed">
                      <strong className="text-slate-400">Reasoning:</strong> {dec.reason}
                    </p>

                    {/* 3-Column Comparative Telemetry Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 pt-1 border-t border-slate-800/80 text-[9.5px]">
                      {/* T0 Baseline Pre-State */}
                      <div className="bg-slate-950 p-2 rounded-2xs border border-slate-800/80 space-y-0.5">
                        <span className="text-slate-500 block font-bold uppercase text-[8px]">
                          T0 Baseline Pre-State
                        </span>
                        <div className="text-slate-300 font-data">
                          Speed: <strong className="text-slate-100">{dec.preState.trainSpeed} km/h</strong> | Delay: <strong className="text-slate-100">{dec.preState.trainDelayMinutes}m</strong>
                        </div>
                        <div className="text-slate-400 font-data">
                          Throughput: {dec.preState.sectionThroughput} T/h | Conflict: {dec.preState.hasActiveConflict ? "🚨 YES" : "✓ NO"}
                        </div>
                      </div>

                      {/* Projected Impact */}
                      <div className="bg-slate-950 p-2 rounded-2xs border border-slate-800/80 space-y-0.5">
                        <span className="text-slate-500 block font-bold uppercase text-[8px]">
                          Projected Impact (30s Window)
                        </span>
                        <div className="text-cyan-300 font-data">
                          Delay: {dec.projectedImpact.expectedDelayImpact <= 0 ? "" : "+"}
                          {dec.projectedImpact.expectedDelayImpact}m | Throughput: {dec.projectedImpact.expectedThroughputImpact >= 0 ? "+" : ""}
                          {dec.projectedImpact.expectedThroughputImpact}%
                        </div>
                        <div className="text-slate-400 font-data">
                          Target Delay: {dec.projectedImpact.projectedDelayMinutes}m
                        </div>
                      </div>

                      {/* Live Measured Outcome */}
                      <div className="bg-slate-950 p-2 rounded-2xs border border-slate-800/80 space-y-0.5">
                        <span className="text-slate-500 block font-bold uppercase text-[8px]">
                          Live Measured Outcome
                        </span>
                        {dec.actualOutcome ? (
                          <div className="text-slate-200 font-data space-y-0.5">
                            <div>
                              Delay: <strong className="text-emerald-400">{dec.actualOutcome.measuredDelayMinutes}m</strong> ({dec.actualOutcome.actualDelayDeltaMinutes >= 0 ? "+" : ""}{dec.actualOutcome.actualDelayDeltaMinutes}m)
                            </div>
                            <div className="text-slate-400">
                              Throughput: {dec.actualOutcome.measuredSectionThroughput} T/h | Status: {dec.actualOutcome.conflictResolution}
                            </div>
                            {dec.actualOutcome.varianceNotes && (
                              <div className="text-[8.5px] text-slate-400 italic">
                                {dec.actualOutcome.varianceNotes}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-amber-400 italic">
                            Pending measurement (Window: {dec.evaluationWindowSeconds || 30}s)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
          )}
        </div>
      )}
    </div>
  );
};
