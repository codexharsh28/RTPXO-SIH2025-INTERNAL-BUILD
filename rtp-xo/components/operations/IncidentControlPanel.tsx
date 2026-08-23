"use client";

import React, { useState } from "react";
import { SimulationSnapshot } from "@/types/simulation";
import {
  ActiveIncident,
  DisruptionRecoveryPlan,
  DisruptionRecoveryAuditRecord,
  ActiveRecoveryExecutionState,
  IncidentType,
  IncidentSeverity,
  RecoveryPhaseExecutionStatus,
  RecoveryPhaseTriggerCondition,
} from "@/types/incident";
import { simulationEngine } from "@/engine/simulationEngine";

interface IncidentControlPanelProps {
  snapshot: SimulationSnapshot;
  onSelectTrain?: (trainId: string) => void;
  onSelectSection?: (sectionId: string) => void;
}

export const IncidentControlPanel: React.FC<IncidentControlPanelProps> = ({
  snapshot,
  onSelectTrain,
  onSelectSection,
}) => {
  const {
    activeIncidents = [],
    recoveryPlans = [],
    activeRecoveryExecutions = [],
    recoveryAuditHistory = [],
    sections = [],
    signals = [],
    simulationTime,
  } = snapshot;

  const [activeTab, setActiveTab] = useState<"ACTIVE_INCIDENTS" | "RECOVERY_PLANS" | "DECLARE_INCIDENT" | "AUDIT_HISTORY">("ACTIVE_INCIDENTS");
  const [confirmingPlanId, setConfirmingPlanId] = useState<string | null>(null);
  const [clearingIncidentId, setClearingIncidentId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ message: string; type: "SUCCESS" | "WARNING" | "INFO" } | null>(null);

  // Form State for Declaring Incident
  const [declaringType, setDeclaringType] = useState<IncidentType>("TEMPORARY_SPEED_RESTRICTION");
  const [declaringSeverity, setDeclaringSeverity] = useState<IncidentSeverity>("SEVERE");
  const [declaringSectionId, setDeclaringSectionId] = useState<string>(sections[0]?.id || "ND-GZB-01");
  const [declaringSignalId, setDeclaringSignalId] = useState<string>("");
  const [declaringSpeedLimit, setDeclaringSpeedLimit] = useState<number>(45);
  const [declaringReason, setDeclaringReason] = useState<string>("Emergency track maintenance TSR");

  const showFeedback = (message: string, type: "SUCCESS" | "WARNING" | "INFO" = "SUCCESS") => {
    setFeedback({ message, type });
    setTimeout(() => setFeedback(null), 4000);
  };

  const handleDeclareIncident = (e: React.FormEvent) => {
    e.preventDefault();

    const newIncident: ActiveIncident = {
      id: `INC-${declaringType.substring(0, 3)}-${Date.now().toString().slice(-4)}`,
      type: declaringType,
      severity: declaringSeverity,
      status: "ACTIVE_MITIGATING",
      affectedSectionId: declaringSectionId,
      affectedSignalId: declaringType === "SIGNAL_ASPECT_FAILURE" && declaringSignalId ? declaringSignalId : undefined,
      imposedSpeedLimitKmH: declaringType === "TEMPORARY_SPEED_RESTRICTION" ? declaringSpeedLimit : undefined,
      isCompleteBlockage: declaringType === "TRACK_SECTION_BLOCKAGE",
      startTimeSimulationSeconds: simulationTime,
      expectedDurationSeconds: 180,
      reason: declaringReason || "Operator declared incident",
    };

    const success = simulationEngine.declareIncident(newIncident);
    if (success) {
      showFeedback(`Declared ${newIncident.severity} ${newIncident.type} on ${newIncident.affectedSectionId}`, "SUCCESS");
      setActiveTab("ACTIVE_INCIDENTS");
    } else {
      showFeedback("Failed to declare incident. Please check section parameters.", "WARNING");
    }
  };

  const handleClearIncident = (incidentId: string) => {
    const success = simulationEngine.clearIncident(incidentId);
    setClearingIncidentId(null);
    if (success) {
      showFeedback(`Authoritatively cleared incident ${incidentId}`, "SUCCESS");
    } else {
      showFeedback(`Failed to clear incident ${incidentId}`, "WARNING");
    }
  };

  const handleAuthorizeRecoveryPlan = (plan: DisruptionRecoveryPlan) => {
    const success = simulationEngine.authorizeRecoveryPlan(plan.recoveryPlanId);
    setConfirmingPlanId(null);
    if (success) {
      showFeedback(`Explicitly authorized staged recovery plan: ${plan.name}`, "SUCCESS");
    } else {
      showFeedback("Recovery plan authorization rejected: Re-validation failed.", "WARNING");
    }
  };

  const handleDismissRecoveryPlan = (planId: string) => {
    const success = simulationEngine.dismissRecoveryPlan(planId);
    setConfirmingPlanId(null);
    if (success) {
      showFeedback(`Dismissed recovery plan ${planId}`, "INFO");
    }
  };

  const getSeverityBadge = (severity: IncidentSeverity) => {
    switch (severity) {
      case "CRITICAL":
        return "bg-red-950 text-red-200 border-red-500 font-black animate-pulse";
      case "SEVERE":
        return "bg-orange-950 text-orange-200 border-orange-500 font-bold";
      case "MODERATE":
        return "bg-amber-950 text-amber-300 border-amber-500 font-semibold";
      case "MINOR":
      default:
        return "bg-slate-800 text-slate-300 border-slate-700 font-medium";
    }
  };

  const getLifecycleBadge = (status: string) => {
    switch (status) {
      case "ACTIVE_UNACKNOWLEDGED":
        return "bg-red-950 text-red-200 border-red-500 animate-pulse font-bold";
      case "ACTIVE_MITIGATING":
        return "bg-amber-950 text-amber-200 border-amber-500 font-bold";
      case "CLEARED_RECOVERING":
        return "bg-cyan-950 text-cyan-200 border-cyan-500 font-semibold";
      case "RESOLVED_CLOSED":
        return "bg-slate-800 text-slate-400 border-slate-700";
      default:
        return "bg-slate-800 text-slate-300 border-slate-700";
    }
  };

  const getPhaseTriggerBadge = (trigger: RecoveryPhaseTriggerCondition) => {
    switch (trigger) {
      case "IMMEDIATE":
        return "bg-amber-950/80 text-amber-300 border-amber-500/60";
      case "ON_INCIDENT_CLEARANCE":
        return "bg-cyan-950/80 text-cyan-300 border-cyan-500/60";
      case "HEADWAY_STABILIZED":
        return "bg-emerald-950/80 text-emerald-300 border-emerald-500/60";
      default:
        return "bg-slate-800 text-slate-400 border-slate-700";
    }
  };

  const getAdaptiveOutcome = (record: DisruptionRecoveryAuditRecord): "POSITIVE" | "NEGATIVE" | "NEUTRAL" => {
    if (record.verificationStatus === "VERIFIED_ACCURATE") return "POSITIVE";
    if (record.verificationStatus === "DEVIATED") return "NEGATIVE";
    return "NEUTRAL";
  };

  return (
    <div className="flex flex-col h-full rounded-sm border border-slate-800/90 bg-slate-900/95 p-3 shadow-md font-mono text-xs text-slate-100 overflow-hidden select-none">
      {/* 1. Master Header & Navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between border-b border-slate-800/80 pb-2.5 gap-2 flex-shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <span className={`flex h-2.5 w-2.5 rounded-full ${activeIncidents.length > 0 ? "bg-red-500 animate-ping" : "bg-emerald-500"}`} />
            <h2 className="font-mono text-xs font-black uppercase tracking-wider text-slate-100">
              PHASE 10 RECOVERY CONSOLE
            </h2>
            <span className="rounded-2xs bg-slate-950 border border-slate-800 px-1.5 py-0.2 text-[9px] text-cyan-400 font-bold">
              CLOSED-LOOP DISRUPTION MANAGEMENT
            </span>
          </div>
          <p className="mt-0.5 text-[10px] text-slate-400">
            Authoritative Disruption Injection • Staged Multi-Phase Containment • Explicit Operator Authorization Mandatory
          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-sm border border-slate-800 text-[10px]">
          <button
            type="button"
            onClick={() => setActiveTab("ACTIVE_INCIDENTS")}
            className={`px-2 py-1 font-bold rounded-2xs transition ${
              activeTab === "ACTIVE_INCIDENTS"
                ? "bg-red-950 text-red-200 border border-red-500/60 shadow-xs"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            ACTIVE INCIDENTS ({activeIncidents.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("RECOVERY_PLANS")}
            className={`px-2 py-1 font-bold rounded-2xs transition ${
              activeTab === "RECOVERY_PLANS"
                ? "bg-cyan-950 text-cyan-200 border border-cyan-500/60 shadow-xs"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            RECOVERY PLANS ({recoveryPlans.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("AUDIT_HISTORY")}
            className={`px-2 py-1 font-bold rounded-2xs transition ${
              activeTab === "AUDIT_HISTORY"
                ? "bg-purple-950 text-purple-200 border border-purple-500/60 shadow-xs"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            AUDIT HISTORY ({recoveryAuditHistory.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("DECLARE_INCIDENT")}
            className={`px-2 py-1 font-bold rounded-2xs transition ${
              activeTab === "DECLARE_INCIDENT"
                ? "bg-slate-800 text-slate-100 border border-slate-600 shadow-xs"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            + DECLARE INCIDENT
          </button>
        </div>
      </div>

      {/* Action Feedback Banner */}
      {feedback && (
        <div
          className={`my-2 rounded-sm border px-3 py-1.5 text-xs font-mono font-medium flex items-center justify-between animate-fade-in flex-shrink-0 ${
            feedback.type === "SUCCESS"
              ? "bg-emerald-950/80 text-emerald-300 border-emerald-500/60"
              : feedback.type === "WARNING"
              ? "bg-amber-950/80 text-amber-300 border-amber-500/60"
              : "bg-cyan-950/80 text-cyan-300 border-cyan-500/60"
          }`}
        >
          <span>✓ {feedback.message}</span>
          <button type="button" onClick={() => setFeedback(null)} className="text-slate-400 hover:text-slate-100 ml-2">
            ✕
          </button>
        </div>
      )}

      {/* Main Content Body */}
      <div className="mt-2 flex-1 overflow-y-auto min-h-0 space-y-3 pr-1">
        {/* ======================================================== */}
        {/* TAB 1: ACTIVE INCIDENTS VIEW                             */}
        {/* ======================================================== */}
        {activeTab === "ACTIVE_INCIDENTS" && (
          <div className="space-y-3">
            {activeIncidents.length === 0 ? (
              <div className="rounded-sm border border-dashed border-slate-800 p-8 text-center bg-slate-950/50">
                <span className="text-2xl block mb-1">🟢</span>
                <p className="font-mono text-xs font-bold text-slate-200">
                  RECOVERY: 0 ACTIVE INCIDENTS
                </p>
                <p className="font-mono text-[11px] text-slate-400 mt-1 max-w-md mx-auto">
                  All corridor sections and signals operating nominally under SIL-4 certified absolute block interlocking.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab("DECLARE_INCIDENT")}
                  className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-2xs bg-cyan-700 hover:bg-cyan-600 text-slate-950 font-mono text-xs font-bold transition shadow-xs"
                >
                  <span>+</span>
                  <span>Inject Test Disruption Incident</span>
                </button>
              </div>
            ) : (
              activeIncidents.map((incident) => {
                const isClearing = clearingIncidentId === incident.id;
                const section = sections.find((s) => s.id === incident.affectedSectionId);
                const linkedPlan = recoveryPlans.find((p) => p.associatedIncidentId === incident.id);
                const execState = activeRecoveryExecutions.find((e) => e.incidentId === incident.id);

                return (
                  <div
                    key={incident.id}
                    className="rounded-sm border border-red-900/60 bg-slate-950/80 p-3 hover:border-red-700/80 transition"
                  >
                    {/* 1. Incident Card Header */}
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-2xs text-[9px] border ${getSeverityBadge(incident.severity)}`}>
                          {incident.severity}
                        </span>
                        <span className="text-xs font-bold text-slate-100">
                          {incident.id}
                        </span>
                        <span className="text-slate-500">•</span>
                        <span className="text-xs font-semibold text-cyan-300">
                          {incident.type.replace(/_/g, " ")}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-2xs text-[9px] border ${getLifecycleBadge(incident.status)}`}>
                          {incident.status.replace(/_/g, " ")}
                        </span>
                      </div>
                    </div>

                    {/* 2. Incident Telemetry Grid */}
                    <div className="mt-2.5 grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px]">
                      <div className="rounded-2xs bg-slate-900 p-2 border border-slate-800">
                        <span className="text-slate-400 block text-[9px] uppercase">AFFECTED SECTION</span>
                        <button
                          type="button"
                          onClick={() => onSelectSection?.(incident.affectedSectionId)}
                          className="font-bold text-cyan-400 hover:underline text-left truncate block w-full mt-0.5"
                        >
                          {section ? section.name : incident.affectedSectionId} ({incident.affectedSectionId})
                        </button>
                      </div>

                      {incident.imposedSpeedLimitKmH !== undefined && (
                        <div className="rounded-2xs bg-slate-900 p-2 border border-slate-800">
                          <span className="text-slate-400 block text-[9px] uppercase">IMPOSED TSR LIMIT</span>
                          <span className="font-bold text-amber-400 text-xs mt-0.5 block">
                            {incident.imposedSpeedLimitKmH} km/h
                          </span>
                        </div>
                      )}

                      {incident.affectedSignalId && (
                        <div className="rounded-2xs bg-slate-900 p-2 border border-slate-800">
                          <span className="text-slate-400 block text-[9px] uppercase">DEGRADED SIGNAL</span>
                          <span className="font-bold text-red-400 text-xs mt-0.5 block">
                            {incident.affectedSignalId}
                          </span>
                        </div>
                      )}

                      <div className="rounded-2xs bg-slate-900 p-2 border border-slate-800">
                        <span className="text-slate-400 block text-[9px] uppercase">INCIDENT START TIME</span>
                        <span className="font-bold text-slate-200 text-xs mt-0.5 block">
                          T+{incident.startTimeSimulationSeconds.toFixed(0)}s
                        </span>
                      </div>
                    </div>

                    <div className="mt-2 text-[10px] text-slate-300 bg-slate-900/60 p-2 rounded-2xs border border-slate-800">
                      <strong className="text-slate-200">Operational Reason: </strong>
                      <span>{incident.reason}</span>
                    </div>

                    {/* Linked Plan Quick Summary if synthesized */}
                    {linkedPlan && (
                      <div className="mt-2.5 rounded-2xs border border-cyan-900/60 bg-cyan-950/20 p-2.5 text-[10px]">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-cyan-300">📋 {linkedPlan.name}</span>
                            <span className="text-[9px] text-slate-400">({linkedPlan.recoveryPlanId})</span>
                          </div>
                          <span className="text-slate-300 font-bold">
                            Auth State: <strong className="text-cyan-400">{linkedPlan.executionStatus}</strong>
                          </span>
                        </div>
                        <div className="mt-1 flex items-center gap-4 text-slate-300 text-[9px]">
                          <span>Projected Recovery: <strong className="text-slate-100">{linkedPlan.projectedRecoveryTimeSeconds}s</strong></span>
                          <span>•</span>
                          <span>Residual Delay: <strong className="text-amber-400">{linkedPlan.projectedResidualDelayMinutes} min</strong></span>
                          <span>•</span>
                          <span>Phases: <strong className="text-cyan-300">{linkedPlan.stagingPhases.length} Staged</strong></span>
                        </div>
                      </div>
                    )}

                    {/* Incident Clearance & Navigation Footer */}
                    <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-800">
                      <button
                        type="button"
                        onClick={() => setActiveTab("RECOVERY_PLANS")}
                        className="text-cyan-400 hover:text-cyan-300 text-[10px] font-bold"
                      >
                        VIEW RECOVERY PLAN & PROGRESS →
                      </button>

                      {isClearing ? (
                        <div className="flex items-center gap-2 bg-red-950/80 p-1.5 rounded-2xs border border-red-500">
                          <span className="text-xs text-red-200 font-bold">Authoritatively clear incident?</span>
                          <button
                            type="button"
                            onClick={() => handleClearIncident(incident.id)}
                            className="px-2.5 py-1 bg-red-600 hover:bg-red-500 text-white font-mono text-[10px] font-black rounded-2xs transition"
                          >
                            CONFIRM CLEARANCE
                          </button>
                          <button
                            type="button"
                            onClick={() => setClearingIncidentId(null)}
                            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] rounded-2xs"
                          >
                            CANCEL
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setClearingIncidentId(incident.id)}
                          className="px-3 py-1 bg-slate-900 hover:bg-red-950/60 text-slate-300 hover:text-red-300 border border-slate-700 hover:border-red-500 font-mono text-[10px] font-bold rounded-2xs transition"
                        >
                          CLEAR INCIDENT
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 2: STAGED RECOVERY PLANS & PHASE PROGRESS            */}
        {/* ======================================================== */}
        {activeTab === "RECOVERY_PLANS" && (
          <div className="space-y-4">
            {recoveryPlans.length === 0 ? (
              <div className="rounded-sm border border-dashed border-slate-800 p-8 text-center bg-slate-950/50">
                <span className="text-2xl block mb-1">📋</span>
                <p className="font-mono text-xs font-bold text-slate-200">
                  NO STAGED RECOVERY PLANS GENERATED
                </p>
                <p className="font-mono text-[11px] text-slate-400 mt-1 max-w-md mx-auto">
                  Recovery plans synthesize automatically when active incidents and safe multi-train mitigation paths emerge.
                </p>
              </div>
            ) : (
              recoveryPlans.map((plan) => {
                const isConfirming = confirmingPlanId === plan.recoveryPlanId;
                const execState = activeRecoveryExecutions.find((e) => e.recoveryPlanId === plan.recoveryPlanId);
                const auditRecord = recoveryAuditHistory.find((r) => r.recoveryPlanId === plan.recoveryPlanId);

                return (
                  <div
                    key={plan.recoveryPlanId}
                    className="rounded-sm border border-slate-800 bg-slate-950/80 p-3.5 shadow-xs hover:border-slate-700 transition"
                  >
                    {/* Plan Header */}
                    <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-800 pb-2.5">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-slate-100">
                            {plan.name}
                          </span>
                          <span className="px-1.5 py-0.2 rounded-2xs text-[9px] border bg-emerald-950 text-emerald-300 border-emerald-500 font-bold">
                            {plan.safetyStatus}
                          </span>
                          <span className="px-1.5 py-0.2 rounded-2xs text-[9px] border bg-cyan-950 text-cyan-300 border-cyan-500 font-bold">
                            {plan.executionStatus}
                          </span>
                        </div>
                        <p className="mt-1 text-[10px] text-slate-300 leading-relaxed">
                          {plan.summary}
                        </p>
                      </div>

                      {/* Top Projected Metrics */}
                      <div className="flex items-center gap-2 font-mono text-[10px]">
                        <div className="rounded-2xs bg-slate-900 px-2 py-1 text-center border border-slate-800">
                          <span className="text-[8px] text-slate-400 uppercase block">Projected Recovery</span>
                          <strong className="text-slate-100 text-xs">{plan.projectedRecoveryTimeSeconds}s</strong>
                        </div>
                        <div className="rounded-2xs bg-slate-900 px-2 py-1 text-center border border-slate-800">
                          <span className="text-[8px] text-slate-400 uppercase block">Projected Residual Delay</span>
                          <strong className="text-amber-400 text-xs">{plan.projectedResidualDelayMinutes} min</strong>
                        </div>
                      </div>
                    </div>

                    {/* PHASE PROGRESS TRACKER */}
                    <div className="mt-3 space-y-2.5">
                      <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center justify-between">
                        <span>PHASE PROGRESS TRACKER ({plan.stagingPhases.length} PHASES)</span>
                        {execState && (
                          <span className="text-cyan-400 font-mono">
                            Current Active Phase: Phase {execState.currentPhaseNumber} of {execState.totalPhases}
                          </span>
                        )}
                      </div>

                      {plan.stagingPhases.map((phase) => {
                        const phaseStatus: RecoveryPhaseExecutionStatus = execState
                          ? execState.phaseStatuses[phase.phaseNumber] || "PENDING"
                          : plan.executionStatus === "AUTHORIZED" || plan.executionStatus === "EXECUTED"
                          ? "COMPLETED"
                          : "PENDING";

                        const isCompleted = phaseStatus === "COMPLETED";
                        const isActive = phaseStatus === "ACTIVE";
                        const isPending = phaseStatus === "PENDING";
                        const isBlocked = phaseStatus === "BLOCKED" || phaseStatus === "SUPERSEDED" || phaseStatus === "FAILED";

                        return (
                          <div
                            key={phase.phaseNumber}
                            className={`rounded-2xs border p-2.5 transition ${
                              isActive
                                ? "border-cyan-500/80 bg-cyan-950/30"
                                : isCompleted
                                ? "border-emerald-900/60 bg-emerald-950/20"
                                : isBlocked
                                ? "border-red-900/60 bg-red-950/20"
                                : "border-slate-800 bg-slate-900/40"
                            }`}
                          >
                            <div className="flex items-center justify-between border-b border-slate-800/80 pb-1.5">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold ${
                                    isCompleted
                                      ? "bg-emerald-500 text-slate-950"
                                      : isActive
                                      ? "bg-cyan-400 text-slate-950 animate-pulse"
                                      : "bg-slate-800 text-slate-400"
                                  }`}
                                >
                                  {isCompleted ? "●" : isActive ? "●" : "○"}
                                </span>
                                <span className="font-bold text-slate-100 text-xs">
                                  PHASE {phase.phaseNumber} — {phase.phaseName}
                                </span>
                                <span
                                  className={`px-1.5 py-0.2 rounded-2xs text-[8px] font-bold ${
                                    isCompleted
                                      ? "bg-emerald-950 text-emerald-300 border border-emerald-500/50"
                                      : isActive
                                      ? "bg-cyan-950 text-cyan-300 border border-cyan-500/50 animate-pulse"
                                      : isBlocked
                                      ? "bg-red-950 text-red-300 border border-red-500/50"
                                      : "bg-slate-800 text-slate-400 border border-slate-700"
                                  }`}
                                >
                                  {phaseStatus}
                                </span>
                              </div>

                              <div className="flex items-center gap-2 text-[9px]">
                                <span className={`px-1.5 py-0.2 rounded-2xs border ${getPhaseTriggerBadge(phase.triggerCondition)}`}>
                                  TRIGGER: {phase.triggerCondition}
                                </span>
                                <span className="text-slate-400">
                                  Actions: <strong className="text-slate-200">{phase.actions.length}</strong>
                                </span>
                              </div>
                            </div>

                            {/* Phase Constituent Actions List */}
                            <div className="mt-2 space-y-1">
                              {phase.actions.map((act, actIdx) => (
                                <div
                                  key={actIdx}
                                  className="flex flex-wrap items-center justify-between gap-1 rounded-2xs bg-slate-950/80 px-2 py-1 text-[9px] border border-slate-800/80"
                                >
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => onSelectTrain?.(act.trainId)}
                                      className="font-bold text-cyan-400 hover:underline"
                                    >
                                      {act.trainId}
                                    </button>
                                    <span className="text-slate-500">•</span>
                                    <span className="text-slate-300 font-semibold">{act.role}</span>
                                    <span className="text-slate-400">({act.targetSectionId})</span>
                                  </div>

                                  <div className="text-slate-400 text-[9px] truncate max-w-xs">
                                    {act.rationalSummary}
                                  </div>

                                  <div className="flex items-center gap-1 text-[8px]">
                                    <span className="text-emerald-400 font-bold">
                                      Score: {act.individualBaseScore.toFixed(0)}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Superseded Warning Banner if triggered */}
                    {execState?.isSuperseded && (
                      <div className="mt-2.5 rounded-2xs bg-red-950/50 border border-red-500/60 p-2 text-[9px] text-red-200">
                        <strong className="font-bold">⚠️ SUPERSEDED: </strong>
                        <span>{execState.supersededReason || "Intervening manual operator intervention superseded subsequent recovery phases."}</span>
                      </div>
                    )}

                    {/* Authorization / Action Footer */}
                    <div className="mt-3 flex items-center justify-between pt-2.5 border-t border-slate-800">
                      <div className="text-[9px] text-slate-400">
                        Incident: <strong className="text-slate-200">{plan.associatedIncidentId}</strong> • Safety: <strong className="text-emerald-400">VERIFIED SAFE</strong>
                      </div>

                      {isConfirming ? (
                        <div className="flex items-center gap-2 bg-amber-950/80 p-1.5 rounded-2xs border border-amber-500">
                          <span className="text-xs text-amber-200 font-bold">Authorize staged recovery plan?</span>
                          <button
                            type="button"
                            onClick={() => handleAuthorizeRecoveryPlan(plan)}
                            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-mono text-xs font-black rounded-2xs transition"
                          >
                            CONFIRM AUTHORIZATION
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmingPlanId(null)}
                            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-2xs"
                          >
                            CANCEL
                          </button>
                        </div>
                      ) : plan.executionStatus === "PROPOSED" ? (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleDismissRecoveryPlan(plan.recoveryPlanId)}
                            className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-xs rounded-2xs border border-slate-700 transition"
                          >
                            DISMISS
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmingPlanId(plan.recoveryPlanId)}
                            className="px-3.5 py-1 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-mono text-xs font-black rounded-2xs shadow-xs transition uppercase tracking-wider"
                          >
                            AUTHORIZE RECOVERY PLAN
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-emerald-400 font-bold flex items-center gap-1">
                          ✓ AUTHORIZED & EXECUTING
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 3: AUDIT HISTORY & RECOVERY COMPLETION VERIFICATION  */}
        {/* ======================================================== */}
        {activeTab === "AUDIT_HISTORY" && (
          <div className="space-y-4">
            {recoveryAuditHistory.length === 0 ? (
              <div className="rounded-sm border border-dashed border-slate-800 p-8 text-center bg-slate-950/50">
                <span className="text-2xl block mb-1">🛡️</span>
                <p className="font-mono text-xs font-bold text-slate-200">
                  NO COMPLETED RECOVERY AUDIT RECORDS YET
                </p>
                <p className="font-mono text-[11px] text-slate-400 mt-1 max-w-md mx-auto">
                  Completed disruption recoveries are automatically benchmarked, verified against projected delay bounds, and attributed to adaptive learning history.
                </p>
              </div>
            ) : (
              recoveryAuditHistory.map((record) => {
                const outcome = getAdaptiveOutcome(record);

                return (
                  <div
                    key={record.id}
                    className="rounded-sm border border-purple-900/60 bg-slate-950/80 p-3.5 space-y-3"
                  >
                    {/* Completion Banner */}
                    <div className="flex items-center justify-between border-b border-purple-900/60 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-2xs bg-emerald-950 text-emerald-300 border border-emerald-500 font-black text-xs">
                          RECOVERY COMPLETE
                        </span>
                        <span className="font-bold text-slate-100 text-xs">
                          {record.recoveryPlanId}
                        </span>
                        <span className="text-slate-400 text-[10px]">
                          ({record.incidentType.replace(/_/g, " ")})
                        </span>
                      </div>

                      <div className="text-[10px] text-slate-400">
                        Dispatched: T+{record.dispatchedSimulationTime.toFixed(0)}s
                        {record.recoveryCompletedSimulationTime && (
                          <span> • Cleared: T+{record.recoveryCompletedSimulationTime.toFixed(0)}s</span>
                        )}
                      </div>
                    </div>

                    {/* Side-by-Side Projected vs Actual Metric Comparison */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px]">
                      <div className="rounded-2xs bg-slate-900 p-2 border border-slate-800 text-center">
                        <span className="text-slate-400 block text-[8px] uppercase">PROJECTED RECOVERY</span>
                        <strong className="text-slate-200 text-xs">{record.projectedRecoveryTimeSeconds}s</strong>
                      </div>
                      <div className="rounded-2xs bg-slate-900 p-2 border border-slate-800 text-center">
                        <span className="text-slate-400 block text-[8px] uppercase">ACTUAL RECOVERY</span>
                        <strong className="text-cyan-300 text-xs">
                          {record.actualRecoveryTimeSeconds ? `${record.actualRecoveryTimeSeconds}s` : "In Progress"}
                        </strong>
                      </div>
                      <div className="rounded-2xs bg-slate-900 p-2 border border-slate-800 text-center">
                        <span className="text-slate-400 block text-[8px] uppercase">PROJECTED RESIDUAL DELAY</span>
                        <strong className="text-slate-200 text-xs">{record.projectedResidualDelayMinutes} min</strong>
                      </div>
                      <div className="rounded-2xs bg-slate-900 p-2 border border-slate-800 text-center">
                        <span className="text-slate-400 block text-[8px] uppercase">ACTUAL RESIDUAL DELAY</span>
                        <strong className="text-emerald-400 text-xs">
                          {record.actualResidualDelayMinutes !== undefined ? `${record.actualResidualDelayMinutes} min` : "Calculating"}
                        </strong>
                      </div>
                    </div>

                    {/* Verification, Attribution, Adaptive Outcome Breakdown */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-[10px] pt-1">
                      {/* Verification Classification */}
                      <div className="rounded-2xs bg-slate-900/90 p-2 border border-slate-800">
                        <span className="text-slate-400 block text-[9px] uppercase font-bold">Verification:</span>
                        <span
                          className={`mt-1 inline-block font-black text-[10px] px-1.5 py-0.5 rounded-2xs border ${
                            record.verificationStatus === "VERIFIED_ACCURATE"
                              ? "bg-emerald-950 text-emerald-300 border-emerald-500"
                              : record.verificationStatus === "DEVIATED"
                              ? "bg-red-950 text-red-300 border-red-500"
                              : "bg-amber-950 text-amber-300 border-amber-500"
                          }`}
                        >
                          {record.verificationStatus}
                        </span>
                      </div>

                      {/* Causal Attribution */}
                      <div className="rounded-2xs bg-slate-900/90 p-2 border border-slate-800">
                        <span className="text-slate-400 block text-[9px] uppercase font-bold">Attribution:</span>
                        <span className="mt-1 inline-block font-black text-[10px] px-1.5 py-0.5 rounded-2xs border bg-purple-950 text-purple-300 border-purple-500">
                          {record.attributionType}
                        </span>
                      </div>

                      {/* Adaptive Outcome */}
                      <div className="rounded-2xs bg-slate-900/90 p-2 border border-slate-800">
                        <span className="text-slate-400 block text-[9px] uppercase font-bold">Adaptive Outcome:</span>
                        <span
                          className={`mt-1 inline-block font-black text-[10px] px-1.5 py-0.5 rounded-2xs border ${
                            outcome === "POSITIVE"
                              ? "bg-emerald-950 text-emerald-300 border-emerald-500"
                              : outcome === "NEGATIVE"
                              ? "bg-red-950 text-red-300 border-red-500"
                              : "bg-slate-800 text-slate-300 border-slate-600"
                          }`}
                        >
                          {outcome}
                        </span>
                      </div>
                    </div>

                    {/* Phase Execution Results Summary */}
                    {record.phaseExecutionResults && record.phaseExecutionResults.length > 0 && (
                      <div className="border-t border-slate-800 pt-2 space-y-1 text-[9px]">
                        <span className="text-slate-400 font-bold uppercase block">Phase Execution Summary:</span>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-1">
                          {record.phaseExecutionResults.map((pr) => (
                            <div key={pr.phaseNumber} className="bg-slate-900 p-1.5 rounded-2xs border border-slate-800">
                              <span className="font-bold text-slate-200">Phase {pr.phaseNumber}: </span>
                              <span className="text-cyan-300">{pr.status}</span>
                              <span className="text-slate-400 block text-[8px]">({pr.actionsCount} actions)</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 4: DECLARE INCIDENT FORM (TEST INJECTION)            */}
        {/* ======================================================== */}
        {activeTab === "DECLARE_INCIDENT" && (
          <form onSubmit={handleDeclareIncident} className="space-y-3 rounded-sm border border-slate-800 bg-slate-950/60 p-3.5">
            <div className="text-xs font-bold text-slate-100 border-b border-slate-800 pb-2 flex items-center justify-between">
              <span>AUTHORITATIVE INCIDENT INJECTION PARAMETERS</span>
              <span className="text-slate-400 text-[10px]">Testing & Live Disruption Scenario Setup</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              {/* Incident Type */}
              <div>
                <label className="block text-slate-400 font-bold mb-1 text-[10px]">INCIDENT DISRUPTION TYPE</label>
                <select
                  value={declaringType}
                  onChange={(e) => setDeclaringType(e.target.value as IncidentType)}
                  className="w-full rounded-2xs border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-100 focus:border-cyan-500 focus:outline-hidden"
                >
                  <option value="TEMPORARY_SPEED_RESTRICTION">Temporary Speed Restriction (TSR)</option>
                  <option value="TRACK_SECTION_BLOCKAGE">Track Section Blockage (Complete Obstruction)</option>
                  <option value="SIGNAL_ASPECT_FAILURE">Signal Aspect Failure (Degraded Red Lamp)</option>
                  <option value="STATION_PLATFORM_POSSESSION">Station Platform Possession</option>
                  <option value="CATENARY_POWER_DEGRADATION">Catenary Power Degradation</option>
                </select>
              </div>

              {/* Severity */}
              <div>
                <label className="block text-slate-400 font-bold mb-1 text-[10px]">SEVERITY LEVEL</label>
                <select
                  value={declaringSeverity}
                  onChange={(e) => setDeclaringSeverity(e.target.value as IncidentSeverity)}
                  className="w-full rounded-2xs border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-100 focus:border-cyan-500 focus:outline-hidden"
                >
                  <option value="CRITICAL">CRITICAL (Immediate safety halt required)</option>
                  <option value="SEVERE">SEVERE (Significant capacity reduction)</option>
                  <option value="MODERATE">MODERATE (Moderate headway disruption)</option>
                  <option value="MINOR">MINOR (Informational / minor caution)</option>
                </select>
              </div>

              {/* Affected Section */}
              <div>
                <label className="block text-slate-400 font-bold mb-1 text-[10px]">AFFECTED RAILWAY SECTION</label>
                <select
                  value={declaringSectionId}
                  onChange={(e) => setDeclaringSectionId(e.target.value)}
                  className="w-full rounded-2xs border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-100 focus:border-cyan-500 focus:outline-hidden"
                >
                  {sections.map((sec) => (
                    <option key={sec.id} value={sec.id}>
                      {sec.name} ({sec.id}) - Max {sec.maximumSpeed} km/h
                    </option>
                  ))}
                </select>
              </div>

              {/* Conditional: Imposed Speed Limit (TSR) */}
              {declaringType === "TEMPORARY_SPEED_RESTRICTION" && (
                <div>
                  <label className="block text-slate-400 font-bold mb-1 text-[10px]">IMPOSED SPEED LIMIT (KM/H)</label>
                  <input
                    type="number"
                    min="10"
                    max="100"
                    step="5"
                    value={declaringSpeedLimit}
                    onChange={(e) => setDeclaringSpeedLimit(Number(e.target.value))}
                    className="w-full rounded-2xs border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-100 focus:border-cyan-500 focus:outline-hidden"
                  />
                </div>
              )}

              {/* Conditional: Signal Aspect Failure */}
              {declaringType === "SIGNAL_ASPECT_FAILURE" && (
                <div>
                  <label className="block text-slate-400 font-bold mb-1 text-[10px]">AFFECTED SIGNAL ID</label>
                  <select
                    value={declaringSignalId}
                    onChange={(e) => setDeclaringSignalId(e.target.value)}
                    className="w-full rounded-2xs border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-100 focus:border-cyan-500 focus:outline-hidden"
                  >
                    <option value="">-- Select Signal --</option>
                    {signals.map((sig) => (
                      <option key={sig.id} value={sig.id}>
                        {sig.id} on Section {sig.sectionId}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Reason / Operator Notes */}
              <div className="md:col-span-2">
                <label className="block text-slate-400 font-bold mb-1 text-[10px]">OPERATIONAL REASON / NOTES</label>
                <input
                  type="text"
                  value={declaringReason}
                  onChange={(e) => setDeclaringReason(e.target.value)}
                  placeholder="e.g. Broken rail fastener / track defect reported"
                  className="w-full rounded-2xs border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-100 focus:border-cyan-500 focus:outline-hidden"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2.5 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setActiveTab("ACTIVE_INCIDENTS")}
                className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-2xs transition"
              >
                CANCEL
              </button>
              <button
                type="submit"
                className="px-4 py-1 bg-red-600 hover:bg-red-500 text-white font-black text-xs rounded-2xs shadow-xs transition"
              >
                DECLARE & INJECT INCIDENT
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Mandatory Safety Architecture Footer */}
      <div className="mt-2 border-t border-slate-800/80 pt-1.5 text-[9px] text-slate-400 flex items-center justify-between flex-shrink-0">
        <span className="text-slate-300 font-bold">🔒 OPERATOR AUTHORIZATION REQUIRED FOR ALL RECOVERY ACTIONS</span>
        <span>AI remains strictly advisory • Interlocking authority preserved</span>
      </div>
    </div>
  );
};
