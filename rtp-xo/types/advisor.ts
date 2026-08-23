/**
 * RTPXO - AI Advisor Domain Models
 * Defines data contracts for AI traffic-control recommendations,
 * transparent constraint checks, what-if counterfactual validation, and network assessment.
 */

import {
  SpeedTrajectory,
  RejectedAlternative,
  ObjectiveScoreBreakdown,
  AdaptiveDecisionInsight,
} from "./optimization";

export type RecommendationAction =
  | "HOLD_TRAIN"
  | "REDUCE_SPEED"
  | "INCREASE_SPEED"
  | "MAINTAIN_SPEED"
  | "GLIDE_SPEED"
  | "PRIORITIZE_TRAIN"
  | "DELAY_TRAIN"
  | "CLEAR_SECTION"
  | "PREPARE_JUNCTION"
  | "CHANGE_SIGNAL_RECOMMENDATION";

export type RecommendationUrgency =
  | "LOW"
  | "MEDIUM"
  | "HIGH"
  | "CRITICAL";

export type RecommendationStatus =
  | "PENDING"
  | "ACCEPTED"
  | "REJECTED"
  | "EXECUTED"
  | "EXPIRED"
  | "DISMISSED";

export type AssessmentStatus =
  | "OPTIMAL"
  | "CONGESTED"
  | "CRITICAL"
  | "OPTIMIZING";

export interface RecommendationConstraints {
  headway: "PASS" | "FAIL";
  downstreamOccupancy: "CLEAR" | "OCCUPIED" | "RESTRICTED";
  conflictRisk: "LOW" | "MEDIUM" | "HIGH";
  signalAuthority: "PASS" | "RESTRICTED";
  sectionCapacity: "AVAILABLE" | "SATURATED";
  isSafeToDispatch: boolean;
}

export interface RecommendationExpectedEffect {
  delayReductionMinutes: number;
  sectionThroughputImpactPercent: number;
  networkThroughputImpactPercent: number;
}

export interface WhatIfProjection {
  predictedPositionPercent: number;
  predictedArrivalTime: string;
  predictedDelayMinutes: number;
  sectionOccupancyAfter: number;
  sectionThroughputAfter: number;
  conflictRiskAfter: "LOW" | "MEDIUM" | "HIGH";
}

export interface CounterfactualComparison {
  currentSpeedKmH: number;
  targetSpeedKmH: number;
  currentDelayMinutes: number;
  projectedDelayMinutes: number;
  currentSectionThroughput: number;
  projectedSectionThroughput: number;
  projection?: WhatIfProjection;
}

export interface AIRecommendation {
  id: string;
  affectedTrainId: string;
  action: RecommendationAction;
  reason: string;
  urgency: RecommendationUrgency;
  confidence: number; // 0.00 to 1.00
  affectedSectionId: string;
  targetSpeed?: number; // Target speed in km/h if action involves speed adjustment
  holdDurationSeconds?: number; // Duration if action is HOLD_TRAIN
  expectedDelayImpact: number; // Estimated delay change in minutes (e.g. -2.5 min)
  expectedThroughputImpact: number; // Estimated throughput delta percentage (e.g. +8.5%)
  expectedEffect?: RecommendationExpectedEffect;
  constraintsChecked?: RecommendationConstraints;
  counterfactual?: CounterfactualComparison;
  speedTrajectory?: SpeedTrajectory;
  rejectedAlternatives?: RejectedAlternative[];
  objectiveScore?: number;
  objectiveScoreBreakdown?: ObjectiveScoreBreakdown;
  adaptiveScore?: number;
  adaptiveInsight?: AdaptiveDecisionInsight;
  predictionHorizonSeconds?: number;
  isSafeToDispatch: boolean;
  createdAt: number; // Simulation timestamp (seconds)
  status: RecommendationStatus;
  appliedAt?: number;
}

export interface PredictedConflict {
  id: string;
  trainA: string;
  trainB: string;
  sectionId: string;
  junctionId?: string;
  predictedTimeToConflictSeconds: number;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  reason: string;
  locationKm?: number;
}

export interface Bottleneck {
  id: string;
  sectionId: string;
  sectionName: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  utilizationPercent: number;
  delayedTrainsCount: number;
  trainsQueued: string[];
  reason: string;
  suggestedAction?: RecommendationAction;
}

export interface AIScoreFactor {
  factor: string;
  points: number; // e.g. -20, +5
  description: string;
}

export interface AIScoreBreakdown {
  baseScore: number;
  totalScore: number;
  penalties: AIScoreFactor[];
  bonuses: AIScoreFactor[];
  summary: string;
}

export interface NetworkAssessment {
  status: AssessmentStatus;
  summary: string;
  activeBottlenecks: Bottleneck[];
  predictedConflicts: PredictedConflict[];
  recommendedActionsCount: number;
  efficiencyScore: number; // 0 to 100
  aiScoreBreakdown?: AIScoreBreakdown;
  timestamp: number;
}
