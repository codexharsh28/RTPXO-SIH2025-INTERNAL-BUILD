/**
 * RTPXO - Incident & Disruption Management Domain Models (Phase 10)
 * Defines data contracts for dynamic temporary speed restrictions (TSR),
 * track section blockages, signal aspect degradations, station possessions,
 * and staged multi-train corridor recovery plans.
 *
 * NOTE: Reuses existing BundledStrategyAction, StrategySafetyStatus,
 * and StrategyExecutionStatus from Phase 9 without duplication.
 */

import {
  BundledStrategyAction,
  StrategySafetyStatus,
  StrategyExecutionStatus,
} from "./strategy";
import { DecisionVerificationStatus } from "./optimization";

export type IncidentType =
  | "TEMPORARY_SPEED_RESTRICTION"
  | "TRACK_SECTION_BLOCKAGE"
  | "SIGNAL_ASPECT_FAILURE"
  | "STATION_PLATFORM_POSSESSION"
  | "CATENARY_POWER_DEGRADATION";

export type IncidentSeverity =
  | "MINOR"
  | "MODERATE"
  | "SEVERE"
  | "CRITICAL";

export type IncidentLifecycleStatus =
  | "ACTIVE_UNACKNOWLEDGED"
  | "ACTIVE_MITIGATING"
  | "CLEARED_RECOVERING"
  | "RESOLVED_CLOSED";

export type RecoveryPhaseTriggerCondition =
  | "IMMEDIATE"
  | "ON_INCIDENT_CLEARANCE"
  | "HEADWAY_STABILIZED";

export type RecoveryPhaseExecutionStatus =
  | "PENDING"
  | "ACTIVE"
  | "COMPLETED"
  | "BLOCKED"
  | "SUPERSEDED"
  | "FAILED";

export type RecoveryAttributionType =
  | "DIRECT"
  | "SHARED_OVERLAP"
  | "SUPERSEDED"
  | "INCONCLUSIVE";

export interface ActiveIncident {
  id: string;
  type: IncidentType;
  severity: IncidentSeverity;
  status: IncidentLifecycleStatus;
  affectedSectionId: string;
  affectedSignalId?: string;
  imposedSpeedLimitKmH?: number;
  isCompleteBlockage: boolean;
  startTimeSimulationSeconds: number;
  expectedDurationSeconds?: number;
  actualClearedSimulationSeconds?: number;
  reason: string;
  operatorNotes?: string;
}

export interface RecoveryStagingPhase {
  phaseNumber: number;
  phaseName: string;
  actions: BundledStrategyAction[];
  triggerCondition: RecoveryPhaseTriggerCondition;
}

export interface DisruptionRecoveryPlan {
  recoveryPlanId: string;
  associatedIncidentId: string;
  name: string;
  summary: string;
  stagingPhases: RecoveryStagingPhase[];
  projectedRecoveryTimeSeconds: number;
  projectedResidualDelayMinutes: number;
  safetyStatus: StrategySafetyStatus;
  executionStatus: StrategyExecutionStatus;
}

export interface RecoveryPhaseExecutionResult {
  phaseNumber: number;
  phaseName: string;
  status: RecoveryPhaseExecutionStatus;
  triggerCondition: RecoveryPhaseTriggerCondition;
  actionsCount: number;
  executedAtSimulationTime?: number;
  completedAtSimulationTime?: number;
}

export interface DisruptionRecoveryAuditRecord {
  id: string;
  recoveryPlanId: string;
  associatedIncidentId: string;
  incidentType: IncidentType;
  incidentSeverity: IncidentSeverity;
  affectedSectionId: string;
  dispatchedSimulationTime: number;
  incidentStartSimulationTime: number;
  incidentClearedSimulationTime?: number;
  recoveryCompletedSimulationTime?: number;
  projectedRecoveryTimeSeconds: number;
  actualRecoveryTimeSeconds?: number;
  projectedResidualDelayMinutes: number;
  actualResidualDelayMinutes?: number;
  peakDisruptionDelayMinutes?: number;
  preIncidentCorridorThroughput: number;
  preIncidentTotalDelayMinutes: number;
  recoveryCorridorThroughput?: number;
  constituentDecisionAuditIds: string[];
  phaseExecutionResults: RecoveryPhaseExecutionResult[];
  verificationStatus: DecisionVerificationStatus;
  attributionType: RecoveryAttributionType;
  supersededByActionId?: string;
  varianceNotes?: string;
}

export interface ActiveRecoveryExecutionState {
  recoveryPlanId: string;
  incidentId: string;
  currentPhaseNumber: number;
  totalPhases: number;
  authorizedSimulationTime: number;
  lastPhaseTransitionSimulationTime: number;
  phaseStatuses: Record<number, RecoveryPhaseExecutionStatus>;
  constituentDecisionAuditIds: string[];
  auditRecordId: string;
  isSuperseded: boolean;
  isCompleted: boolean;
  supersededReason?: string;
}

