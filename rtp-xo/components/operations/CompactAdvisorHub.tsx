"use client";

import React, { useState } from "react";
import { SimulationSnapshot } from "@/types/simulation";
import { AIRecommendation } from "@/types/advisor";
import { CoordinatedStrategyPlan } from "@/types/strategy";
import { simulationEngine } from "@/engine/simulationEngine";
import { useNetworkState } from "@/hooks/useNetworkState";

export interface CompactAdvisorHubProps {
  snapshot: SimulationSnapshot;
  onOpenExplain?: (rec: AIRecommendation) => void;
  onOpenRecoveryTab?: () => void;
  onSelectTrainById?: (trainId: string) => void;
}

export const CompactAdvisorHub: React.FC<CompactAdvisorHubProps> = ({
  snapshot,
  onOpenExplain,
  onOpenRecoveryTab,
  onSelectTrainById,
}) => {
  const net = useNetworkState();
  const { networkAssessment, recommendations, availableStrategies = [], recoveryPlans = [] } = snapshot;
  const [activeTab, setActiveTab] = useState<"ACTIONS" | "STRATEGIES" | "ASSESSMENT">("ACTIONS");
  const [simulatingRecId, setSimulatingRecId] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  const activeRecommendations = recommendations.filter((r) => r.status !== "DISMISSED");
  const activeRecoveryPlans = recoveryPlans.filter((p) => p.executionStatus === "PROPOSED" || p.executionStatus === "AUTHORIZED");

  const handleAuthorizeRec = (rec: AIRecommendation) => {
    net.requestConfirmation({
      title: `Authorize ${rec.action.replace("_", " ")} [Train ${rec.affectedTrainId}]`,
      description: rec.reason,
      impactSummary: `+${rec.expectedThroughputImpact}% throughput gain, ${rec.expectedDelayImpact}m delay delta`,
      actor: "DISPATCHER_01 (HUMAN OPERATOR)",
      affectedTrainId: rec.affectedTrainId,
      onConfirm: () => {
        const success = simulationEngine.applyRecommendation(rec.id);
        if (success) {
          setActionFeedback(`Authorized dispatch: ${rec.affectedTrainId} → ${rec.action.replace("_", " ")}`);
          setTimeout(() => setActionFeedback(null), 3000);
        }
      },
    });
  };

  const handleDismissRec = (recId: string) => {
    simulationEngine.dismissRecommendation(recId);
  };

  const handleAuthorizeStrategy = (plan: CoordinatedStrategyPlan) => {
    const success = simulationEngine.dispatchStrategy(plan.strategyId);
    if (success) {
      setActionFeedback(`Authorized strategy: ${plan.name} (${plan.constituentActions.length} actions)`);
      setTimeout(() => setActionFeedback(null), 3000);
    }
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case "HOLD_TRAIN":
        return "bg-red-950/80 text-red-300 border-red-500/60";
      case "REDUCE_SPEED":
        return "bg-amber-950/80 text-amber-300 border-amber-500/60";
      case "INCREASE_SPEED":
        return "bg-emerald-950/80 text-emerald-300 border-emerald-500/60";
      case "GLIDE_SPEED":
        return "bg-cyan-950/80 text-cyan-300 border-cyan-500/60";
      case "PRIORITIZE_TRAIN":
        return "bg-purple-950/80 text-purple-300 border-purple-500/60";
      default:
        return "bg-slate-800 text-slate-300 border-slate-700";
    }
  };

  const getUrgencyBadge = (urgency: string) => {
    switch (urgency) {
      case "CRITICAL":
      case "HIGH":
        return "bg-red-950 text-red-200 border-red-500 font-bold animate-pulse";
      case "MEDIUM":
        return "bg-amber-950 text-amber-300 border-amber-500 font-semibold";
      default:
        return "bg-slate-800 text-slate-400 border-slate-700";
    }
  };

  const topBottleneck = networkAssessment.activeBottlenecks?.[0];

  return (
    <div className="flex flex-col h-full rounded-sm border border-slate-800/90 bg-slate-900/95 p-2 shadow-sm font-mono text-xs overflow-hidden select-none">
      {/* 1. Header: Panel Title + Efficiency + Navigation Tabs */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-1.5 flex-shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-cyan-400 animate-ping" />
          <h3 className="font-mono text-xs font-black uppercase tracking-wider text-slate-100">
            DECISION SUPPORT ADVISOR
          </h3>
        </div>

        {/* Workspace Mode Sub-Tabs */}
        <div className="flex items-center gap-0.5 bg-slate-950 p-0.5 rounded-sm border border-slate-800 text-[9px]">
          <button
            type="button"
            onClick={() => setActiveTab("ACTIONS")}
            className={`px-1.5 py-0.5 rounded-2xs font-bold transition ${
              activeTab === "ACTIONS"
                ? "bg-cyan-950 text-cyan-300 border border-cyan-600/60 shadow-xs"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            ACTIONS ({activeRecommendations.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("STRATEGIES")}
            className={`px-1.5 py-0.5 rounded-2xs font-bold transition ${
              activeTab === "STRATEGIES"
                ? "bg-purple-950 text-purple-300 border border-purple-600/60 shadow-xs"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            STRATEGIES ({availableStrategies.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("ASSESSMENT")}
            className={`px-1.5 py-0.5 rounded-2xs font-bold transition ${
              activeTab === "ASSESSMENT"
                ? "bg-slate-800 text-slate-100 border border-slate-600 shadow-xs"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            ASSESSMENT
          </button>
        </div>
      </div>

      {/* Action Notification Banner */}
      {actionFeedback && (
        <div className="my-1 rounded-sm border border-emerald-500/50 bg-emerald-950/80 px-2 py-1 font-mono text-[10px] text-emerald-300 flex items-center justify-between animate-fade-in flex-shrink-0">
          <span>✓ {actionFeedback}</span>
          <span className="text-[9px] text-emerald-400/80">COMMITTED TO ENGINE</span>
        </div>
      )}

      {/* Disruption Alert if Recovery Plans exist */}
      {activeRecoveryPlans.length > 0 && (
        <div className="my-1 flex items-center justify-between rounded-sm border border-rose-500/60 bg-rose-950/70 px-2 py-1 text-[10px] text-rose-200 animate-pulse flex-shrink-0">
          <span className="font-bold">⚠️ {activeRecoveryPlans.length} Disruption Plan(s) Ready</span>
          <button
            type="button"
            onClick={onOpenRecoveryTab}
            className="rounded-xs bg-rose-800 px-1.5 py-0.5 text-[9px] font-bold text-white hover:bg-rose-700"
          >
            OPEN RECOVERY TAB →
          </button>
        </div>
      )}

      {/* 2. Top Network Assessment & Primary Bottleneck Strip */}
      <div className="my-1.5 rounded-sm border border-slate-800 bg-slate-950/80 p-2 text-[10px] flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-bold uppercase">NETWORK ASSESSMENT:</span>
            <span
              className={`font-black px-1.5 py-0.2 rounded-2xs border text-[9px] ${
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

          <div
            className="flex items-center gap-2 cursor-help relative group"
            title={
              networkAssessment.aiScoreBreakdown
                ? `AI Score: ${networkAssessment.efficiencyScore}%\n` +
                  `Base: 100\n` +
                  (networkAssessment.aiScoreBreakdown.penalties.map((p) => `${p.points} ${p.factor}: ${p.description}`).join("\n") || "") +
                  (networkAssessment.aiScoreBreakdown.bonuses.map((b) => `+${b.points} ${b.factor}: ${b.description}`).join("\n") || "")
                : `Efficiency: ${networkAssessment.efficiencyScore}%`
            }
          >
            <span className="text-[9px] text-slate-400">AI SCORE</span>
            <span className="font-black text-cyan-400">{networkAssessment.efficiencyScore}%</span>
          </div>
        </div>

        <p className="mt-1 text-slate-300 text-[10px] leading-tight line-clamp-2">
          {networkAssessment.summary || "All trains operating within planned headway parameters."}
        </p>

        {/* Most Important Bottleneck Section */}
        {topBottleneck ? (
          <div className="mt-1.5 flex items-center justify-between rounded-xs border border-amber-500/40 bg-amber-950/40 px-2 py-1 text-[9px]">
            <div className="flex items-center gap-1">
              <span className="text-amber-300 font-bold">⚠️ BOTTLENECK:</span>
              <span className="text-slate-200 font-bold">{topBottleneck.sectionName}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-amber-400 font-mono font-bold">{topBottleneck.utilizationPercent}% Saturated</span>
              {topBottleneck.trainsQueued?.length > 0 && (
                <span className="text-slate-400">({topBottleneck.trainsQueued.join(", ")})</span>
              )}
            </div>
          </div>
        ) : (
          <div className="mt-1 flex items-center justify-between text-[9px] text-emerald-400/80">
            <span>✓ No critical bottleneck detected in current lookahead window</span>
          </div>
        )}
      </div>

      {/* 3. Main Content: Recommendations / Strategies / Assessment Breakdown */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-0.5">
        {/* TAB 1: SINGLE-ACTION RECOMMENDATIONS */}
        {activeTab === "ACTIONS" && (
          <>
            {activeRecommendations.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center text-slate-400 p-4 border border-dashed border-slate-800 rounded-sm">
                {networkAssessment.status === "CONGESTED" || topBottleneck ? (
                  <>
                    <span className="text-xl mb-1 text-amber-400">⚠️</span>
                    <span className="font-bold text-amber-300 text-xs">Elevated Traffic Density / Bottleneck</span>
                    <span className="text-[10px] text-slate-400 mt-0.5 max-w-[280px]">
                      {topBottleneck
                        ? `Section ${topBottleneck.sectionName} at ${topBottleneck.utilizationPercent}% capacity. Speed harmonization active.`
                        : "Corridor density elevated. Automatic signal spacing maintaining section headway."}
                    </span>
                  </>
                ) : networkAssessment.status === "CRITICAL" ? (
                  <>
                    <span className="text-xl mb-1 text-red-400 animate-pulse">🚨</span>
                    <span className="font-bold text-red-300 text-xs">Safety Intervention Active</span>
                    <span className="text-[10px] text-slate-400 mt-0.5">
                      Interlocking signal protection holds conflicting movements.
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-xl mb-1 text-emerald-400">✓</span>
                    <span className="font-bold text-slate-300 text-xs">Network Operating Optimally</span>
                    <span className="text-[10px] text-slate-400 mt-0.5">No proactive dispatcher intervention required</span>
                  </>
                )}
              </div>
            ) : (
              activeRecommendations.map((rec) => {
                const isPending = rec.status === "PENDING";
                const isSimulating = simulatingRecId === rec.id;
                const constraints = rec.constraintsChecked;
                const counterfactual = rec.counterfactual;
                const confidencePct = Math.round((rec.confidence ?? 0.88) * 100);
                const isSafe = rec.isSafeToDispatch && (constraints ? constraints.isSafeToDispatch : true);

                return (
                  <div
                    key={rec.id}
                    className="rounded-sm border border-slate-800 bg-slate-950/70 p-2 hover:border-slate-700 transition"
                  >
                    {/* Header: Action Badge, Affected Train, Confidence, Urgency */}
                    <div className="flex items-center justify-between gap-1">
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
                          onClick={() => onSelectTrainById?.(rec.affectedTrainId)}
                          className="font-bold text-cyan-400 hover:text-cyan-300 hover:underline text-[11px]"
                        >
                          {rec.affectedTrainId}
                        </button>

                        {rec.targetSpeed !== undefined && (
                          <span className="text-slate-400 text-[9px]">
                            {counterfactual ? `${counterfactual.currentSpeedKmH} → ` : ""}
                            <strong className="text-slate-100">{rec.targetSpeed} km/h</strong>
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 text-[9px]">
                        <span className="rounded-2xs bg-slate-900 border border-slate-800 px-1 py-0.2 text-cyan-400 font-bold" title="Optimization Confidence">
                          {confidencePct}% CONF
                        </span>
                        <span className={`rounded-2xs border px-1 py-0.2 text-[8px] ${getUrgencyBadge(rec.urgency)}`}>
                          {rec.urgency}
                        </span>
                      </div>
                    </div>

                    {/* Situation & Reason Summary */}
                    <div className="mt-1 text-[10px] text-slate-300 leading-tight">
                      <span className="text-slate-400 font-semibold">Situation: </span>
                      {rec.reason}
                    </div>

                    {/* Expected Benefit Grid (Delay Recovery & Throughput Impact) */}
                    <div className="mt-1.5 grid grid-cols-2 gap-1 rounded-xs bg-slate-900/80 p-1.5 border border-slate-800/80 text-[9px]">
                      <div>
                        <span className="text-slate-400 block text-[8px] uppercase">Delay Recovery</span>
                        <span className="font-bold text-emerald-400 text-[10px]">
                          {rec.expectedDelayImpact < 0 ? `${rec.expectedDelayImpact} min` : `+${rec.expectedDelayImpact} min`}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[8px] uppercase">Throughput Impact</span>
                        <span className="font-bold text-cyan-300 text-[10px]">
                          +{rec.expectedThroughputImpact}% Flow
                        </span>
                      </div>
                    </div>

                    {/* Safety Status & Interlocking Constraint Verification */}
                    <div className="mt-1 flex items-center justify-between rounded-xs bg-slate-900/40 px-1.5 py-1 text-[8px] border border-slate-800/40">
                      <div className="flex items-center gap-1">
                        <span className="text-slate-400 uppercase">Safety Clearance:</span>
                        <span className={`font-bold px-1 py-0.2 rounded-2xs ${isSafe ? "bg-emerald-950 text-emerald-300 border border-emerald-500/50" : "bg-red-950 text-red-300 border border-red-500/50"}`}>
                          {isSafe ? "✓ SIL-4 CLEARED" : "✕ RESTRICTED"}
                        </span>
                      </div>
                      {constraints && (
                        <div className="flex items-center gap-1.5 text-slate-400">
                          <span>
                            Headway:{" "}
                            <strong className={constraints.headway === "PASS" ? "text-emerald-400" : "text-red-400"}>
                              {constraints.headway}
                            </strong>
                          </span>
                          <span>•</span>
                          <span>
                            Signal:{" "}
                            <strong className={constraints.downstreamOccupancy === "CLEAR" ? "text-emerald-400" : "text-amber-400"}>
                              {constraints.downstreamOccupancy === "CLEAR" ? "CLEAR" : "RESTRICTED"}
                            </strong>
                          </span>
                        </div>
                      )}
                    </div>

                    {/* What-If Counterfactual Simulation Drawer (when SIMULATE is clicked) */}
                    {isSimulating && counterfactual && (
                      <div className="mt-1.5 rounded-xs border border-cyan-700/60 bg-cyan-950/40 p-1.5 text-[9px] space-y-1 animate-fade-in">
                        <div className="flex items-center justify-between font-bold text-cyan-300 border-b border-cyan-800/50 pb-0.5">
                          <span>🔬 WHAT-IF SIMULATION PREVIEW</span>
                          <span>Horizon: {rec.predictionHorizonSeconds || 300}s</span>
                        </div>
                        <div className="grid grid-cols-2 gap-1 text-[8px]">
                          <div>
                            <span className="text-slate-400">Speed Profile: </span>
                            <span className="text-slate-200 font-bold">{counterfactual.currentSpeedKmH} → {counterfactual.targetSpeedKmH} km/h</span>
                          </div>
                          <div>
                            <span className="text-slate-400">Projected Delay: </span>
                            <span className="text-emerald-300 font-bold">{counterfactual.projectedDelayMinutes} min</span>
                          </div>
                          <div>
                            <span className="text-slate-400">Section Flow: </span>
                            <span className="text-cyan-200 font-bold">{counterfactual.currentSectionThroughput} → {counterfactual.projectedSectionThroughput} t/h</span>
                          </div>
                          <div>
                            <span className="text-slate-400">Conflict Risk: </span>
                            <span className="text-emerald-300 font-bold">LOW (Averted)</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 3 Decision Support Action Buttons: [SIMULATE] [REVIEW] [AUTHORIZE] */}
                    <div className="mt-2 flex items-center justify-between gap-1 border-t border-slate-800/80 pt-1.5">
                      <div className="flex items-center gap-1">
                        {/* [SIMULATE] Button */}
                        <button
                          type="button"
                          onClick={() => setSimulatingRecId((prev) => (prev === rec.id ? null : rec.id))}
                          className={`rounded-2xs px-1.5 py-0.5 text-[9px] font-bold border transition ${
                            isSimulating
                              ? "bg-cyan-950 text-cyan-200 border-cyan-500"
                              : "bg-slate-950 text-slate-300 border-slate-700 hover:bg-slate-800"
                          }`}
                        >
                          {isSimulating ? "✕ CLOSE SIM" : "🔬 SIMULATE"}
                        </button>

                        {/* [REVIEW] Button */}
                        <button
                          type="button"
                          onClick={() => onOpenExplain?.(rec)}
                          className="rounded-2xs bg-slate-950 px-1.5 py-0.5 text-[9px] font-bold text-slate-300 border border-slate-700 hover:bg-slate-800 transition"
                        >
                          🔍 REVIEW
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleDismissRec(rec.id)}
                          className="rounded-2xs px-2 py-1 text-[8.5px] font-semibold text-slate-500 hover:text-slate-300 hover:bg-slate-900 border border-transparent hover:border-slate-800 transition cursor-pointer"
                        >
                          DISMISS
                        </button>

                        {/* [AUTHORIZE] Button */}
                        <button
                          type="button"
                          onClick={() => handleAuthorizeRec(rec)}
                          disabled={!isPending || !isSafe}
                          className={`rounded-2xs px-3 py-1 text-[9.5px] font-black tracking-wider uppercase transition ${
                            !isPending
                              ? "bg-emerald-950 text-emerald-300 border border-emerald-600/60 cursor-default"
                              : !isSafe
                              ? "bg-slate-800 text-slate-400 border border-slate-700 cursor-not-allowed"
                              : "bg-[#00B4D8] hover:bg-[#48CAE4] text-[#0B0E11] border border-cyan-300 font-black shadow-[0_0_14px_rgba(0,180,216,0.65)] hover:shadow-[0_0_20px_rgba(0,180,216,0.85)] cursor-pointer"
                          }`}
                        >
                          {!isPending ? "✓ AUTHORIZED" : "⚡ AUTHORIZE DISPATCH"}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </>
        )}

        {/* TAB 2: PHASE 9 COORDINATED STRATEGY PLANS */}
        {activeTab === "STRATEGIES" && (
          <>
            {availableStrategies.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center text-slate-400 p-4 border border-dashed border-slate-800 rounded-sm">
                <span className="text-xl mb-1 text-purple-400">⚡</span>
                <span className="font-bold text-slate-300 text-xs">Single-Action Dispatch Active</span>
                <span className="text-[10px] text-slate-400 mt-0.5">Multi-train bundled strategies synthesize during multi-train conflict clusters</span>
              </div>
            ) : (
              availableStrategies.map((plan) => (
                <div
                  key={plan.strategyId}
                  className="rounded-sm border border-purple-900/60 bg-purple-950/20 p-2 hover:border-purple-700 transition"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="rounded-2xs bg-purple-900/80 text-purple-200 border border-purple-500/60 px-1 py-0.2 text-[8px] font-bold">
                        STRATEGY
                      </span>
                      <span className="font-bold text-slate-100 text-[10px]">{plan.name}</span>
                    </div>
                    <span className="text-[9px] font-bold text-purple-300">
                      Score: {plan.objectiveScore.toFixed(0)}
                    </span>
                  </div>

                  <p className="mt-1 text-[9px] text-slate-300 leading-tight">
                    {plan.rationale}
                  </p>

                  {/* Bundled Actions List */}
                  <div className="mt-1.5 space-y-1">
                    {plan.constituentActions.map((act) => (
                      <div key={act.candidateAction.id} className="flex items-center justify-between bg-slate-950/80 px-1.5 py-0.5 rounded-2xs text-[8px]">
                        <span className="font-bold text-cyan-400">{act.trainId}</span>
                        <span className="text-slate-300">{act.candidateAction.action} {act.candidateAction.targetSpeed ? `@ ${act.candidateAction.targetSpeed} km/h` : ""}</span>
                        <span className="text-emerald-400">Score: {act.individualBaseScore.toFixed(0)}</span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-2 flex items-center justify-between border-t border-purple-900/50 pt-1.5">
                    <span className="text-[8px] text-slate-400">
                      Impact: +{plan.predictedImpact.projectedCorridorThroughputGainPercent}% throughput • {plan.predictedImpact.projectedNetDelaySavedMinutes}m total recovery
                    </span>
                    <button
                      type="button"
                      onClick={() => handleAuthorizeStrategy(plan)}
                      className="rounded-2xs bg-purple-600 hover:bg-purple-500 text-white font-black px-2 py-0.5 text-[9px] uppercase tracking-wider"
                    >
                      AUTHORIZE STRATEGY
                    </button>
                  </div>
                </div>
              ))
            )}
          </>
        )}

        {/* TAB 3: NETWORK ASSESSMENT & PREDICTIVE OVERVIEW */}
        {activeTab === "ASSESSMENT" && (
          <div className="space-y-1.5 text-[10px]">
            <div className="rounded-sm bg-slate-950 p-2 border border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-bold uppercase">Assessment State:</span>
                <span className="font-bold text-cyan-300">{networkAssessment.status}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-bold uppercase">Efficiency Index:</span>
                <span className="font-bold text-emerald-400">{networkAssessment.efficiencyScore}/100</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-bold uppercase">Active Recommendations:</span>
                <span className="font-bold text-slate-200">{activeRecommendations.length} pending</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-bold uppercase">Active Bottlenecks:</span>
                <span className="font-bold text-amber-300">{networkAssessment.activeBottlenecks?.length || 0}</span>
              </div>
            </div>

            {networkAssessment.activeBottlenecks?.map((b) => (
              <div key={b.id} className="rounded-sm bg-amber-950/30 border border-amber-800/50 p-2 space-y-1">
                <div className="flex items-center justify-between font-bold text-amber-300">
                  <span>{b.sectionName}</span>
                  <span>{b.utilizationPercent}% Saturated</span>
                </div>
                <p className="text-[9px] text-slate-300">{b.reason}</p>
                <div className="text-[8px] text-slate-400">
                  Trains Queued: <span className="text-slate-200 font-bold">{b.trainsQueued?.join(", ") || "None"}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4. Mandatory Decision Support & Operator Authorization Disclaimer */}
      <div className="mt-1.5 border-t border-slate-800/80 pt-1 text-[8px] text-slate-400 flex items-center justify-between flex-shrink-0">
        <span className="text-slate-300 font-semibold">🔒 OPERATOR AUTHORIZATION REQUIRED</span>
        <span>AI is advisory • Interlocking authoritative</span>
      </div>
    </div>
  );
};