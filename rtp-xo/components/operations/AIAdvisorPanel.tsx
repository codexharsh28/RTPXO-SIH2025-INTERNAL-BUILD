"use client";

import React, { useState } from "react";
import { SimulationSnapshot } from "@/types/simulation";
import { AIRecommendation } from "@/types/advisor";
import { simulationEngine } from "@/engine/simulationEngine";
import { SpeedTrajectoryVisualizer } from "./SpeedTrajectoryVisualizer";
import { useNetworkState } from "@/hooks/useNetworkState";

interface AIAdvisorPanelProps {
  snapshot: SimulationSnapshot;
  onSelectTrain?: (trainId: string) => void;
}

export const AIAdvisorPanel: React.FC<AIAdvisorPanelProps> = ({
  snapshot,
  onSelectTrain,
}) => {
  const { networkAssessment, recommendations } = snapshot;
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [inspectingRec, setInspectingRec] = useState<AIRecommendation | null>(null);

  const activeRecommendations = recommendations.filter(
    (r) => r.status !== "DISMISSED"
  );

  const handleApply = (rec: AIRecommendation) => {
    const success = simulationEngine.applyRecommendation(rec.id);
    if (success) {
      setActionFeedback(`Dispatched recommendation for ${rec.affectedTrainId} (${rec.action})`);
      setTimeout(() => setActionFeedback(null), 3000);
    }
  };

  const handleDismiss = (id: string) => {
    simulationEngine.dismissRecommendation(id);
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case "HOLD_TRAIN":
        return "bg-red-100 text-red-900 border-red-300";
      case "REDUCE_SPEED":
        return "bg-amber-100 text-amber-900 border-amber-300";
      case "INCREASE_SPEED":
        return "bg-emerald-100 text-emerald-900 border-emerald-300";
      case "GLIDE_SPEED":
        return "bg-sky-100 text-sky-900 border-sky-300";
      case "PRIORITIZE_TRAIN":
        return "bg-slate-200 text-slate-800 border-slate-400";
      case "CLEAR_SECTION":
        return "bg-slate-200 text-slate-800 border-slate-400";
      default:
        return "bg-slate-100 text-slate-700 border-slate-300";
    }
  };

  const getUrgencyBadge = (urgency: string) => {
    switch (urgency) {
      case "CRITICAL":
      case "HIGH":
        return "text-red-700 bg-red-50 border-red-300 font-bold";
      case "MEDIUM":
        return "text-amber-700 bg-amber-50 border-amber-300 font-semibold";
        return "text-amber-300 bg-amber-950 border-amber-500/50 font-semibold";
      default:
        return "text-slate-400 bg-slate-900 border-slate-700 font-medium";
    }
  };

  const net = useNetworkState();

  const handleConfirmAuthorize = (rec: AIRecommendation) => {
    net.requestConfirmation({
      title: `Authorize ${rec.action.replace("_", " ")} [Train ${rec.affectedTrainId}]`,
      description: rec.reason,
      impactSummary: `+${rec.expectedThroughputImpact}% throughput gain, ${rec.expectedDelayImpact}m delay delta`,
      actor: "DISPATCHER_01 (HUMAN OPERATOR)",
      affectedTrainId: rec.affectedTrainId,
      onConfirm: () => handleApply(rec),
    });
  };

  return (
    <div className="flex flex-col h-full rounded-sm border border-slate-800 bg-slate-950 p-3 shadow-md relative text-slate-100 font-mono select-none overflow-hidden">
      {/* Header & Efficiency Gauge */}
      <div className="flex items-start justify-between border-b border-slate-800 pb-2.5 flex-shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-cyan-400 animate-ping" />
            <h3 className="font-mono text-xs font-black uppercase tracking-wider text-slate-100">
              RTPXO AI ADVISOR (DECISION SUPPORT)
            </h3>
          </div>
          <p className="mt-0.5 text-[10px] text-slate-400 font-mono">
            Lookahead: {snapshot.predictionHorizonSeconds || 300}s • Proactive Speed Harmonization
          </p>
        </div>

        {/* Efficiency Meter */}
        <div className="flex items-center gap-2.5">
          <div className="text-right">
            <span className="block text-[8.5px] font-mono uppercase text-slate-500 font-medium">
              AI Efficiency
            </span>
            <span className="font-data text-base font-black text-cyan-400">
              {networkAssessment.efficiencyScore}%
            </span>
          </div>
          <div className="h-7 px-1.5 rounded-2xs border border-slate-700 bg-slate-900 flex items-center justify-center font-mono text-[10px] font-bold text-slate-200">
            {networkAssessment.status}
          </div>
        </div>
      </div>

      {/* Action Notification Banner */}
      {actionFeedback && (
        <div className="my-2 rounded-sm border border-emerald-500/50 bg-emerald-950/80 px-3 py-1 font-mono text-xs text-emerald-300 animate-fade-in flex-shrink-0">
          ✓ {actionFeedback}
        </div>
      )}

      {/* Modal Inspector for Trajectory & Alternatives */}
      {inspectingRec && (
        <div className="my-2 flex-shrink-0">
          <SpeedTrajectoryVisualizer
            recommendation={inspectingRec}
            onClose={() => setInspectingRec(null)}
          />
        </div>
      )}

      {/* Assessment Summary & Bottlenecks */}
      <div className="my-2 rounded-sm border border-slate-800 bg-slate-900/60 p-2.5 flex-shrink-0 text-xs">
        <div className="flex items-center justify-between text-[11px] font-mono">
          <span className="text-slate-400 font-semibold uppercase">Network Assessment:</span>
          <span
            className={`font-bold px-1.5 py-0.2 rounded-2xs border text-[9px] ${
              networkAssessment.status === "OPTIMAL"
                ? "bg-emerald-950 text-emerald-300 border-emerald-500/60"
                : networkAssessment.status === "CRITICAL"
                ? "bg-red-950 text-red-300 border-red-500/70 animate-pulse"
                : "bg-amber-950 text-amber-300 border-amber-500/60"
            }`}
          >
            {networkAssessment.status}
          </span>
        </div>
        <p className="mt-1 text-[11px] text-slate-300 leading-relaxed font-sans">
          {networkAssessment.summary}
        </p>

        {/* Top Bottleneck Section */}
        {networkAssessment.activeBottlenecks.length > 0 && (
          <div className="mt-2 flex items-center justify-between rounded-2xs border border-amber-500/40 bg-amber-950/40 px-2 py-1 font-mono text-[10px]">
            <span className="text-amber-300 font-semibold">
              ⚠️ Bottleneck: {networkAssessment.activeBottlenecks[0].sectionName}
            </span>
            <span className="text-[10px] text-amber-400 font-bold font-data">
              {networkAssessment.activeBottlenecks[0].utilizationPercent}% Saturated
            </span>
          </div>
        )}
      </div>

      {/* Recommendations Feed Title */}
      <div className="flex items-center justify-between mb-1 flex-shrink-0">
        <span className="font-mono text-[11px] font-bold text-slate-300 uppercase tracking-wider">
          PROACTIVE RECOMMENDATIONS ({activeRecommendations.length})
        </span>
      </div>

      {/* Recommendations List with custom scrollbar and scroll indicator */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1 relative">
        {activeRecommendations.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-sm border border-dashed border-slate-800 py-8 text-center text-slate-500 font-mono text-xs">
            {networkAssessment.status === "CONGESTED" || networkAssessment.activeBottlenecks.length > 0 ? (
              <>
                <span className="text-xl mb-1 text-amber-400">⚠️</span>
                <span className="font-semibold text-amber-300">Elevated Traffic Density / Bottleneck Detected</span>
                <span className="text-[10px] text-slate-400 mt-0.5">
                  {networkAssessment.activeBottlenecks.length > 0
                    ? `Section ${networkAssessment.activeBottlenecks[0].sectionName} at ${networkAssessment.activeBottlenecks[0].utilizationPercent}% capacity. Speed harmonization active.`
                    : "Automatic signal spacing maintaining section headway."}
                </span>
              </>
            ) : networkAssessment.status === "CRITICAL" ? (
              <>
                <span className="text-xl mb-1 text-red-400 animate-pulse">🚨</span>
                <span className="font-semibold text-red-300">Safety Interlocking Protection Active</span>
                <span className="text-[10px] text-slate-400 mt-0.5">
                  Holding conflicting train movements at boundary signals.
                </span>
              </>
            ) : (
              <>
                <span className="text-xl mb-1 text-emerald-400">✓</span>
                <span className="font-semibold text-slate-300">All trains operating at optimal separation.</span>
                <span className="text-[10px] text-slate-500">No dispatcher interventions required.</span>
              </>
            )}
          </div>
        ) : (
          activeRecommendations.map((rec) => {
            const isPending = rec.status === "PENDING";
            const constraints = rec.constraintsChecked;
            const counterfactual = rec.counterfactual;

            return (
              <div
                key={rec.id}
                className="rounded-sm border border-slate-800 bg-slate-900/80 p-2.5 shadow-sm hover:border-slate-700 transition space-y-1.5"
              >
                {/* Header: Provenance Tag + Action & Train */}
                <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-1.5">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`rounded-2xs border px-1.5 py-0.2 font-mono text-[9px] font-bold uppercase ${getActionBadge(
                        rec.action
                      )}`}
                    >
                      {rec.action.replace("_", " ")}
                    </span>
                    <button
                      type="button"
                      onClick={() => onSelectTrain?.(rec.affectedTrainId)}
                      className="font-mono text-xs font-bold text-cyan-400 hover:underline"
                    >
                      {rec.affectedTrainId}
                    </button>
                  </div>

                  {/* Action Provenance Badge */}
                  <div className="flex items-center gap-1 font-mono text-[9px]">
                    {isPending ? (
                      <span className="px-1.5 py-0.2 rounded-2xs bg-cyan-950 text-cyan-300 border border-cyan-500/60 font-bold animate-pulse">
                        ⚡ AI PROPOSAL (AWAITING AUTH)
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.2 rounded-2xs bg-emerald-950 text-emerald-300 border border-emerald-500/60 font-bold">
                        👤 OPERATOR DISPATCHED
                      </span>
                    )}
                  </div>
                </div>

                {/* Situation & Details */}
                <div className="space-y-1">
                  <p className="text-[11px] text-slate-200 leading-tight">
                    <strong className="text-slate-400">Situation:</strong> {rec.reason}
                  </p>

                  {/* Impact Grid */}
                  <div className="rounded-2xs bg-slate-950 p-1.5 border border-slate-800/80">
                    <div className="flex items-center justify-between text-[10px] font-data">
                      <span className="text-cyan-300 font-bold">+{rec.expectedThroughputImpact}% Throughput</span>
                      <span className="text-emerald-400 font-bold">{rec.expectedDelayImpact}m Delay</span>
                    </div>
                  </div>

                  {/* Safety Barrier & Constraints */}
                  {constraints && (
                    <div className="rounded-2xs bg-slate-950/70 p-1.5 border border-slate-800 flex flex-wrap items-center justify-between gap-1 text-[8.5px]">
                      <div className="flex items-center gap-1">
                        <span className="text-slate-400 font-semibold">Safety Barrier:</span>
                        <span
                          className={`rounded-2xs px-1 py-0.2 font-bold ${
                            constraints.isSafeToDispatch
                              ? "bg-emerald-950 text-emerald-300 border border-emerald-500/50"
                              : "bg-red-950 text-red-300 border border-red-500/50"
                          }`}
                        >
                          {constraints.isSafeToDispatch ? "✓ SAFE TO DISPATCH (SIL-4 VERIFIED)" : "✕ INTERLOCKING RESTRICTED"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-400 font-data">
                        <span>
                          Headway:{" "}
                          <strong className={constraints.headway === "PASS" ? "text-emerald-400" : "text-red-400"}>
                            {constraints.headway}
                          </strong>
                        </span>
                        <span>•</span>
                        <span>
                          Signal:{" "}
                          <strong
                            className={
                              constraints.downstreamOccupancy === "CLEAR"
                                ? "text-emerald-400"
                                : "text-amber-400"
                            }
                          >
                            {constraints.downstreamOccupancy === "CLEAR" ? "CLEAR" : "RESTRICTED (OCCUPIED)"}
                          </strong>
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Counterfactual Preview */}
                  {counterfactual && (
                    <div className="flex items-center justify-between px-1 text-[9px] text-slate-400 font-data">
                      <span>Speed: {counterfactual.currentSpeedKmH} → <strong className="text-slate-200">{counterfactual.targetSpeedKmH} km/h</strong></span>
                      <span>Projected Delay: <strong className="text-emerald-300">{counterfactual.projectedDelayMinutes} min</strong></span>
                    </div>
                  )}
                </div>

                {/* Action Buttons: REVIEW + DISMISS + Elevated AUTHORIZE */}
                <div className="mt-2 flex items-center justify-between gap-2 border-t border-slate-800/80 pt-1.5">
                  <button
                    type="button"
                    onClick={() => setInspectingRec(rec)}
                    className="rounded-2xs border border-slate-700 bg-slate-950 hover:bg-slate-800 px-2 py-1 font-mono text-[9px] text-slate-300 transition"
                  >
                    🔍 7-Point Rationale
                  </button>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleDismiss(rec.id)}
                      className="rounded-2xs px-2 py-1 font-mono text-[8.5px] text-slate-500 hover:text-slate-300 hover:bg-slate-900 transition"
                    >
                      Dismiss
                    </button>

                    <button
                      type="button"
                      onClick={() => handleConfirmAuthorize(rec)}
                      disabled={!isPending}
                      className={`rounded-2xs px-3 py-1 font-mono text-[9.5px] font-black uppercase tracking-wider transition ${
                        isPending
                          ? "bg-[#00B4D8] hover:bg-[#48CAE4] text-[#0B0E11] border border-cyan-300 shadow-[0_0_14px_rgba(0,180,216,0.65)] hover:shadow-[0_0_20px_rgba(0,180,216,0.85)] cursor-pointer"
                          : "bg-emerald-950 text-emerald-300 border border-emerald-600/60 cursor-default"
                      }`}
                    >
                      {isPending ? "⚡ AUTHORIZE DISPATCH" : "✓ DISPATCHED"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Sticky Bottom Scroll Gradient Indicator */}
      <div className="pointer-events-none sticky bottom-6 left-0 right-0 h-4 bg-gradient-to-t from-slate-950 to-transparent flex-shrink-0" />

      {/* Advisory Decision-Support Disclaimer */}
      <div className="mt-1 border-t border-slate-800 pt-1.5 text-[8.5px] text-slate-500 font-mono flex-shrink-0">
        Safety Architecture: AI recommendations are advisory only. Operator authorization required. Absolute block interlocking remains authoritative.
      </div>
    </div>
  );
};
