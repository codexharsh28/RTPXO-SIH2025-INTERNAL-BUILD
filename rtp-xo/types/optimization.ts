/**
 * RTPXO - Predictive Optimization & Multi-Train Coordination Domain Models
 * Defines data contracts for candidate actions, speed trajectories, rolling predictive horizons,
 * forward state projections, objective evaluation, and benchmark comparison telemetry.
 */

import { SignalAspect } from "./railway";
import { RecommendationAction, PredictedConflict } from "./advisor";

export type PredictionHorizonSeconds = 300 | 600 | 900;

export interface SpeedTrajectoryStage {
  stageIndex: number;
  speedKmH: number;
  distanceKm: number;
  durationSeconds: number;
  instruction: string;
}

export interface SpeedTrajectory {
  trainId: string;
  initialSpeedKmH: number;
  targetSpeedKmH: number;
  totalDistanceKm: number;
  totalDurationSeconds: number;
  stages: SpeedTrajectoryStage[];
  summary: string;
}

export interface CandidateAction {
  id: string;
  affectedTrainId: string;
  action: RecommendationAction;
  targetSpeed?: number;
  holdDurationSeconds?: number;
  trajectory?: SpeedTrajectory;
  junctionSequence?: string[];
  affectedSectionId: string;
  description: string;
}

export interface PredictedTrainState {
  trainId: string;
  currentSection: string;
  positionPercent: number;
  speedKmH: number;
  delayMinutes: number;
  status: string;
}

export interface PredictedSectionState {
  sectionId: string;
  activeTrainCount: number;
  occupancyRate: number;
  sectionThroughput: number;
  isBottleneck: boolean;
}

export interface PredictedSignalState {
  signalId: string;
  sectionId: string;
  aspect: SignalAspect;
  reason: string;
}

export interface PredictedHeadwayState {
  trainA: string;
  trainB: string;
  sectionId: string;
  separationDistanceKm: number;
  isHeadwayCompliant: boolean; // >= 2.0 km margin
}

export interface TimelineCheckpoint {
  offsetSeconds: number; // e.g. 0, 60, 120, 300, 600
  absoluteSimulationTime: number;
  trains: PredictedTrainState[];
  sections: PredictedSectionState[];
  signals: PredictedSignalState[];
  headways: PredictedHeadwayState[];
  activeConflictsCount: number;
  conflicts: PredictedConflict[];
  bottleneckSection: string | null;
}

export type DecisionVerificationStatus =
  | "PENDING"
  | "VERIFIED_ACCURATE"
  | "DEVIATED"
  | "INCONCLUSIVE";

export type DecisionAttributionType =
  | "DIRECT"
  | "SHARED_OVERLAP"
  | "SUPERSEDED"
  | "DISRUPTION_RECOVERY";

export interface DecisionBaselinePreState {
  trainSpeed: number;
  trainDelayMinutes: number;
  sectionId: string;
  sectionThroughput: number;
  sectionOccupancyCount: number;
  hasActiveConflict: boolean;
  trainPriorityClass?: "HIGH" | "STANDARD" | "FREIGHT";
}

export interface DecisionActualOutcome {
  measuredAtSimulationTime: number;
  evaluationWindowSeconds: number;
  measuredSpeedKmH: number;
  measuredDelayMinutes: number;
  measuredSectionThroughput: number;
  actualDelayDeltaMinutes: number;
  actualThroughputDelta: number;
  conflictResolution: "RESOLVED" | "UNRESOLVED" | "NOT_APPLICABLE" | "INCONCLUSIVE";
  verificationStatus: DecisionVerificationStatus;
  attributionType: DecisionAttributionType;
  varianceNotes?: string;
}

export type ActionProvenance = "AI_SUGGESTED" | "AI_AUTONOMOUS" | "OPERATOR_CONFIRMED";

