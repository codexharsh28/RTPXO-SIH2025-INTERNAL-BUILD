/**
 * RTPXO - Coordinated Multi-Train Strategy & Resilience Domain Models (Phase 9)
 * Defines data contracts for multi-train strategy bundling, joint contingency planning,
 * corridor resilience evaluation, and closed-loop strategy verification.
 *
 * NOTE: Preserves existing CandidateAction and DecisionAuditRecord contracts without duplication.
 * Does NOT contain live railway physics or kinematics state.
 */

import { CandidateAction, PredictedStateSnapshot } from "./optimization";

export type StrategySafetyStatus =
  | "VERIFIED_SAFE"
  | "UNSAFE_REJECTED"
  | "HARD_INTERLOCKING_VIOLATION";

export type StrategyExecutionStatus =
  | "PROPOSED"
  | "AUTHORIZED"
  | "EXECUTED"
  | "DISMISSED"
  | "SUPERSEDED"
  | "STALE_REJECTED";

export type StrategyVerificationStatus =
  | "PENDING"
  | "VERIFIED_ACCURATE"
  | "DEVIATED"
  | "INCONCLUSIVE"
  | "SUPERSEDED";

export type StrategyAttributionType =
  | "DIRECT"
  | "SHARED_OVERLAP"
  | "SUPERSEDED";

export type StrategyPlanType =
  | "PRIMARY_THROUGHPUT"
  | "CONSERVATIVE_CONTINGENCY";

export type StrategyClusterType =
  | "JUNCTION_CONVERGENCE"
  | "CORRIDOR_SATURATION"
  | "OVERTAKING_SIDING"
  | "SPEED_HARMONIZATION";

export type StrategyActionRole =
  | "LEAD_ACCELERATE"
  | "TRAIL_GLIDE"
  | "SIDING_HOLD"
  | "SPEED_REGULATE";

export interface BundledStrategyAction {
  candidateAction: CandidateAction; // Direct encapsulation of existing CandidateAction
  trainId: string;
  trainName: string;
  role: StrategyActionRole;
  targetSectionId: string;
  individualBaseScore: number;
  individualAdaptiveScore: number;
  rationalSummary: string;
}

export interface CorridorResilienceMetrics {
  /**
   * Delay propagation: Projected change in total cumulative downstream delay (minutes).
   * Negative values indicate delay suppression/recovery.
   */
  delayPropagationMinutes: number;

  /**
   * Conflict exposure: Cumulative lookahead conflict-seconds projected across the horizon.
   */
  conflictExposureSeconds: number;

  /**
   * Throughput degradation: Percentage flux reduction compared to unconstrained nominal capacity.
   */
  throughputDegradationPercent: number;

  /**
   * Bottleneck persistence: Fraction (0.0 to 1.0) of lookahead duration that bottleneck sections remain saturated.
   */
  bottleneckPersistenceRatio: number;

  /**
   * Recovery time: Projected seconds until all participating trains return to nominal separation/schedule.
   */
  recoveryTimeSeconds: number;

  /**
   * Affected train count: Number of active trains influenced by the cluster/strategy.
   */
  affectedTrainCount: number;

  /**
   * Recovery efficiency: Ratio of delay minutes saved per unit of deceleration/braking intervention applied.
   */
  recoveryEfficiencyRatio: number;

  /**
   * Minimum spatial separation buffer above SIL-4 2.0 km headway during lookahead (km).
   */
  headwayBufferMarginKm: number;

  /**
   * Kinematic stability index: 0.0 to 1.0 (penalizes stop-and-go acceleration variance).
   */
  kinematicStabilityIndex: number;
}

export interface StrategyPredictedImpact {
  projectedNetDelaySavedMinutes: number;
  projectedCorridorThroughputGainPercent: number;
  projectedBottleneckReliefPercent: number;
  projectedConflictFreeHorizonSeconds: number;
}

export interface StrategyProvenance {
  clusterType: StrategyClusterType;
  corridorZone: string; // e.g. "Ghaziabad - Meerut Junction (Km 24 - 45)"
  algorithm: "JOINT_RESILIENCE_SYNTHESIS" | "ADAPTIVE_HEURISTIC_BUNDLER";
  evaluatedPermutationsCount: number;
}

export interface StrategyPhase8CAuditLinkage {
  auditRecordId?: string;
  dispatchedSimulationTime?: number;
  evaluationWindowSeconds: number; // Standard 30s measurement window
  constituentDecisionAuditIds: string[];
  verificationStatus: StrategyVerificationStatus;
  attributionType: StrategyAttributionType;
}

export interface CoordinatedStrategyPlan {
  strategyId: string;
  planType: StrategyPlanType;
  name: string;
  summary: string;
  creationSimulationTime: number;
  stateRevisionAtGeneration: number; // State revision at creation to detect staleness
  targetTrainIds: string[];
  targetSectionIds: string[];
  constituentActions: BundledStrategyAction[];
  predictedImpact: StrategyPredictedImpact;
  resilienceMetrics: CorridorResilienceMetrics;
  objectiveScore: number;
  adaptiveScore: number;
  safetyStatus: StrategySafetyStatus;
  safetyViolationReason?: string;
  rationale: string;
  provenance: StrategyProvenance;
  executionStatus: StrategyExecutionStatus;
  phase8CAuditLinkage: StrategyPhase8CAuditLinkage;
}

export interface CoordinatedStrategyAuditRecord {
  id: string;
  strategyId: string;
  planType: StrategyPlanType;
  dispatchedSimulationTime: number;
  evaluationWindowSeconds: number;
  participatingTrainIds: string[];
  constituentDecisionAuditIds: string[];
  preState: {
    corridorThroughput: number;
    totalActiveDelayMinutes: number;
    activeConflictCount: number;
    bottleneckSection: string | null;
  };
  projectedImpact: StrategyPredictedImpact;
  actualOutcome?: {
    measuredSimulationTime: number;
    measuredThroughput: number;
    measuredDelayMinutes: number;
    actualThroughputDelta: number;
    actualDelayDelta: number;
    verificationStatus: StrategyVerificationStatus;
    attributionType: StrategyAttributionType;
    varianceNotes?: string;
  };
}
