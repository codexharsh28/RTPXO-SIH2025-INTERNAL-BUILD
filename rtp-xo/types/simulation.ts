/**
 * RTPXO - Unified Simulation Domain Models
 * Defines the complete SimulationSnapshot contract, which serves as the single
 * immutable source of truth for the entire railway system across all engines and UI.
 */

import {
  Train,
  Signal,
  RailwaySection,
  Station,
  Junction,
  TrainConflict,
} from "./railway";
import {
  AIRecommendation,
  NetworkAssessment,
  PredictedConflict,
} from "./advisor";
import {
  CorridorTelemetry,
  ThroughputMetrics,
} from "./metrics";
import { NetworkTopology } from "./topology";
import { OperationalEvent } from "./events";
import { ScenarioDefinition } from "./scenarios";
import { BenchmarkComparisonResult, PredictedStateSnapshot, DecisionAuditRecord } from "./optimization";
import { CoordinatedStrategyPlan, CoordinatedStrategyAuditRecord } from "./strategy";
import {
  ActiveIncident,
  DisruptionRecoveryPlan,
  ActiveRecoveryExecutionState,
  DisruptionRecoveryAuditRecord,
} from "./incident";

import {
  TrackBlock,
} from "./topology";

export interface SimulationConfig {
  tickIntervalMs: number;
  defaultSpeedMultiplier: number;
  maxSpeedMultiplier: number;
  lookaheadHorizonSeconds: number; // Duration (e.g. 180s) to project future conflicts
  predictionHorizonSeconds?: number; // Optimization rolling horizon (default: 300s)
}

export interface SimulationSnapshot {
  // Authoritative Simulation Execution State
  simulationTime: number; // Elapsed simulation time in seconds
  simulationRunning: boolean; // Authoritative running status
  running: boolean; // Backwards-compatible alias
  simulationSpeedMultiplier: number; // Authoritative speed multiplier
  speedMultiplier: number; // Backwards-compatible alias
  activeScenarioId: string;
  scenario: ScenarioDefinition; // Authoritative current scenario definition
  availableScenarios: ScenarioDefinition[];
  predictionHorizonSeconds: number;

  // Authoritative Railway Domain State
  trains: Train[]; // All scenario fleet trains (e.g. T001 to T006)
  activeTrains?: Train[]; // Currently active/moving subset of trains
  signals: Signal[];
  sections: RailwaySection[];
  blocks: TrackBlock[]; // Authoritative discrete track blocks
  stations: Station[];
  junctions: Junction[];
  routes: string[]; // Active registered route IDs across network
  topology: NetworkTopology;

  // Authoritative Conflict & Safety State
  conflicts: TrainConflict[];
  predictedConflicts: PredictedConflict[];

  // Authoritative Network Metrics & Capacity
  networkHealth: "NORMAL" | "WARNING" | "CONGESTED" | "CRITICAL";
  networkCapacity: number; // Occupied block utilization percentage (0-100%)
  throughput: number; // Authoritative corridor throughput in T/h
  averageDelay: number; // Authoritative average delay of active trains in minutes
  occupiedBlocks: TrackBlock[]; // Currently occupied track blocks
  clearBlocks: TrackBlock[]; // Currently available track blocks
  congestedSections: RailwaySection[]; // Sections with elevated density / multiple trains
  throughputMetrics: ThroughputMetrics;
  telemetry: CorridorTelemetry;

  // AI Advisory & Decision Support Layer
  advisorRecommendations: AIRecommendation[]; // Authoritative recommendation list
  recommendations: AIRecommendation[]; // Backwards-compatible alias
  networkAssessment: NetworkAssessment;
  aiScore?: number; // Canonical explainable AI efficiency score (0-100)
  aiScoreBreakdown?: import("./advisor").AIScoreBreakdown; // Detailed explainable breakdown of AI score

  // Forward Kinematic Prediction & Multi-Stage Timeline
  predictedForwardState?: PredictedStateSnapshot;
  selectedTimelineOffset?: number; // Selected timeline lookahead offset (e.g. 0, 60, 120, 300, 600)

  // Decision Replay & Audit Trace (Phase 8B)
  decisionHistory?: DecisionAuditRecord[];

  // Coordinated Strategy Optimization & Resilience (Phase 9)
  availableStrategies?: CoordinatedStrategyPlan[];
  strategyAuditHistory?: CoordinatedStrategyAuditRecord[];

  // Incident & Disruption Management (Phase 10)
  activeIncidents?: ActiveIncident[];
  recoveryPlans?: DisruptionRecoveryPlan[];
  activeRecoveryExecutions?: ActiveRecoveryExecutionState[];
  recoveryAuditHistory?: DisruptionRecoveryAuditRecord[];

  // Operational Event Stream
  events: OperationalEvent[];

  // Benchmark Comparison (if run)
  benchmarkComparison?: BenchmarkComparisonResult;
}

export type SimulationAction =
  | { type: "START" }
  | { type: "PAUSE" }
  | { type: "TOGGLE" }
  | { type: "STOP" }
  | { type: "RESET"; payload?: { initialTrains?: Train[] } }
  | { type: "RESET_SCENARIO" }
  | { type: "SET_SPEED"; payload: { multiplier: number } }
  | { type: "LOAD_SCENARIO"; payload: { scenarioId: string } }
  | { type: "SET_PREDICTION_HORIZON"; payload: { horizon: number } }
  | { type: "RUN_BENCHMARK"; payload?: { scenarioId?: string } }
  | { type: "APPLY_RECOMMENDATION"; payload: { recommendationId: string } }
  | { type: "DISMISS_RECOMMENDATION"; payload: { recommendationId: string } }
  | { type: "MANUAL_SPEED_OVERRIDE"; payload: { trainId: string; speedKmH: number } }
  | { type: "HOLD_TRAIN"; payload: { trainId: string } }
  | { type: "RELEASE_TRAIN"; payload: { trainId: string; speedKmH?: number } }
  | { type: "DISPATCH_STRATEGY"; payload: { strategyId: string } }
  | { type: "DISMISS_STRATEGY"; payload: { strategyId: string } }
  | { type: "DECLARE_INCIDENT"; payload: { incident: ActiveIncident } }
  | { type: "CLEAR_INCIDENT"; payload: { incidentId: string } };