export interface DecisionAuditRecord {
  id: string;
  simulationTime: number;
  timestamp: number;
  eventType:
    | "RECOMMENDATION_APPLIED"
    | "RECOMMENDATION_DISMISSED"
    | "MANUAL_SPEED_OVERRIDE"
    | "TRAIN_HOLD"
    | "TRAIN_RELEASE";
  affectedTrainId: string;
  affectedSectionId: string;
  action: string;
  targetSpeed?: number;
  reason: string;
  evaluationWindowSeconds: number;
  preState: DecisionBaselinePreState;
  predictionAvailable: {
    horizonSeconds: number;
    projectedConflictsCount: number;
  };
  projectedImpact: {
    expectedThroughputImpact: number;
    expectedDelayImpact: number;
    projectedDelayMinutes: number;
  };
  strategyId?: string; // Phase 9: Linkage to parent CoordinatedStrategyPlan
  actualOutcome?: DecisionActualOutcome;
  provenance?: ActionProvenance;
  actor?: string; // e.g. "OPERATOR_DISPATCHER" | "AUTONOMOUS_OPTIMIZER"
}

export interface PredictedStateSnapshot {
  timeHorizonSeconds: number;
  trains: PredictedTrainState[];
  sections: PredictedSectionState[];
  activeConflictsCount: number;
  predictedConflictsCount: number;
  corridorThroughput: number;
  totalDelayMinutes: number;
  averageDelayMinutes: number;
  maximumDelayMinutes: number;
  timeline?: TimelineCheckpoint[];
}

export interface ObjectiveScoreBreakdown {
  throughputGainScore: number;
  delayRecoveryScore: number;
  bottleneckReliefScore: number;
  priorityScore: number;
  brakingLossScore: number;
  junctionWaitScore: number;
  totalScore: number;
}

export type AdaptiveConfidenceLevel = "LOW" | "MEDIUM" | "HIGH";

export interface AdaptiveLearningBucket {
  contextKey: string;
  attempts: number;
  verifiedAccurate: number;
  deviated: number;
  inconclusive: number;
  superseded: number;
  successRate: number;
  averageDelayDelta: number;
  averageThroughputDelta: number;
  confidenceScore: number;
  confidenceLevel: AdaptiveConfidenceLevel;
  lastUpdatedSimulationTime: number;
}

export interface AdaptiveDecisionInsight {
  contextKey: string;
  historicalSampleCount: number;
  verifiedSampleCount: number;
  successRate: number;
  confidenceScore: number;
  confidenceLevel: AdaptiveConfidenceLevel;
  adaptiveAdjustment: number;
  adaptiveScore: number;
  baseObjectiveScore: number;
  evidenceSummary: string;
  fallbackLevel: "EXACT" | "SECTION_INDEPENDENT" | "CONGESTION_ACTION" | "ACTION_ONLY" | "NEUTRAL_PRIOR";
}

export interface CandidateEvaluation {
  candidate: CandidateAction;
  isSafe: boolean;
  safetyRejectionReason?: string;
  predictedState: PredictedStateSnapshot;
  objectiveScore: number;
  adaptiveScore?: number;
  adaptiveInsight?: AdaptiveDecisionInsight;
  scoreBreakdown: ObjectiveScoreBreakdown;
  expectedMetrics: {
    sectionThroughputDeltaPercent: number;
    delayReductionMinutes: number;
    bottleneckReliefPercent: number;
  };
}

export interface RejectedAlternative {
  id: string;
  action: RecommendationAction;
  targetSpeed?: number;
  trainId: string;
  reason: string;
  isSafe: boolean;
  objectiveScore: number;
  adaptiveScore?: number;
  adaptiveAdjustment?: number;
}

export interface BenchmarkRunTelemetry {
  mode: "BASELINE_DISPATCHER" | "RTPXO_OPTIMIZER";
  scenarioId: string;
  durationSeconds: number;
  corridorThroughput: number;
  averageDelayMinutes: number;
  maximumDelayMinutes: number;
  completedTrainsCount: number;
  bottleneckSectionUtilization: number;
  conflictCount: number;
  conflictFreeTimeSeconds: number;
  unnecessaryStopsCount: number;
  averageSpeedKmH: number;
}

export interface BenchmarkComparisonResult {
  scenarioId: string;
  baseline: BenchmarkRunTelemetry;
  optimized: BenchmarkRunTelemetry;
  throughputImprovementPercent: number;
  delayReductionMinutes: number;
  stopsReducedCount: number;
  conflictFreeGainPercent: number;
  efficiencyGainSummary: string;
  timestamp: number;
}
