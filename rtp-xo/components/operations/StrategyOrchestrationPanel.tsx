"use client";

import React, { useState } from "react";
import { SimulationSnapshot } from "@/types/simulation";
import { CoordinatedStrategyPlan, CoordinatedStrategyAuditRecord } from "@/types/strategy";
import { simulationEngine } from "@/engine/simulationEngine";

interface StrategyOrchestrationPanelProps {
  snapshot: SimulationSnapshot;
  onSelectTrain?: (trainId: string) => void;
  onOpenAuditDrawer?: () => void;
}

export const StrategyOrchestrationPanel: React.FC<StrategyOrchestrationPanelProps> = ({
  snapshot,
  onSelectTrain,
  onOpenAuditDrawer,
}) => {
  const { availableStrategies = [], strategyAuditHistory = [] } = snapshot;

  const [confirmingStrategyId, setConfirmingStrategyId] = useState<string | null>(null);
  const [selectedPlanTab, setSelectedPlanTab] = useState<"ACTIVE" | "AUDIT">("ACTIVE");
  const [actionFeedback, setActionFeedback] = useState<{ message: string; type: "SUCCESS" | "WARNING" | "INFO" } | null>(null);

  const activeStrategies = availableStrategies.filter(
    (s) => s.executionStatus === "PROPOSED" || s.executionStatus === "STALE_REJECTED"
  );

  const handleDispatch = (strategy: CoordinatedStrategyPlan) => {
    const success = simulationEngine.dispatchStrategy(strategy.strategyId);
    setConfirmingStrategyId(null);

    if (success) {
      setActionFeedback({
        message: `Authorized & Dispatched strategy: ${strategy.name} across ${strategy.targetTrainIds.length} train(s)`,
        type: "SUCCESS",
      });
    } else {
      setActionFeedback({
        message: `Strategy dispatch rejected: State revision changed or safety re-validation failed.`,
        type: "WARNING",
      });
    }

    setTimeout(() => {
      setActionFeedback(null);
    }, 4000);
  };

  const handleDismiss = (strategyId: string) => {
    const success = simulationEngine.dismissStrategy(strategyId);
    setConfirmingStrategyId(null);

    if (success) {
      setActionFeedback({
        message: `Dismissed strategy ${strategyId}`,
        type: "INFO",
      });
      setTimeout(() => setActionFeedback(null), 3000);
    }
  };

  const getSafetyBadge = (status: string) => {
    switch (status) {
      case "VERIFIED_SAFE":
        return "bg-emerald-50 text-emerald-800 border-emerald-300";
      case "UNSAFE_REJECTED":
      case "HARD_INTERLOCKING_VIOLATION":
        return "bg-red-50 text-red-800 border-red-300 font-bold";
      default:
        return "bg-amber-50 text-amber-800 border-amber-300";
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PROPOSED":
        return "bg-sky-50 text-sky-800 border-sky-300";
      case "EXECUTED":
        return "bg-emerald-50 text-emerald-800 border-emerald-300";
      case "STALE_REJECTED":
        return "bg-red-50 text-red-800 border-red-300";
      case "DISMISSED":
        return "bg-slate-100 text-slate-700 border-slate-300";
      default:
        return "bg-slate-100 text-slate-700 border-slate-300";
    }
  };

  const getVerificationBadge = (status?: string) => {
    switch (status) {
      case "VERIFIED_ACCURATE":
        return "bg-emerald-100 text-emerald-900 border-emerald-400 font-bold";
      case "DEVIATED":
        return "bg-amber-100 text-amber-900 border-amber-400 font-bold";
      case "SUPERSEDED":
        return "bg-slate-200 text-slate-800 border-slate-400 font-medium";
      case "INCONCLUSIVE":
        return "bg-slate-100 text-slate-600 border-slate-300";
      case "PENDING":
      default:
        return "bg-amber-50 text-amber-800 border-amber-300 animate-pulse";
    }
  };

  return (
    <div className="flex flex-col h-full rounded-lg border border-slate-300 bg-white p-4 shadow-xs relative">
      {/* Header & Mode Selector */}
      <div className="flex items-start justify-between border-b border-slate-200 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-slate-900" />
            <h3 className="font-mono text-xs font-black uppercase tracking-wider text-slate-900">
              COORDINATED STRATEGY ORCHESTRATION (PHASE 9)
            </h3>
          </div>
          <p className="mt-0.5 text-[11px] text-slate-500 font-mono">
            Multi-Train Joint Optimization • Resilience Scoring • Closed-Loop Audit
          </p>
        </div>

        {/* Tab Controls: Active Synthesized vs. Audit History */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-0.5 rounded-sm border border-slate-300">
          <button
            onClick={() => setSelectedPlanTab("ACTIVE")}
            className={`px-2.5 py-1 text-[10px] font-mono font-bold rounded-xs transition-colors ${
              selectedPlanTab === "ACTIVE"
                ? "bg-white text-slate-900 shadow-xs border border-slate-300"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            AVAILABLE ({activeStrategies.length})
          </button>
          <button
            onClick={() => setSelectedPlanTab("AUDIT")}
            className={`px-2.5 py-1 text-[10px] font-mono font-bold rounded-xs transition-colors ${
              selectedPlanTab === "AUDIT"
                ? "bg-white text-slate-900 shadow-xs border border-slate-300"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            AUDIT HISTORY ({strategyAuditHistory.length})
          </button>
        </div>
      </div>

      {/* Action Notification Toast */}
      {actionFeedback && (
        <div
          className={`mt-2 p-2 rounded-sm border text-[11px] font-mono flex items-center justify-between ${
            actionFeedback.type === "SUCCESS"
              ? "bg-emerald-50 border-emerald-300 text-emerald-900"
              : actionFeedback.type === "WARNING"
              ? "bg-amber-50 border-amber-300 text-amber-900"
              : "bg-slate-100 border-slate-300 text-slate-800"
          }`}
        >
          <span>{actionFeedback.message}</span>
          <button
            onClick={() => setActionFeedback(null)}
            className="text-[10px] font-bold text-slate-500 hover:text-slate-800"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Body */}
      <div className="flex-1 overflow-y-auto mt-3 pr-1 space-y-3">
        {selectedPlanTab === "ACTIVE" ? (
          activeStrategies.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 border border-dashed border-slate-200 rounded-sm text-center p-4">
              <span className="text-xl mb-1">🌿</span>
              <p className="font-mono text-xs font-bold text-slate-700">Corridor Flow Optimal</p>
              <p className="text-[11px] text-slate-500 max-w-xs mt-1">
                No multi-train bottlenecks or junction conflicts require multi-action coordinated intervention.
              </p>
            </div>
          ) : (
            activeStrategies.map((strategy) => {
              const isConfirming = confirmingStrategyId === strategy.strategyId;
              const isStale = strategy.executionStatus === "STALE_REJECTED";

              return (
                <div
                  key={strategy.strategyId}
                  className={`rounded-md border p-3.5 transition-all ${
                    isStale
                      ? "border-red-300 bg-red-50/40"
                      : strategy.planType === "PRIMARY_THROUGHPUT"
                      ? "border-slate-300 bg-slate-50/80 hover:border-slate-400"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  {/* Strategy Header Row */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-1.5 mb-1">
                        <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded-xs bg-slate-900 text-white">
                          {strategy.planType === "PRIMARY_THROUGHPUT" ? "PLAN A: PRIMARY" : "PLAN B: CONTINGENCY"}
                        </span>
                        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded-xs border border-slate-300 bg-white text-slate-700">
                          {strategy.provenance.clusterType}
                        </span>
                        <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded-xs border ${getSafetyBadge(strategy.safetyStatus)}`}>
                          {strategy.safetyStatus === "VERIFIED_SAFE" ? "✓ SAFETY VALIDATED" : strategy.safetyStatus}
                        </span>
                        {isStale && (
                          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded-xs border bg-red-100 text-red-900 border-red-300 font-bold animate-pulse">
                            STALE REVISION
                          </span>
                        )}
                      </div>
                      <h4 className="font-mono text-xs font-black text-slate-900">{strategy.name}</h4>
                      <p className="text-[11px] text-slate-600 mt-0.5">{strategy.summary}</p>
                    </div>

                    {/* Scores Block */}
                    <div className="text-right shrink-0">
                      <div className="font-mono text-[9px] text-slate-500 uppercase">Composite Score</div>
                      <div className="font-mono text-sm font-black text-slate-900">{strategy.objectiveScore.toFixed(1)}</div>
                      {strategy.adaptiveScore !== strategy.objectiveScore && (
                        <div className="font-mono text-[9px] text-emerald-700 font-bold">
                          Adaptive: {strategy.adaptiveScore.toFixed(1)}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Scope & Affected Trains */}
                  <div className="mt-3 pt-2.5 border-t border-slate-200/80">
                    <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 mb-1.5">
                      <span>COORDINATED CONSTITUENT ACTIONS ({strategy.constituentActions.length})</span>
                      <span>{strategy.targetTrainIds.length} Trains Affected</span>
                    </div>

                    <div className="space-y-1.5">
                      {strategy.constituentActions.map((action, idx) => (
                        <div
                          key={action.candidateAction.id}
                          className="flex items-center justify-between p-1.5 rounded-xs bg-white border border-slate-200 text-[11px] font-mono"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-400">#{idx + 1}</span>
                            <button
                              onClick={() => onSelectTrain && onSelectTrain(action.trainId)}
                              className="font-bold text-slate-900 hover:text-sky-700 hover:underline"
                            >
                              {action.trainName} ({action.trainId})
                            </button>
                            <span className="text-slate-500">→</span>
                            <span className="px-1 py-0.2 rounded-xs bg-slate-100 text-slate-700 border border-slate-200">
                              {action.candidateAction.action}
                              {action.candidateAction.targetSpeed !== undefined ? ` (${action.candidateAction.targetSpeed} km/h)` : ""}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-500">{action.targetSectionId}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Projected Operational & Resilience Impact */}
                  <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 p-2 rounded-xs bg-white border border-slate-200 text-center font-mono">
                    <div>
                      <span className="block text-[9px] text-slate-500">NET DELAY SAVED</span>
                      <span className="text-xs font-bold text-emerald-700">
                        {strategy.predictedImpact.projectedNetDelaySavedMinutes > 0
                          ? `-${strategy.predictedImpact.projectedNetDelaySavedMinutes.toFixed(1)}m`
                          : "0.0m"}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[9px] text-slate-500">CORRIDOR TPUT</span>
                      <span className="text-xs font-bold text-sky-700">
                        +{strategy.predictedImpact.projectedCorridorThroughputGainPercent.toFixed(1)}%
                      </span>
                    </div>
                    <div>
                      <span className="block text-[9px] text-slate-500">BOTTLENECK RELIEF</span>
                      <span className="text-xs font-bold text-slate-800">
                        +{strategy.predictedImpact.projectedBottleneckReliefPercent.toFixed(1)}%
                      </span>
                    </div>
                    <div>
                      <span className="block text-[9px] text-slate-500">KINEMATIC STABILITY</span>
                      <span className="text-xs font-bold text-slate-800">
                        {(strategy.resilienceMetrics.kinematicStabilityIndex * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>

                  {/* Phase 8D Policy Learning Note */}
                  <div className="mt-2 text-[10px] text-slate-500 italic flex items-center justify-between">
                    <span>* Historical evidence influences candidate ranking. Absolute-block safety remains authoritative.</span>
                    <span className="font-mono text-slate-400">Rev #{strategy.stateRevisionAtGeneration}</span>
                  </div>

                  {/* Operator Authorization Bar */}
                  <div className="mt-3 pt-2.5 border-t border-slate-200 flex items-center justify-between">
                    {isConfirming ? (
                      <div className="w-full flex items-center justify-between gap-2 p-2 rounded-xs bg-amber-50 border border-amber-300 text-[11px] font-mono">
                        <span className="text-amber-900">
                          Confirm dispatch for <strong>{strategy.targetTrainIds.join(", ")}</strong>?
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => handleDispatch(strategy)}
                            className="px-2.5 py-1 text-[10px] font-bold rounded-xs bg-emerald-700 text-white hover:bg-emerald-800 shadow-xs cursor-pointer"
                          >
                            YES, AUTHORIZE
                          </button>
                          <button
                            onClick={() => setConfirmingStrategyId(null)}
                            className="px-2 py-1 text-[10px] font-bold rounded-xs bg-slate-200 text-slate-800 hover:bg-slate-300 cursor-pointer"
                          >
                            CANCEL
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="text-[11px] font-mono text-slate-600">
                          {isStale ? "Stale revision. Dispatch disabled." : "Ready for operator authorization."}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleDismiss(strategy.strategyId)}
                            className="px-2.5 py-1 text-[11px] font-mono font-bold rounded-xs border border-slate-300 text-slate-700 hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
                          >
                            DISMISS
                          </button>
                          <button
                            disabled={isStale}
                            onClick={() => setConfirmingStrategyId(strategy.strategyId)}
                            className={`px-3 py-1 text-[11px] font-mono font-bold rounded-xs shadow-xs cursor-pointer ${
                              isStale
                                ? "bg-slate-300 text-slate-500 cursor-not-allowed"
                                : "bg-slate-900 text-white hover:bg-slate-800"
                            }`}
                          >
                            REVIEW / APPLY STRATEGY
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )
        ) : (
          /* AUDIT HISTORY TAB (Phase 8C Verification & Phase 8D Learning Outcome) */
          strategyAuditHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 border border-dashed border-slate-200 rounded-sm text-center p-4">
              <span className="text-xl mb-1">📋</span>
              <p className="font-mono text-xs font-bold text-slate-700">No Dispatched Strategies Recorded</p>
              <p className="text-[11px] text-slate-500 max-w-xs mt-1">
                Authorized strategies will record an immutable baseline and undergo closed-loop evaluation at T0 + 30s.
              </p>
            </div>
          ) : (
            strategyAuditHistory.map((audit) => {
              const outcome = audit.actualOutcome;
              const isEvaluated = outcome !== undefined;

              return (
                <div
                  key={audit.id}
                  className="rounded-md border border-slate-300 bg-white p-3.5 transition-all space-y-2.5"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded-xs bg-slate-900 text-white">
                          {audit.planType === "PRIMARY_THROUGHPUT" ? "PRIMARY PLAN" : "CONTINGENCY PLAN"}
                        </span>
                        <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded-xs border ${getVerificationBadge(outcome?.verificationStatus)}`}>
                          {outcome ? outcome.verificationStatus : "PENDING VERIFICATION (T+30s)"}
                        </span>
                        {outcome?.attributionType && (
                          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded-xs border border-slate-200 bg-slate-50 text-slate-600">
                            {outcome.attributionType}
                          </span>
                        )}
                      </div>
                      <h4 className="font-mono text-xs font-bold text-slate-900 mt-1">
                        Strategy ID: {audit.strategyId}
                      </h4>
                      <p className="text-[10px] font-mono text-slate-500">
                        Dispatched: T+{audit.dispatchedSimulationTime.toFixed(1)}s • Window: {audit.evaluationWindowSeconds}s • Trains: {audit.participatingTrainIds.join(", ")}
                      </p>
                    </div>

                    {onOpenAuditDrawer && (
                      <button
                        onClick={onOpenAuditDrawer}
                        className="text-[10px] font-mono font-bold text-sky-700 hover:text-sky-900 underline"
                      >
                        VIEW DECISION AUDIT →
                      </button>
                    )}
                  </div>

                  {/* Pre-State Baseline vs Measured Actual Outcome Comparison */}
                  <div className="grid grid-cols-2 gap-2 p-2 rounded-xs bg-slate-50 border border-slate-200 text-[11px] font-mono">
                    <div className="space-y-1 border-r border-slate-200 pr-2">
                      <span className="font-bold text-slate-700 block text-[10px] uppercase">
                        Baseline (Pre-Execution T0)
                      </span>
                      <div className="text-slate-600 flex justify-between">
                        <span>Corridor Tput:</span>
                        <span className="font-bold">{audit.preState.corridorThroughput.toFixed(2)}</span>
                      </div>
                      <div className="text-slate-600 flex justify-between">
                        <span>Total Delay:</span>
                        <span className="font-bold">{audit.preState.totalActiveDelayMinutes.toFixed(1)}m</span>
                      </div>
                      <div className="text-slate-600 flex justify-between">
                        <span>Conflicts:</span>
                        <span className="font-bold">{audit.preState.activeConflictCount}</span>
                      </div>
                    </div>

                    <div className="space-y-1 pl-1">
                      <span className="font-bold text-slate-700 block text-[10px] uppercase">
                        Measured Outcome {isEvaluated ? `(T+${outcome.measuredSimulationTime.toFixed(0)}s)` : "(Measuring...)"}
                      </span>
                      {isEvaluated ? (
                        <>
                          <div className="flex justify-between">
                            <span className="text-slate-600">Throughput Delta:</span>
                            <span className={`font-bold ${outcome.actualThroughputDelta >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                              {outcome.actualThroughputDelta >= 0 ? `+${outcome.actualThroughputDelta}` : outcome.actualThroughputDelta}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-600">Delay Delta:</span>
                            <span className={`font-bold ${outcome.actualDelayDelta <= 0 ? "text-emerald-700" : "text-amber-700"}`}>
                              {outcome.actualDelayDelta <= 0 ? `${outcome.actualDelayDelta}m` : `+${outcome.actualDelayDelta}m`}
                            </span>
                          </div>
                          {outcome.varianceNotes && (
                            <p className="text-[10px] text-slate-500 italic mt-0.5 truncate">{outcome.varianceNotes}</p>
                          )}
                        </>
                      ) : (
                        <div className="text-[11px] text-amber-800 italic pt-1">
                          Awaiting 30s evaluation window elapsed time...
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )
        )}
      </div>
    </div>
  );
};
