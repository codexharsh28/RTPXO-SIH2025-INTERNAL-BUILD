/**
 * RTPXO - Unified Simulation Engine (Phase 7E Hardened & Instance-Scoped)
 * Master orchestrator and single authoritative source of truth for the entire railway system.
 */

import {
  Train,
  RailwaySection,
  Station,
  Junction,
  Signal,
  TrainConflict,
  TrainStatus,
  SectionStatus,
} from "@/types/railway";
import {
  AIRecommendation,
  NetworkAssessment,
  PredictedConflict,
} from "@/types/advisor";
import {
  ThroughputMetrics,
  CorridorTelemetry,
} from "@/types/metrics";
import {
  SimulationConfig,
  SimulationSnapshot,
} from "@/types/simulation";
import { OperationalEvent } from "@/types/events";
import { TrackBlock } from "@/types/topology";
import { trains as defaultInitialTrains } from "@/data/trains";
import { sections as defaultSections } from "@/data/sections";
import { stations as defaultStations } from "@/data/stations";
import { junctions as defaultJunctions } from "@/data/junctions";
import { signals as defaultSignals } from "@/data/signals";
import {
  corridorTopology,
  resolveNextSection,
  multiLineSections,
  calculateCurrentBlock,
  calculateTrainStatus,
  canonicalNetworkBlocks,
} from "@/data/topology";
import { operationalScenarios } from "@/data/scenarios";

import { signalEngine } from "./signalEngine";
import { conflictEngine } from "./conflictEngine";
import { ThroughputEngine } from "./throughputEngine";
import { advisorEngine } from "./advisorEngine";
import { EventEngine } from "./eventEngine";
import { predictionEngine } from "./predictionEngine";

import {
  PredictionHorizonSeconds,
  BenchmarkComparisonResult,
  PredictedStateSnapshot,
  DecisionAuditRecord,
  DecisionBaselinePreState,
  DecisionActualOutcome,
  DecisionVerificationStatus,
  DecisionAttributionType,
} from "@/types/optimization";
import {
  CoordinatedStrategyPlan,
  CoordinatedStrategyAuditRecord,
  StrategyAttributionType,
  StrategyVerificationStatus,
} from "@/types/strategy";
import {
  ActiveIncident,
  DisruptionRecoveryPlan,
  ActiveRecoveryExecutionState,
  DisruptionRecoveryAuditRecord,
  RecoveryPhaseExecutionStatus,
  RecoveryPhaseExecutionResult,
  RecoveryAttributionType,
} from "@/types/incident";
import { benchmarkRunner } from "./benchmarkRunner";
import { AdaptiveDecisionEngine, adaptiveDecisionEngine } from "./adaptiveDecisionEngine";

const DEFAULT_CONFIG: SimulationConfig = {
  tickIntervalMs: 500,
  defaultSpeedMultiplier: 2,
  maxSpeedMultiplier: 10,
  lookaheadHorizonSeconds: 180,
  predictionHorizonSeconds: 300,
};

export class SimulationEngine {
  private config: SimulationConfig;
  private simulationTime: number = 0;
  private running: boolean = false;
  private timer: NodeJS.Timeout | null = null;
  private speedMultiplier: number;
  private listeners: Array<(snapshot: SimulationSnapshot) => void> = [];
  private activeScenarioId: string = "MULTI_TRAIN_OPERATIONS";
  private predictionHorizonSeconds: PredictionHorizonSeconds = 300;
  private benchmarkComparison?: BenchmarkComparisonResult;

  // Instance-Scoped Telemetry & Event Engines
  private throughputEngine: ThroughputEngine;
  private eventEngine: EventEngine;
  private adaptiveEngine: AdaptiveDecisionEngine;

  // Adaptive Performance Cadence & Optimization Scheduling (Phase 8A)
  private optimizationCadenceSeconds: number = 2.0;
  private lastOptimizationSimulationTime: number = -Infinity;
  private stateRevision: number = 0;
  private lastEvaluatedRevision: number = -1;
  private optimizationExecutionCount: number = 0;

  // Decision Replay & Audit Trace (Phase 8B)
  private decisionHistory: DecisionAuditRecord[] = [];
  private selectedTimelineOffset: number = 0;

  // Coordinated Strategy Optimization & Resilience (Phase 9)
  private availableStrategies: CoordinatedStrategyPlan[] = [];
  private strategyAuditHistory: CoordinatedStrategyAuditRecord[] = [];

  // Incident & Disruption Management (Phase 10)
  private activeIncidents: ActiveIncident[] = [];
  private recoveryPlans: DisruptionRecoveryPlan[] = [];
  private activeRecoveryExecutions = new Map<string, ActiveRecoveryExecutionState>();
  private recoveryAuditHistory: DisruptionRecoveryAuditRecord[] = [];
  private clearedIncidentsHistory: ActiveIncident[] = [];

  // Authoritative Railway Domain State
  private initialTrains: Train[] = [];
  private trains: Train[] = [];
  private sections: RailwaySection[] = [];
  private blocks: TrackBlock[] = [];
  private stations: Station[] = [];
  private junctions: Junction[] = [];
  private signals: Signal[] = [];

  // Authoritative Derived Metric States
  private networkHealth: "NORMAL" | "WARNING" | "CONGESTED" | "CRITICAL" = "NORMAL";
  private networkCapacity: number = 0;
  private averageDelay: number = 0;
  private occupiedBlocks: TrackBlock[] = [];
  private congestedSections: RailwaySection[] = [];

  // Multi-Engine Results
  private activeConflicts: TrainConflict[] = [];
  private predictedConflicts: PredictedConflict[] = [];
  private throughputMetrics!: ThroughputMetrics;
  private telemetry!: CorridorTelemetry;
  private networkAssessment!: NetworkAssessment;
  private recommendations: AIRecommendation[] = [];
  private appliedRecommendations = new Map<string, AIRecommendation>();
  private dismissedRecommendationIds = new Set<string>();
  private authorizedRecoveryPlanIds = new Set<string>();
  private dismissedRecoveryPlanIds = new Set<string>();
  private predictedForwardState?: PredictedStateSnapshot;

  // Prior states for event transition detection
  private priorSignalsMap = new Map<string, string>();
  private priorConflictsSet = new Set<string>();
  private priorBottleneckSection: string | null = null;

  constructor(
    initialTrains: Train[] = defaultInitialTrains,
    config: Partial<SimulationConfig> = {}
  ) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    };

    this.throughputEngine = new ThroughputEngine();
    this.eventEngine = new EventEngine();
    this.adaptiveEngine = new AdaptiveDecisionEngine();

    const initialTrainIds = new Set(initialTrains.map((t) => t.id));
    const fullFleet = [
      ...initialTrains,
      ...defaultInitialTrains.filter((dt) => !initialTrainIds.has(dt.id)),
    ];
    this.initialTrains = fullFleet.map((t) => this.normalizeTrain(t, fullFleet));
    this.trains = this.initialTrains.map((t) => structuredClone(t));
    this.sections = structuredClone(defaultSections);
    this.blocks = canonicalNetworkBlocks.map((b) => structuredClone(b));
    this.stations = structuredClone(defaultStations);
    this.junctions = structuredClone(defaultJunctions);
    this.signals = structuredClone(defaultSignals);
    this.speedMultiplier = this.config.defaultSpeedMultiplier;

    this.throughputEngine.reset();
    this.eventEngine.reset();
    this.adaptiveEngine.reset();
    this.eventEngine.emitEvent(
      "RECOMMENDATION_CREATED",
      "RTPXO Simulation Engine initialized and monitoring corridor",
      0,
      "INFO"
    );
    this.evaluateAllEngines();
  }

  /**
   * Normalizes any input train object into the canonical, authoritative Train domain model.
   */
  private normalizeTrain(
    train: Partial<Train>,
    allTrains: Train[] = [],
    conflicts: TrainConflict[] = [],
    activeIncidents: ActiveIncident[] = []
  ): Train {
    const currentSection = train.currentSection || "ND-GZB-01";
    const position = Math.max(0, Math.min(Number(train.position) || 0, 100));
    const progress = Number(position.toFixed(2));
    const blockResolution = calculateCurrentBlock(currentSection, position);
    const currentBlock = blockResolution.blockId;
    const maxSpeed =
      train.maxSpeed ||
      (train.type === "SUPERFAST" ? 130 : train.type === "EXPRESS" ? 120 : train.type === "FREIGHT" ? 65 : 100);
    const speed = Math.max(0, Math.min(Number(train.speed) || 0, maxSpeed));
    const delayMinutes = Math.max(0, Number(train.delayMinutes ?? train.delay ?? 0));
    const delay = delayMinutes;
    const id = train.id || `T00${allTrains.length + 1}`;
    const name = train.name || `Train ${id}`;
    const type = train.type || "EXPRESS";
    const priority = Number(train.priority) || 5;
    const origin = train.origin || "ND";
    const destination = train.destination || "SNP";
    const scheduledArrival = train.scheduledArrival || "12:30";
    const expectedArrival = train.expectedArrival || scheduledArrival;
    const route = train.route || ["ND-GZB-01", "GZB-MRT-01", "MRT-SNP-01"];
    const routeIndex = train.routeIndex ?? 0;
    const completed = Boolean(train.completed || train.status === "COMPLETED");

    const baseTrain: Train = {
      id,
      name,
      type,
      priority,
      currentSection,
      currentBlock,
      position: progress,
      progress,
      speed,
      maxSpeed,
      targetSpeed: train.targetSpeed,
      status: (train.status as TrainStatus) || "ON_TIME",
      delay,
      delayMinutes,
      origin,
      destination,
      scheduledArrival,
      expectedArrival,
      route,
      routeIndex,
      direction: train.direction || "UP",
      lengthMeters: train.lengthMeters || 500,
      enteredSectionAt: train.enteredSectionAt || 0,
      totalTravelTimeSeconds: train.totalTravelTimeSeconds || 0,
      completed,
    };

    baseTrain.status = calculateTrainStatus(baseTrain, allTrains, conflicts, activeIncidents);
    return baseTrain;
  }

  public getThroughputEngine(): ThroughputEngine {
    return this.throughputEngine;
  }

  public getEventEngine(): EventEngine {
    return this.eventEngine;
  }

  public getAdaptiveEngine(): AdaptiveDecisionEngine {
    return this.adaptiveEngine;
  }

  public getOptimizationCadence(): number {
    return this.optimizationCadenceSeconds;
  }

  public setOptimizationCadence(cadenceSeconds: number): void {
    this.optimizationCadenceSeconds = Math.max(0.1, cadenceSeconds);
  }

  public getOptimizationExecutionCount(): number {
    return this.optimizationExecutionCount;
  }

  public getStateRevision(): number {
    return this.stateRevision;
  }

  public invalidateOptimization(): void {
    this.stateRevision++;
  }

  public getDecisionHistory(): DecisionAuditRecord[] {
    return structuredClone(this.decisionHistory);
  }

  public getAvailableStrategies(): CoordinatedStrategyPlan[] {
    return structuredClone(this.availableStrategies);
  }

  public getStrategyAuditHistory(): CoordinatedStrategyAuditRecord[] {
    return structuredClone(this.strategyAuditHistory);
  }

  public getRecoveryPlans(): DisruptionRecoveryPlan[] {
    return structuredClone(this.recoveryPlans);
  }

  public getActiveRecoveryExecutions(): ActiveRecoveryExecutionState[] {
    return Array.from(this.activeRecoveryExecutions.values()).map((e) => structuredClone(e));
  }

  public getRecoveryAuditHistory(): DisruptionRecoveryAuditRecord[] {
    return structuredClone(this.recoveryAuditHistory);
  }

  public getSelectedTimelineOffset(): number {
    return this.selectedTimelineOffset;
  }

  public setSelectedTimelineOffset(offsetSeconds: number): void {
    this.selectedTimelineOffset = Math.max(0, offsetSeconds);
    this.notify();
  }

  private recordDecision(record: DecisionAuditRecord): void {
    // If there is an existing pending decision for the SAME train, mark it SUPERSEDED
    for (const prev of this.decisionHistory) {
      if (!prev.actualOutcome && prev.affectedTrainId === record.affectedTrainId) {
        const isSameRecoveryPlan =
          Boolean(prev.strategyId && record.strategyId && prev.strategyId === record.strategyId);

        prev.actualOutcome = {
          measuredAtSimulationTime: this.simulationTime,
          evaluationWindowSeconds: prev.evaluationWindowSeconds || 30,
          measuredSpeedKmH: record.preState.trainSpeed,
          measuredDelayMinutes: record.preState.trainDelayMinutes,
          measuredSectionThroughput: record.preState.sectionThroughput,
          actualDelayDeltaMinutes: 0,
          actualThroughputDelta: 0,
          conflictResolution: "INCONCLUSIVE",
          verificationStatus: isSameRecoveryPlan ? "VERIFIED_ACCURATE" : "INCONCLUSIVE",
          attributionType: isSameRecoveryPlan ? "DISRUPTION_RECOVERY" : "SUPERSEDED",
          varianceNotes: isSameRecoveryPlan
            ? "Transitioned to subsequent recovery phase"
            : `Superseded by subsequent operator action at T+${this.simulationTime.toFixed(1)}s`,
        };
        // Feed superseded record to AdaptiveDecisionEngine (Phase 8D)
        this.adaptiveEngine.recordOutcome(prev);
      }
    }

    this.decisionHistory.push(record);
    if (this.decisionHistory.length > 50) {
      this.decisionHistory.shift();
    }
  }

  /**
   * Closed-loop decision outcome evaluator (Phase 8C).
   * Measures live operational telemetry at T0 + evaluationWindowSeconds against recorded preState and projectedImpact.
   */
  public evaluatePendingDecisions(): void {
    for (const record of this.decisionHistory) {
      if (record.actualOutcome) continue; // Already finalized

      const windowSec = record.evaluationWindowSeconds || 30;
      if (this.simulationTime < record.simulationTime + windowSec) {
        continue; // Evaluation window has not elapsed yet (PENDING)
      }

      const train = this.trains.find((t) => t.id === record.affectedTrainId);
      const sectionId = record.affectedSectionId;
      const currentSectionThroughput =
        this.telemetry?.sectionUtilizations?.find((s) => s.sectionId === sectionId)?.sectionThroughput ?? 0;

      if (!train || train.completed || train.status === "COMPLETED") {
        record.actualOutcome = {
          measuredAtSimulationTime: this.simulationTime,
          evaluationWindowSeconds: windowSec,
          measuredSpeedKmH: train ? train.speed : 0,
          measuredDelayMinutes: train ? train.delayMinutes : 0,
          measuredSectionThroughput: currentSectionThroughput,
          actualDelayDeltaMinutes: train ? Number((train.delayMinutes - record.preState.trainDelayMinutes).toFixed(2)) : 0,
          actualThroughputDelta: Number((currentSectionThroughput - record.preState.sectionThroughput).toFixed(2)),
          conflictResolution: "INCONCLUSIVE",
          verificationStatus: "INCONCLUSIVE",
          attributionType: "DIRECT",
          varianceNotes: "Train completed journey before evaluation window elapsed",
        };
        continue;
      }

      const liveSpeed = train.speed;
      const liveDelay = train.delayMinutes;
      const actualDelayDeltaMinutes = Number((liveDelay - record.preState.trainDelayMinutes).toFixed(2));
      const actualThroughputDelta = Number((currentSectionThroughput - record.preState.sectionThroughput).toFixed(2));

      const hasLiveConflict = this.activeConflicts.some(
        (c) => c.trainA === train.id || c.trainB === train.id || c.sectionA === sectionId || c.sectionB === sectionId
      );

      let conflictResolution: "RESOLVED" | "UNRESOLVED" | "NOT_APPLICABLE" | "INCONCLUSIVE" = "NOT_APPLICABLE";
      if (record.preState.hasActiveConflict) {
        conflictResolution = hasLiveConflict ? "UNRESOLVED" : "RESOLVED";
      }

      // Check for concurrent other decisions on same/adjacent block in the window
      const concurrentOtherDecisions = this.decisionHistory.filter(
        (d) =>
          d.id !== record.id &&
          d.simulationTime >= record.simulationTime &&
          d.simulationTime <= record.simulationTime + windowSec &&
          (d.affectedSectionId === sectionId || d.affectedTrainId !== record.affectedTrainId)
      );
      let attributionType: DecisionAttributionType =
        concurrentOtherDecisions.length > 0 ? "SHARED_OVERLAP" : "DIRECT";

      if (
        record.strategyId &&
        (record.strategyId.startsWith("RECPLAN-") ||
          record.strategyId.startsWith("REC-") ||
          this.activeRecoveryExecutions.has(record.strategyId) ||
          this.recoveryAuditHistory.some((a) => a.recoveryPlanId === record.strategyId))
      ) {
        attributionType = "DISRUPTION_RECOVERY";
      }

      // Verification Status determination
      let verificationStatus: DecisionVerificationStatus = "DEVIATED";
      let varianceNotes: string | undefined;

      const expectedDelayGain = record.projectedImpact.expectedDelayImpact;
      const expectedTputGain = record.projectedImpact.expectedThroughputImpact;

      const isDelayMet = expectedDelayGain < 0 ? actualDelayDeltaMinutes <= expectedDelayGain + 0.5 : actualDelayDeltaMinutes <= 0.5;
      const isThroughputMet = expectedTputGain > 0 ? actualThroughputDelta >= 0 : true;
      const isConflictMet = record.preState.hasActiveConflict ? conflictResolution === "RESOLVED" : true;

      if (isDelayMet && isThroughputMet && isConflictMet) {
        verificationStatus = "VERIFIED_ACCURATE";
      } else {
        verificationStatus = "DEVIATED";
        varianceNotes = `Measured delay delta (${actualDelayDeltaMinutes}m) or throughput delta (${actualThroughputDelta}) diverged from projection`;
      }

      record.actualOutcome = {
        measuredAtSimulationTime: this.simulationTime,
        evaluationWindowSeconds: windowSec,
        measuredSpeedKmH: liveSpeed,
        measuredDelayMinutes: liveDelay,
        measuredSectionThroughput: currentSectionThroughput,
        actualDelayDeltaMinutes,
        actualThroughputDelta,
        conflictResolution,
        verificationStatus,
        attributionType,
        varianceNotes,
      };

      // Feed completed Phase 8C outcome to Adaptive Decision Engine (Phase 8D)
      this.adaptiveEngine.recordOutcome(record);
    }

    // Evaluate Phase 9 Coordinated Strategies
    this.evaluatePendingStrategies();
  }

  /**
   * Closed-loop strategy outcome evaluator (Phase 9).
   * Measures actual multi-train corridor throughput, delay suppression, and constituent action status at T0 + 30s.
   */
  public evaluatePendingStrategies(): void {
    for (const record of this.strategyAuditHistory) {
      if (record.actualOutcome) continue;

      const windowSec = record.evaluationWindowSeconds || 30;
      if (this.simulationTime < record.dispatchedSimulationTime + windowSec) {
        continue;
      }

      const participatingTrains = this.trains.filter((t) =>
        record.participatingTrainIds.includes(t.id)
      );
      const measuredThroughput = this.throughputMetrics.corridorThroughput;
      const measuredDelayMinutes = this.trains.reduce((acc, t) => acc + t.delayMinutes, 0);
      const actualThroughputDelta = Number(
        (measuredThroughput - record.preState.corridorThroughput).toFixed(2)
      );
      const actualDelayDelta = Number(
        (measuredDelayMinutes - record.preState.totalActiveDelayMinutes).toFixed(2)
      );

      // Retrieve constituent DecisionAuditRecords
      const constituentRecords = this.decisionHistory.filter((d) =>
        record.constituentDecisionAuditIds.includes(d.id)
      );

      // Check supersession / manual intervention
      const isAnySuperseded = constituentRecords.some(
        (d) => d.actualOutcome?.attributionType === "SUPERSEDED"
      );

      let attributionType: StrategyAttributionType = "DIRECT";
      if (isAnySuperseded) {
        attributionType = "SUPERSEDED";
      } else {
        const otherCorridorActions = this.decisionHistory.filter(
          (d) =>
            !record.constituentDecisionAuditIds.includes(d.id) &&
            d.simulationTime >= record.dispatchedSimulationTime &&
            d.simulationTime <= record.dispatchedSimulationTime + windowSec
        );
        if (otherCorridorActions.length > 0) {
          attributionType = "SHARED_OVERLAP";
        }
      }

      let verificationStatus: StrategyVerificationStatus = "DEVIATED";
      let varianceNotes: string | undefined;

      const allTrainsCompleted =
        participatingTrains.length > 0 &&
        participatingTrains.every((t) => t.completed || t.status === "COMPLETED");

      if (attributionType === "SUPERSEDED") {
        verificationStatus = "SUPERSEDED";
        varianceNotes = "Strategy execution superseded by subsequent manual operator intervention";
      } else if (allTrainsCompleted) {
        verificationStatus = "INCONCLUSIVE";
        varianceNotes = "All participating trains completed journey before strategy evaluation window elapsed";
      } else {
        const allConstituentsAccurate =
          constituentRecords.length > 0 &&
          constituentRecords.every(
            (d) => d.actualOutcome && d.actualOutcome.verificationStatus === "VERIFIED_ACCURATE"
          );

        // Verification condition: all constituent actions verified accurate and net corridor delay stabilized
        if (allConstituentsAccurate && actualDelayDelta <= 0.5) {
          verificationStatus = "VERIFIED_ACCURATE";
        } else {
          verificationStatus = "DEVIATED";
          varianceNotes = `Corridor delay delta (${actualDelayDelta}m) or constituent action variance detected`;
        }
      }

      record.actualOutcome = {
        measuredSimulationTime: this.simulationTime,
        measuredThroughput,
        measuredDelayMinutes,
        actualThroughputDelta,
        actualDelayDelta,
        verificationStatus,
        attributionType,
        varianceNotes,
      };

      // Feed verified strategy outcome to Adaptive Decision Engine (Phase 8D)
      this.adaptiveEngine.recordStrategyOutcome(record);
    }
  }

  /* =========================================================
     SIMULATION CONTROL
     ========================================================= */

  public start(): void {
    if (this.running) return;

    this.running = true;
    this.timer = setInterval(() => {
      this.tick();
    }, this.config.tickIntervalMs);

    this.notify();
  }

  public pause(): void {
    this.running = false;
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.notify();
  }

  public toggle(): void {
    if (this.running) {
      this.pause();
    } else {
      this.start();
    }
  }

  public stop(): void {
    this.pause();
    this.simulationTime = 0;
    this.notify();
  }

  public reset(newTrains?: Train[]): void {
    this.pause();
    this.simulationTime = 0;
    this.speedMultiplier = this.config.defaultSpeedMultiplier;

    const sourceTrains = newTrains || this.getActiveScenarioTrains();
    this.initialTrains = sourceTrains.map((t) => this.normalizeTrain(t, sourceTrains));
    this.trains = this.initialTrains.map((t) => structuredClone(t));
    this.sections = structuredClone(defaultSections);
    this.blocks = canonicalNetworkBlocks.map((b) => structuredClone(b));
    this.stations = structuredClone(defaultStations);
    this.junctions = structuredClone(defaultJunctions);
    this.signals = structuredClone(defaultSignals);

    this.throughputEngine.reset();
    this.eventEngine.reset();
    this.appliedRecommendations.clear();
    this.dismissedRecommendationIds.clear();
    this.priorSignalsMap.clear();
    this.priorConflictsSet.clear();
    this.priorBottleneckSection = null;
    this.benchmarkComparison = undefined;

    // Reset Decision History & Timeline Selection (Phase 8B)
    this.decisionHistory = [];
    this.selectedTimelineOffset = 0;

    // Reset Coordinated Strategy State & Audits (Phase 9)
    this.availableStrategies = [];
    this.strategyAuditHistory = [];

    // Reset Active Incidents & Disruptions (Phase 10)
    this.activeIncidents = [];
    this.recoveryPlans = [];
    this.activeRecoveryExecutions.clear();
    this.recoveryAuditHistory = [];
    this.clearedIncidentsHistory = [];
    this.authorizedRecoveryPlanIds.clear();
    this.dismissedRecoveryPlanIds.clear();

    // Reset Adaptive Intelligence Policy Learning (Phase 8D)
    this.adaptiveEngine.reset();

    this.stateRevision++;
    this.lastOptimizationSimulationTime = -Infinity;
    this.lastEvaluatedRevision = -1;

    this.eventEngine.emitEvent(
      "RECOMMENDATION_CREATED",
      `Simulation reset to initial state (${this.activeScenarioId})`,
      0,
      "INFO"
    );

    this.evaluateAllEngines();
    this.notify();
  }

  public getTrainById(trainId: string): Train | undefined {
    return this.trains.find((t) => t.id === trainId);
  }

  private getActiveScenarioTrains(): Train[] {
    const sc = operationalScenarios.find((s) => s.id === this.activeScenarioId);
    const scenarioTrains = sc && sc.trains && sc.trains.length > 0 ? sc.trains : defaultInitialTrains;

    // Ensure all 6 canonical trains exist in authoritative state
    const scenarioTrainIds = new Set(scenarioTrains.map((t) => t.id));
    const occupiedBlocks = new Set(
      scenarioTrains.map((t) => calculateCurrentBlock(t.currentSection, t.position).blockId)
    );

    const complementTrains = defaultInitialTrains
      .filter((dt) => !scenarioTrainIds.has(dt.id))
      .map((dt) => {
        const defaultBlockId = calculateCurrentBlock(dt.currentSection, dt.position).blockId;
        let position = dt.position;
        let section = dt.currentSection;

        // If default block is already occupied by a scenario train, place background train at clear track location
        if (occupiedBlocks.has(defaultBlockId)) {
          if (dt.id === "T005" || dt.id === "T006") {
            section = "ALJN-KNP-01";
            position = dt.id === "T005" ? 15 : 75;
          } else if (dt.id === "T003" || dt.id === "T004") {
            section = "GZB-ALJN-01";
            position = dt.id === "T003" ? 25 : 65;
          } else {
            section = "ND-GZB-01";
            position = 10;
          }
        }

        return {
          ...dt,
          currentSection: section,
          position,
          progress: position,
          speed: 0,
          targetSpeed: 0,
          delay: 0,
          delayMinutes: 0,
          status: "HELD" as const,
        };
      });

    return [...scenarioTrains, ...complementTrains];
  }

  public loadScenario(scenarioId: string): boolean {
    const scenario = operationalScenarios.find((s) => s.id === scenarioId);
    if (!scenario) {
      console.warn(
        `[RTPXO SimulationEngine] Invalid scenario ID "${scenarioId}". Authoritative scenarios: ${operationalScenarios.map((s) => s.id).join(", ")}`
      );
      return false;
    }

    this.activeScenarioId = scenarioId;
    this.reset();

    this.eventEngine.emitEvent(
      "RECOMMENDATION_CREATED",
      `Loaded Scenario: ${scenario.name} (${scenario.category})`,
      this.simulationTime,
      "INFO"
    );

    this.notify();
    return true;
  }

  public resetScenario(): void {
    this.loadScenario(this.activeScenarioId);
  }

  public setSpeedMultiplier(multiplier: number): void {
    this.speedMultiplier = Math.max(
      1,
      Math.min(multiplier, this.config.maxSpeedMultiplier)
    );
    this.notify();
  }

  public increaseSpeed(): void {
    this.setSpeedMultiplier(
      Math.min(this.speedMultiplier * 2, this.config.maxSpeedMultiplier)
    );
  }

  public setPredictionHorizon(horizon: PredictionHorizonSeconds): void {
    this.predictionHorizonSeconds = horizon;
    this.stateRevision++;
    this.evaluateAllEngines();
    this.notify();
  }

  public runBenchmark(scenarioId?: string): BenchmarkComparisonResult {
    const targetScenario = scenarioId || this.activeScenarioId;
    const result = benchmarkRunner.runBenchmark(targetScenario);
    this.benchmarkComparison = result;

    this.eventEngine.emitEvent(
      "RECOMMENDATION_CREATED",
      `Benchmark Completed [${targetScenario}]: ${result.throughputImprovementPercent >= 0 ? "+" : ""}${result.throughputImprovementPercent}% throughput delta, ${result.delayReductionMinutes} min delay recovered vs Baseline`,
      this.simulationTime,
      "SUCCESS"
    );

    this.notify();
    return result;
  }

  private captureBaselinePreState(trainId: string, sectionIdOverride?: string): DecisionBaselinePreState {
    const train = this.trains.find((t) => t.id === trainId);
    const sectionId = sectionIdOverride || (train ? train.currentSection : "SEC-ND-GZB");
    const speed = train ? train.speed : 0;
    const delay = train ? train.delayMinutes : 0;
    const sectionThroughput =
      this.telemetry?.sectionUtilizations?.find((s) => s.sectionId === sectionId)?.sectionThroughput ?? 0;
    const sectionOccupancyCount = this.trains.filter(
      (t) => t.currentSection === sectionId && !t.completed && t.status !== "COMPLETED"
    ).length;
    const hasActiveConflict = this.activeConflicts.some(
      (c) => c.trainA === trainId || c.trainB === trainId || c.sectionA === sectionId || c.sectionB === sectionId
    );

    const priorityClass: "HIGH" | "STANDARD" | "FREIGHT" =
      train && train.priority >= 8 ? "HIGH" : train?.type === "FREIGHT" ? "FREIGHT" : "STANDARD";

    return {
      trainSpeed: speed,
      trainDelayMinutes: delay,
      sectionId,
      sectionThroughput,
      sectionOccupancyCount,
      hasActiveConflict,
      trainPriorityClass: priorityClass,
    };
  }

  /* =========================================================
     OPERATOR & ADVISOR ACTIONS
     ========================================================= */

  /**
   * Applies an AI recommendation directly to the live railway state.
   */
  public applyRecommendation(recommendationId: string): boolean {
    const rec = this.recommendations.find((r) => r.id === recommendationId);
    if (!rec || rec.status !== "PENDING") return false;

    const train = this.trains.find((t) => t.id === rec.affectedTrainId);
    if (!train) return false;

    // Capture pre-state baseline BEFORE mutating
    const preState = this.captureBaselinePreState(train.id, train.currentSection);

    switch (rec.action) {
      case "REDUCE_SPEED":
      case "INCREASE_SPEED":
      case "MAINTAIN_SPEED":
      case "GLIDE_SPEED":
        if (rec.targetSpeed !== undefined) {
          train.speed = rec.targetSpeed;
          train.targetSpeed = rec.targetSpeed;
          if ((train.status === "HELD" || train.status === "STOPPED") && rec.targetSpeed > 0) {
            train.status = "ON_TIME";
          }
        }
        break;

      case "HOLD_TRAIN":
        train.speed = 0;
        train.status = "HELD";
        break;

      case "PRIORITIZE_TRAIN":
        train.priority = Math.min(10, train.priority + 1);
        break;

      case "CLEAR_SECTION":
        if (train.speed < 60) {
          train.speed = 60;
        }
        break;

      default:
        break;
    }

    rec.status = "ACCEPTED";
    rec.appliedAt = this.simulationTime;
    this.appliedRecommendations.set(rec.id, rec);

    this.throughputEngine.recordRecommendationAccepted(rec);

    this.eventEngine.emitEvent(
      "RECOMMENDATION_APPLIED",
      `Operator applied recommendation ${rec.action} for ${train.name} (${train.id})`,
      this.simulationTime,
      "SUCCESS",
      train.id,
      "ADVISOR"
    );

    // Record structured decision audit trace (Phase 8B / 8C)
    this.recordDecision({
      id: `DEC-${rec.id}-${this.simulationTime}`,
      simulationTime: this.simulationTime,
      timestamp: Date.now(),
      eventType: "RECOMMENDATION_APPLIED",
      affectedTrainId: train.id,
      affectedSectionId: train.currentSection,
      action: rec.action,
      targetSpeed: rec.targetSpeed,
      reason: rec.reason,
      evaluationWindowSeconds: 30,
      preState,
      predictionAvailable: {
        horizonSeconds: this.predictionHorizonSeconds,
        projectedConflictsCount: this.predictedConflicts.length,
      },
      projectedImpact: {
        expectedThroughputImpact: rec.expectedThroughputImpact || 0,
        expectedDelayImpact: rec.expectedDelayImpact || 0,
        projectedDelayMinutes: rec.counterfactual?.projectedDelayMinutes ?? train.delayMinutes,
      },
      actualOutcome: undefined, // Explicitly undefined until measured at T0 + evaluationWindowSeconds
    });

    this.stateRevision++;
    this.evaluateAllEngines();
    this.notify();
    return true;
  }

  /**
   * Dismisses an AI recommendation with authoritative engine tracking.
   */
  public dismissRecommendation(recommendationId: string): boolean {
    const rec = this.recommendations.find((r) => r.id === recommendationId);
    if (!rec) return false;

    // Capture pre-state baseline BEFORE mutating
    const preState = this.captureBaselinePreState(rec.affectedTrainId, rec.affectedSectionId);

    rec.status = "DISMISSED";
    this.dismissedRecommendationIds.add(recommendationId);

    this.eventEngine.emitEvent(
      "RECOMMENDATION_CREATED",
      `Operator dismissed recommendation ${rec.action} for ${rec.affectedTrainId}`,
      this.simulationTime,
      "INFO",
      rec.affectedTrainId,
      "ADVISOR"
    );

    // Record dismissal decision trace (Phase 8B / 8C)
    this.recordDecision({
      id: `DEC-DISMISS-${rec.id}-${this.simulationTime}`,
      simulationTime: this.simulationTime,
      timestamp: Date.now(),
      eventType: "RECOMMENDATION_DISMISSED",
      affectedTrainId: rec.affectedTrainId,
      affectedSectionId: preState.sectionId,
      action: rec.action,
      targetSpeed: rec.targetSpeed,
      reason: `Operator dismissed recommendation ${rec.action}`,
      evaluationWindowSeconds: 30,
      preState,
      predictionAvailable: {
        horizonSeconds: this.predictionHorizonSeconds,
        projectedConflictsCount: this.predictedConflicts.length,
      },
      projectedImpact: {
        expectedThroughputImpact: 0,
        expectedDelayImpact: 0,
        projectedDelayMinutes: 0,
      },
      actualOutcome: undefined,
    });

    this.stateRevision++;
    this.evaluateAllEngines();
    this.notify();
    return true;
  }

  public overrideTrainSpeed(trainId: string, newSpeedKmH: number): void {
    const train = this.trains.find((t) => t.id === trainId);
    if (train) {
      // Capture pre-state baseline BEFORE mutating
      const preState = this.captureBaselinePreState(train.id, train.currentSection);
      const prevSpeed = train.speed;
      const clampedSpeed = Math.max(0, Math.min(newSpeedKmH, train.maxSpeed || 130));

      train.speed = clampedSpeed;
      train.targetSpeed = clampedSpeed;
      train.status = calculateTrainStatus(train, this.trains, this.activeConflicts, this.activeIncidents);

      this.eventEngine.emitEvent(
        "RECOMMENDATION_APPLIED",
        `Manual speed override for ${train.name}: ${prevSpeed} → ${clampedSpeed} km/h`,
        this.simulationTime,
        "INFO",
        train.id,
        "TRAIN"
      );

      // Record manual override decision trace (Phase 8B / 8C)
      this.recordDecision({
        id: `DEC-OVERRIDE-${train.id}-${this.simulationTime}`,
        simulationTime: this.simulationTime,
        timestamp: Date.now(),
        eventType: "MANUAL_SPEED_OVERRIDE",
        affectedTrainId: train.id,
        affectedSectionId: train.currentSection,
        action: "SPEED_ADVISORY",
        targetSpeed: clampedSpeed,
        reason: `Operator manual speed command (${clampedSpeed} km/h)`,
        evaluationWindowSeconds: 30,
        preState,
        predictionAvailable: {
          horizonSeconds: this.predictionHorizonSeconds,
          projectedConflictsCount: this.predictedConflicts.length,
        },
        projectedImpact: {
          expectedThroughputImpact: 0,
          expectedDelayImpact: 0,
          projectedDelayMinutes: train.delayMinutes,
        },
        actualOutcome: undefined, // Explicitly undefined until measured at T0 + evaluationWindowSeconds
      });

      this.stateRevision++;
      this.evaluateAllEngines();
      this.notify();
    }
  }

  public holdTrain(trainId: string): void {
    const train = this.trains.find((t) => t.id === trainId);
    if (train) {
      // Capture pre-state baseline BEFORE mutating
      const preState = this.captureBaselinePreState(train.id, train.currentSection);

      train.speed = 0;
      train.targetSpeed = 0;
      train.status = "HOLDING";

      this.eventEngine.emitEvent(
        "RECOMMENDATION_APPLIED",
        `Train ${train.name} held at current location by operator`,
        this.simulationTime,
        "WARNING",
        train.id,
        "TRAIN"
      );

      // Record hold decision trace (Phase 8B / 8C)
      this.recordDecision({
        id: `DEC-HOLD-${train.id}-${this.simulationTime}`,
        simulationTime: this.simulationTime,
        timestamp: Date.now(),
        eventType: "TRAIN_HOLD",
        affectedTrainId: train.id,
        affectedSectionId: train.currentSection,
        action: "HOLD_TRAIN",
        targetSpeed: 0,
        reason: `Operator held train ${train.id} at current location`,
        evaluationWindowSeconds: 30,
        preState,
        predictionAvailable: {
          horizonSeconds: this.predictionHorizonSeconds,
          projectedConflictsCount: this.predictedConflicts.length,
        },
        projectedImpact: {
          expectedThroughputImpact: -15,
          expectedDelayImpact: 2,
          projectedDelayMinutes: train.delayMinutes + 2,
        },
        actualOutcome: undefined,
      });

      this.stateRevision++;
      this.evaluateAllEngines();
      this.notify();
    }
  }

  public releaseTrain(trainId: string, speedKmH: number = 80): void {
    const train = this.trains.find((t) => t.id === trainId);
    if (train) {
      // Capture pre-state baseline BEFORE mutating
      const preState = this.captureBaselinePreState(train.id, train.currentSection);
      const clampedSpeed = Math.max(0, Math.min(speedKmH, train.maxSpeed || 130));

      train.speed = clampedSpeed;
      train.targetSpeed = clampedSpeed;
      train.status = calculateTrainStatus(train, this.trains, this.activeConflicts, this.activeIncidents);

      this.eventEngine.emitEvent(
        "RECOMMENDATION_APPLIED",
        `Train ${train.name} released to resume travel at ${clampedSpeed} km/h`,
        this.simulationTime,
        "SUCCESS",
        train.id,
        "TRAIN"
      );

      // Record release decision trace (Phase 8B / 8C)
      this.recordDecision({
        id: `DEC-RELEASE-${train.id}-${this.simulationTime}`,
        simulationTime: this.simulationTime,
        timestamp: Date.now(),
        eventType: "TRAIN_RELEASE",
        affectedTrainId: train.id,
        affectedSectionId: train.currentSection,
        action: "SPEED_ADVISORY",
        targetSpeed: clampedSpeed,
        reason: `Operator released train ${train.id} at ${clampedSpeed} km/h`,
        evaluationWindowSeconds: 30,
        preState,
        predictionAvailable: {
          horizonSeconds: this.predictionHorizonSeconds,
          projectedConflictsCount: this.predictedConflicts.length,
        },
        projectedImpact: {
          expectedThroughputImpact: 10,
          expectedDelayImpact: -1,
          projectedDelayMinutes: Math.max(0, train.delayMinutes - 1),
        },
        actualOutcome: undefined,
      });

      this.stateRevision++;
      this.evaluateAllEngines();
      this.notify();
    }
  }

  /**
   * Internal authoritative executor for constituent actions within a Disruption Recovery Plan (Phase 10 Step 5.2).
   * Directly sets train kinematics, records a DecisionAuditRecord tagged with strategyId, and avoids false supersession.
   */
  private applyRecoveryAction(
    trainId: string,
    action: string,
    targetSpeed: number | undefined,
    recoveryPlanId: string
  ): string | undefined {
    const train = this.trains.find((t) => t.id === trainId);
    if (!train) return undefined;

    const preState = this.captureBaselinePreState(train.id, train.currentSection);
    const prevSpeed = train.speed;

    if (action === "HOLD_TRAIN") {
      train.speed = 0;
      train.status = "HELD";
    } else if (targetSpeed !== undefined) {
      train.speed = Math.max(0, targetSpeed);
      train.targetSpeed = targetSpeed;
      if ((train.status === "HELD" || train.status === "STOPPED") && targetSpeed > 0) {
        train.status = "ON_TIME";
      }
    }

    const decisionId = `DEC-REC-${train.id}-${this.simulationTime.toFixed(0)}-${this.decisionHistory.length}`;
    const decisionRecord: DecisionAuditRecord = {
      id: decisionId,
      simulationTime: this.simulationTime,
      timestamp: Date.now(),
      eventType: "RECOMMENDATION_APPLIED",
      affectedTrainId: train.id,
      affectedSectionId: train.currentSection,
      action: action,
      targetSpeed: targetSpeed,
      reason: `Recovery plan action ${action} for ${train.name} (${recoveryPlanId})`,
      evaluationWindowSeconds: 30,
      preState,
      predictionAvailable: {
        horizonSeconds: this.predictionHorizonSeconds,
        projectedConflictsCount: this.predictedConflicts.length,
      },
      projectedImpact: {
        expectedThroughputImpact: 0,
        expectedDelayImpact: 0,
        projectedDelayMinutes: train.delayMinutes,
      },
      strategyId: recoveryPlanId,
      actualOutcome: undefined,
    };

    this.recordDecision(decisionRecord);
    return decisionId;
  }

  /**
   * Authoritative execution gateway for Coordinated Multi-Train Strategies (Phase 9).
   * Verifies strategy provenance, state revision freshness, re-runs authoritative live safety validation,
   * executes constituent actions through existing action pathways, captures Phase 8C baseline BEFORE mutation,
   * creates linked strategy audit record, and invalidates optimizer state.
   */
  public dispatchStrategy(strategyId: string): boolean {
    const strategy = this.availableStrategies.find((s) => s.strategyId === strategyId);
    if (!strategy || strategy.executionStatus !== "PROPOSED") {
      return false;
    }

    // 1. Staleness verification: check state revision
    if (strategy.stateRevisionAtGeneration !== this.stateRevision) {
      strategy.executionStatus = "STALE_REJECTED";
      this.eventEngine.emitEvent(
        "RECOMMENDATION_CREATED",
        `Strategy ${strategy.name} rejected: stale state revision (${strategy.stateRevisionAtGeneration} vs current ${this.stateRevision})`,
        this.simulationTime,
        "WARNING"
      );
      return false;
    }

    // 2. Authoritative Live Safety Check: verify all participating trains exist and are active
    for (const item of strategy.constituentActions) {
      const train = this.trains.find((t) => t.id === item.trainId);
      if (!train || train.completed || train.status === "COMPLETED") {
        strategy.executionStatus = "STALE_REJECTED";
        return false;
      }
    }

    // 3. Capture Strategy Pre-State Baseline BEFORE mutating
    const preState = {
      corridorThroughput: this.throughputMetrics.corridorThroughput,
      totalActiveDelayMinutes: this.trains.reduce((acc, t) => acc + t.delayMinutes, 0),
      activeConflictCount: this.activeConflicts.length,
      bottleneckSection: this.throughputMetrics.bottleneckSection,
    };

    const constituentAuditIds: string[] = [];

    // 4. Atomically execute constituent actions through existing authoritative pathways
    for (const item of strategy.constituentActions) {
      const act = item.candidateAction;
      if (act.action === "HOLD_TRAIN") {
        this.holdTrain(item.trainId);
      } else if (
        act.action === "INCREASE_SPEED" ||
        act.action === "REDUCE_SPEED" ||
        act.action === "GLIDE_SPEED" ||
        act.action === "MAINTAIN_SPEED"
      ) {
        if (act.targetSpeed !== undefined) {
          this.overrideTrainSpeed(item.trainId, act.targetSpeed);
        }
      }

      // Link newly recorded DecisionAuditRecord to strategyId
      const latestAudit = this.decisionHistory[this.decisionHistory.length - 1];
      if (latestAudit) {
        latestAudit.strategyId = strategy.strategyId;
        constituentAuditIds.push(latestAudit.id);
      }
    }

    // 5. Create Strategy-Level Audit Record (Phase 8C Linkage)
    const auditRecord: CoordinatedStrategyAuditRecord = {
      id: `STRATAUDIT-${strategy.strategyId}-${this.simulationTime.toFixed(0)}`,
      strategyId: strategy.strategyId,
      planType: strategy.planType,
      dispatchedSimulationTime: this.simulationTime,
      evaluationWindowSeconds: 30,
      participatingTrainIds: strategy.targetTrainIds,
      constituentDecisionAuditIds: constituentAuditIds,
      preState,
      projectedImpact: strategy.predictedImpact,
    };

    this.strategyAuditHistory.push(auditRecord);
    if (this.strategyAuditHistory.length > 50) {
      this.strategyAuditHistory.shift();
    }

    strategy.executionStatus = "EXECUTED";
    strategy.phase8CAuditLinkage.auditRecordId = auditRecord.id;
    strategy.phase8CAuditLinkage.constituentDecisionAuditIds = constituentAuditIds;
    strategy.phase8CAuditLinkage.dispatchedSimulationTime = this.simulationTime;

    this.eventEngine.emitEvent(
      "RECOMMENDATION_APPLIED",
      `Authorized & Dispatched Coordinated Strategy: ${strategy.name}`,
      this.simulationTime,
      "SUCCESS"
    );

    this.invalidateOptimization();
    this.notify();
    return true;
  }

  /**
   * Dismisses a Coordinated Strategy with authoritative tracking.
   */
  public dismissStrategy(strategyId: string): boolean {
    const strategy = this.availableStrategies.find((s) => s.strategyId === strategyId);
    if (!strategy || strategy.executionStatus !== "PROPOSED") {
      return false;
    }

    strategy.executionStatus = "DISMISSED";
    this.eventEngine.emitEvent(
      "RECOMMENDATION_CREATED",
      `Dismissed Coordinated Strategy: ${strategy.name}`,
      this.simulationTime,
      "INFO"
    );

    this.invalidateOptimization();
    this.notify();
    return true;
  }

  /* =========================================================
     INCIDENT & DISRUPTION MANAGEMENT (PHASE 10)
     ========================================================= */

  public getActiveIncidents(): ActiveIncident[] {
    return structuredClone(this.activeIncidents);
  }

  /**
   * Authoritatively declares an operational incident or disruption.
   */
  public declareIncident(incident: ActiveIncident): boolean {
    // 1. Validate affected section exists
    const sectionExists = this.sections.some((s) => s.id === incident.affectedSectionId);
    if (!sectionExists) {
      console.warn(`[SimulationEngine] declareIncident rejected: Section ${incident.affectedSectionId} does not exist.`);
      return false;
    }

    // 2. Validate affected signal exists if specified
    if (incident.affectedSignalId) {
      const signalExists = this.signals.some((sig) => sig.id === incident.affectedSignalId);
      if (!signalExists) {
        console.warn(`[SimulationEngine] declareIncident rejected: Signal ${incident.affectedSignalId} does not exist.`);
        return false;
      }
    }

    // 3. Validate TSR speed
    if (incident.type === "TEMPORARY_SPEED_RESTRICTION") {
      if (
        incident.imposedSpeedLimitKmH === undefined ||
        incident.imposedSpeedLimitKmH <= 0 ||
        isNaN(incident.imposedSpeedLimitKmH)
      ) {
        console.warn(`[SimulationEngine] declareIncident rejected: Invalid TSR speed limit ${incident.imposedSpeedLimitKmH}.`);
        return false;
      }
    }

    // 4. Validate complete blockage
    if (incident.type === "TRACK_SECTION_BLOCKAGE" && !incident.isCompleteBlockage) {
      incident.isCompleteBlockage = true;
    }

    // 5. Store/overlay incident state
    const existingIdx = this.activeIncidents.findIndex((inc) => inc.id === incident.id);
    if (existingIdx >= 0) {
      this.activeIncidents[existingIdx] = structuredClone(incident);
    } else {
      this.activeIncidents.push(structuredClone(incident));
    }

    // 6. Emit event
    this.eventEngine.emitEvent(
      "INCIDENT_DECLARED",
      `Incident Declared [${incident.severity}]: ${incident.type} on ${incident.affectedSectionId} - ${incident.reason}`,
      this.simulationTime,
      incident.severity === "CRITICAL" || incident.severity === "SEVERE" ? "CRITICAL" : "WARNING",
      incident.affectedSectionId,
      "INCIDENT"
    );

    // 7. Invalidate optimization and trigger full evaluation
    this.invalidateOptimization();
    this.evaluateAllEngines();
    this.notify();
    return true;
  }

  /**
   * Authoritatively clears an active operational incident.
   */
  public clearIncident(incidentId: string): boolean {
    const incident = this.activeIncidents.find((inc) => inc.id === incidentId);
    if (!incident) {
      return false;
    }

    incident.status = "RESOLVED_CLOSED";
    incident.actualClearedSimulationSeconds = this.simulationTime;

    // Retain in history for post-clearance audit linkage
    this.clearedIncidentsHistory.push(structuredClone(incident));
    if (this.clearedIncidentsHistory.length > 50) {
      this.clearedIncidentsHistory.shift();
    }

    // Filter out resolved incident
    this.activeIncidents = this.activeIncidents.filter((inc) => inc.id !== incidentId);

    // Emit event
    this.eventEngine.emitEvent(
      "INCIDENT_CLEARED",
      `Incident Resolved & Cleared: ${incident.type} on ${incident.affectedSectionId}`,
      this.simulationTime,
      "SUCCESS",
      incident.affectedSectionId,
      "INCIDENT"
    );

    // Evaluate active recovery executions immediately upon clearance
    this.evaluateActiveRecoveryExecutions();

    // Invalidate optimization and trigger full evaluation
    this.invalidateOptimization();
    this.evaluateAllEngines();
    this.notify();
    return true;
  }

  /**
   * Authoritative execution gateway for Disruption Recovery Plans (Phase 10 Step 5.2).
   * Validates safety status, atomicity, creates execution state and audit record,
   * evaluates Phase 1 containment actions via existing authoritative pathways,
   * updates plan execution status to "AUTHORIZED", and invalidates optimization state.
   */
  public dispatchRecoveryPlan(recoveryPlanId: string): boolean {
    const plan = this.recoveryPlans.find((p) => p.recoveryPlanId === recoveryPlanId);
    if (!plan || plan.executionStatus !== "PROPOSED") {
      return false;
    }

    // Reject duplicate authorization
    if (this.activeRecoveryExecutions.has(recoveryPlanId) || this.authorizedRecoveryPlanIds.has(recoveryPlanId)) {
      return false;
    }

    // Verify associated incident exists and is not closed
    const incident = this.activeIncidents.find((inc) => inc.id === plan.associatedIncidentId);
    if (!incident || incident.status === "RESOLVED_CLOSED") {
      return false;
    }

    if (plan.safetyStatus !== "VERIFIED_SAFE") {
      console.warn(`[SimulationEngine] dispatchRecoveryPlan rejected: Plan ${recoveryPlanId} is not VERIFIED_SAFE.`);
      return false;
    }

    // Revalidate constituent actions against CURRENT live train states
    for (const phase of plan.stagingPhases) {
      for (const act of phase.actions) {
        const train = this.trains.find((t) => t.id === act.trainId);
        if (!train || train.completed || train.status === "COMPLETED") {
          return false;
        }
      }
    }

    // 1. Create initial DisruptionRecoveryAuditRecord (Phase 8C Linkage)
    const auditRecordId = `RECAUDIT-${plan.recoveryPlanId}-${this.simulationTime.toFixed(0)}`;
    const phaseResults: RecoveryPhaseExecutionResult[] = plan.stagingPhases.map((phase) => ({
      phaseNumber: phase.phaseNumber,
      phaseName: phase.phaseName,
      status: phase.triggerCondition === "IMMEDIATE" ? "ACTIVE" : "PENDING",
      triggerCondition: phase.triggerCondition,
      actionsCount: phase.actions.length,
      executedAtSimulationTime: undefined,
      completedAtSimulationTime: undefined,
    }));

    const recoveryAudit: DisruptionRecoveryAuditRecord = {
      id: auditRecordId,
      recoveryPlanId: plan.recoveryPlanId,
      associatedIncidentId: plan.associatedIncidentId,
      incidentType: incident.type,
      incidentSeverity: incident.severity,
      affectedSectionId: incident.affectedSectionId,
      dispatchedSimulationTime: this.simulationTime,
      incidentStartSimulationTime: incident.startTimeSimulationSeconds,
      incidentClearedSimulationTime: incident.actualClearedSimulationSeconds,
      recoveryCompletedSimulationTime: undefined,
      projectedRecoveryTimeSeconds: plan.projectedRecoveryTimeSeconds,
      actualRecoveryTimeSeconds: undefined,
      projectedResidualDelayMinutes: plan.projectedResidualDelayMinutes,
      actualResidualDelayMinutes: undefined,
      peakDisruptionDelayMinutes: Math.max(0, ...this.trains.map((t) => t.delayMinutes)),
      preIncidentCorridorThroughput: this.throughputMetrics ? this.throughputMetrics.corridorThroughput : 0,
      preIncidentTotalDelayMinutes: this.trains.reduce((acc, t) => acc + t.delayMinutes, 0),
      recoveryCorridorThroughput: undefined,
      constituentDecisionAuditIds: [],
      phaseExecutionResults: phaseResults,
      verificationStatus: "PENDING",
      attributionType: "DIRECT",
    };

    this.recoveryAuditHistory.push(recoveryAudit);
    if (this.recoveryAuditHistory.length > 50) {
      this.recoveryAuditHistory.shift();
    }

    // 2. Create ActiveRecoveryExecutionState
    const phaseStatuses: Record<number, RecoveryPhaseExecutionStatus> = {};
    for (const p of plan.stagingPhases) {
      phaseStatuses[p.phaseNumber] = p.triggerCondition === "IMMEDIATE" ? "ACTIVE" : "PENDING";
    }

    const executionState: ActiveRecoveryExecutionState = {
      recoveryPlanId: plan.recoveryPlanId,
      incidentId: plan.associatedIncidentId,
      currentPhaseNumber: 1,
      totalPhases: plan.stagingPhases.length,
      authorizedSimulationTime: this.simulationTime,
      lastPhaseTransitionSimulationTime: this.simulationTime,
      phaseStatuses,
      constituentDecisionAuditIds: [],
      auditRecordId,
      isSuperseded: false,
      isCompleted: false,
    };

    this.activeRecoveryExecutions.set(plan.recoveryPlanId, executionState);
    this.authorizedRecoveryPlanIds.add(recoveryPlanId);
    this.authorizedRecoveryPlanIds.add(plan.associatedIncidentId);
    this.dismissedRecoveryPlanIds.delete(recoveryPlanId);
    plan.executionStatus = "AUTHORIZED";

    // 3. Execute Phase 1 (IMMEDIATE) atomically through evaluateActiveRecoveryExecutions
    this.evaluateActiveRecoveryExecutions();

    this.eventEngine.emitEvent(
      "RECOMMENDATION_APPLIED",
      `Operator authorized Disruption Recovery Plan: ${plan.name} (${plan.associatedIncidentId})`,
      this.simulationTime,
      "SUCCESS",
      plan.associatedIncidentId,
      "INCIDENT"
    );

    this.invalidateOptimization();
    this.notify();
    return true;
  }

  public authorizeRecoveryPlan(recoveryPlanId: string): boolean {
    return this.dispatchRecoveryPlan(recoveryPlanId);
  }

  /**
   * Deterministic check for corridor headway stabilization after incident clearance.
   */
  private isCorridorHeadwayStabilized(participatingTrainIds: string[]): boolean {
    const hasActiveConflict = this.activeConflicts.some(
      (c) => participatingTrainIds.includes(c.trainA) || participatingTrainIds.includes(c.trainB)
    );
    if (hasActiveConflict) return false;

    const activeTrains = this.trains.filter(
      (t) => participatingTrainIds.includes(t.id) && !t.completed && t.status !== "COMPLETED"
    );
    if (activeTrains.length <= 1) return true;

    return activeTrains.every((t) => t.status !== "HELD" && t.status !== "CRITICAL");
  }

  /**
   * Authoritative staged recovery execution and closed-loop verification evaluator (Phase 10 Step 5.2).
   */
  public evaluateActiveRecoveryExecutions(): void {
    const sortedExecutions = Array.from(this.activeRecoveryExecutions.entries()).sort(
      ([idA], [idB]) => idA.localeCompare(idB)
    );

    for (const [recoveryPlanId, executionState] of sortedExecutions) {
      if (executionState.isCompleted || executionState.isSuperseded) continue;

      const plan = this.recoveryPlans.find((p) => p.recoveryPlanId === recoveryPlanId);
      if (!plan) continue;

      const auditRecord = this.recoveryAuditHistory.find((a) => a.id === executionState.auditRecordId);
      if (!auditRecord) continue;

      const incident =
        this.activeIncidents.find((i) => i.id === executionState.incidentId) ||
        this.clearedIncidentsHistory.find((i) => i.id === executionState.incidentId);

      const isIncidentCleared =
        !this.activeIncidents.some((i) => i.id === executionState.incidentId) ||
        incident?.status === "RESOLVED_CLOSED";

      if (isIncidentCleared && auditRecord.incidentClearedSimulationTime === undefined) {
        auditRecord.incidentClearedSimulationTime =
          incident?.actualClearedSimulationSeconds ?? this.simulationTime;
      }

      // Check if manual intervention superseded this plan
      const participatingTrainIds = Array.from(
        new Set(plan.stagingPhases.flatMap((ph) => ph.actions.map((a) => a.trainId)))
      );

      const manualOverrideOccurred = this.decisionHistory.some(
        (d) =>
          d.simulationTime >= executionState.authorizedSimulationTime &&
          !executionState.constituentDecisionAuditIds.includes(d.id) &&
          participatingTrainIds.includes(d.affectedTrainId) &&
          (d.eventType === "MANUAL_SPEED_OVERRIDE" || d.eventType === "TRAIN_HOLD") &&
          d.strategyId !== plan.recoveryPlanId
      );

      if (manualOverrideOccurred) {
        executionState.isSuperseded = true;
        executionState.supersededReason = "Intervening manual operator intervention on participating train";
        for (const phase of plan.stagingPhases) {
          if (
            executionState.phaseStatuses[phase.phaseNumber] === "PENDING" ||
            executionState.phaseStatuses[phase.phaseNumber] === "ACTIVE"
          ) {
            executionState.phaseStatuses[phase.phaseNumber] = "SUPERSEDED";
            const pr = auditRecord.phaseExecutionResults.find((r) => r.phaseNumber === phase.phaseNumber);
            if (pr) pr.status = "SUPERSEDED";
          }
        }
        auditRecord.attributionType = "SUPERSEDED";
        auditRecord.verificationStatus = "INCONCLUSIVE";
        auditRecord.varianceNotes = "Recovery plan superseded by subsequent manual operator action";
        continue;
      }

      // Evaluate phases sequentially in deterministic order
      const sortedPhases = [...plan.stagingPhases].sort((a, b) => a.phaseNumber - b.phaseNumber);
      for (const phase of sortedPhases) {
        const currentStatus = executionState.phaseStatuses[phase.phaseNumber];
        const phaseResult = auditRecord.phaseExecutionResults.find(
          (r) => r.phaseNumber === phase.phaseNumber
        );

        if (
          currentStatus === "COMPLETED" ||
          currentStatus === "BLOCKED" ||
          currentStatus === "FAILED" ||
          currentStatus === "SUPERSEDED"
        ) {
          continue;
        }

        // Check Trigger Condition
        let triggerSatisfied = false;
        if (phase.triggerCondition === "IMMEDIATE") {
          triggerSatisfied = true;
        } else if (phase.triggerCondition === "ON_INCIDENT_CLEARANCE") {
          triggerSatisfied = isIncidentCleared;
        } else if (phase.triggerCondition === "HEADWAY_STABILIZED") {
          const priorPhasesCompleted = plan.stagingPhases
            .filter((p) => p.phaseNumber < phase.phaseNumber)
            .every((p) => executionState.phaseStatuses[p.phaseNumber] === "COMPLETED");

          triggerSatisfied =
            isIncidentCleared &&
            priorPhasesCompleted &&
            this.isCorridorHeadwayStabilized(participatingTrainIds);
        }

        if (!triggerSatisfied) {
          break; // Stop evaluating future phases
        }

        // Trigger is satisfied: Perform ATOMIC validation of all actions in this phase
        let isPhaseSafeAndValid = true;
        const sortedActions = [...phase.actions].sort(
          (a, b) =>
            a.trainId.localeCompare(b.trainId) ||
            a.candidateAction.id.localeCompare(b.candidateAction.id)
        );

        for (const actItem of sortedActions) {
          const train = this.trains.find((t) => t.id === actItem.trainId);
          if (!train || train.completed || train.status === "COMPLETED") {
            isPhaseSafeAndValid = false;
            break;
          }
          if (actItem.candidateAction.targetSpeed !== undefined) {
            const effectiveLimit = this.getEffectiveSectionSpeedLimit(train.currentSection);
            if (effectiveLimit > 0 && actItem.candidateAction.targetSpeed > effectiveLimit) {
              isPhaseSafeAndValid = false;
              break;
            }
          }
        }

        if (!isPhaseSafeAndValid) {
          executionState.phaseStatuses[phase.phaseNumber] = "BLOCKED";
          if (phaseResult) {
            phaseResult.status = "BLOCKED";
          }
          auditRecord.varianceNotes = `Recovery Phase ${phase.phaseNumber} blocked: constituent action constraint violation`;
          break;
        }

        // ALL constituent actions valid: Execute ATOMICALLY
        for (const actItem of sortedActions) {
          const cand = actItem.candidateAction;
          const decisionId = this.applyRecoveryAction(
            actItem.trainId,
            cand.action,
            cand.targetSpeed,
            plan.recoveryPlanId
          );

          if (decisionId) {
            if (!executionState.constituentDecisionAuditIds.includes(decisionId)) {
              executionState.constituentDecisionAuditIds.push(decisionId);
            }
            if (!auditRecord.constituentDecisionAuditIds.includes(decisionId)) {
              auditRecord.constituentDecisionAuditIds.push(decisionId);
            }
          }
        }

        executionState.phaseStatuses[phase.phaseNumber] = "COMPLETED";
        if (phaseResult) {
          phaseResult.status = "COMPLETED";
          phaseResult.executedAtSimulationTime = this.simulationTime;
          phaseResult.completedAtSimulationTime = this.simulationTime;
        }
        executionState.currentPhaseNumber = phase.phaseNumber + 1;
        executionState.lastPhaseTransitionSimulationTime = this.simulationTime;

        this.eventEngine.emitEvent(
          "RECOMMENDATION_APPLIED",
          `Executed Recovery Phase ${phase.phaseNumber} (${phase.phaseName}) for Plan ${plan.name}`,
          this.simulationTime,
          "SUCCESS",
          plan.associatedIncidentId,
          "INCIDENT"
        );
      }

      // Check if all phases completed
      const allDone = plan.stagingPhases.every(
        (p) => executionState.phaseStatuses[p.phaseNumber] === "COMPLETED"
      );

      if (allDone && !executionState.isCompleted) {
        executionState.isCompleted = true;
        auditRecord.recoveryCompletedSimulationTime = this.simulationTime;
        auditRecord.actualRecoveryTimeSeconds = Number(
          (this.simulationTime - executionState.authorizedSimulationTime).toFixed(1)
        );
        auditRecord.recoveryCorridorThroughput = this.throughputMetrics ? this.throughputMetrics.corridorThroughput : 0;
        const currentTotalDelay = this.trains.reduce((acc, t) => acc + t.delayMinutes, 0);
        auditRecord.actualResidualDelayMinutes = Number(currentTotalDelay.toFixed(2));

        // Causal attribution determination (Step 5.3)
        const otherCorridorActions = this.decisionHistory.filter(
          (d) =>
            !executionState.constituentDecisionAuditIds.includes(d.id) &&
            d.simulationTime >= executionState.authorizedSimulationTime &&
            d.simulationTime <= this.simulationTime
        );

        let attributionType: RecoveryAttributionType = "DIRECT";
        if (otherCorridorActions.length > 0) {
          attributionType = "SHARED_OVERLAP";
        }
        auditRecord.attributionType = attributionType;

        // Verification status determination (Step 5.3)
        const delayMet =
          auditRecord.actualResidualDelayMinutes <=
          Math.max(plan.projectedResidualDelayMinutes + 2.0, plan.projectedResidualDelayMinutes * 1.25);
        const timeMet =
          auditRecord.actualRecoveryTimeSeconds <= plan.projectedRecoveryTimeSeconds + 60;

        if (delayMet && timeMet) {
          auditRecord.verificationStatus = "VERIFIED_ACCURATE";
          auditRecord.varianceNotes = "Recovery plan executed to completion within projected bounds";
        } else {
          auditRecord.verificationStatus = "DEVIATED";
          auditRecord.varianceNotes = `Recovery outcome deviated: actual residual delay ${auditRecord.actualResidualDelayMinutes}m vs projected ${plan.projectedResidualDelayMinutes}m`;
        }

        // Feed completed recovery audit outcome to AdaptiveDecisionEngine (Phase 10 Step 5.3)
        this.adaptiveEngine.recordRecoveryOutcome(auditRecord);

        this.eventEngine.emitEvent(
          "RECOMMENDATION_APPLIED",
          `Disruption Recovery Plan completed: ${plan.name} in ${auditRecord.actualRecoveryTimeSeconds}s [${auditRecord.verificationStatus}]`,
          this.simulationTime,
          "SUCCESS",
          plan.associatedIncidentId,
          "INCIDENT"
        );
      }
    }
  }

  /**
   * Dismisses a proposed Disruption Recovery Plan without dispatching actions.
   */
  public dismissRecoveryPlan(recoveryPlanId: string): boolean {
    const plan = this.recoveryPlans.find((p) => p.recoveryPlanId === recoveryPlanId);
    if (!plan || plan.executionStatus !== "PROPOSED") {
      return false;
    }

    this.dismissedRecoveryPlanIds.add(recoveryPlanId);
    this.authorizedRecoveryPlanIds.delete(recoveryPlanId);
    plan.executionStatus = "DISMISSED";

    this.eventEngine.emitEvent(
      "RECOMMENDATION_APPLIED",
      `Operator dismissed Recovery Plan: ${plan.name}`,
      this.simulationTime,
      "INFO",
      plan.associatedIncidentId,
      "INCIDENT"
    );

    this.invalidateOptimization();
    this.notify();
    return true;
  }

  /**
   * Computes the operational effective speed limit for a section,
   * factoring in active TSR incidents without modifying permanent limits.
   */
  public getEffectiveSectionSpeedLimit(sectionId: string): number {
    const section = this.sections.find((s) => s.id === sectionId);
    if (!section) return 0;

    const permanentLimit = section.maximumSpeed;

    const activeTSRs = this.activeIncidents.filter(
      (inc) =>
        inc.affectedSectionId === sectionId &&
        inc.type === "TEMPORARY_SPEED_RESTRICTION" &&
        inc.status !== "RESOLVED_CLOSED" &&
        inc.imposedSpeedLimitKmH !== undefined &&
        inc.imposedSpeedLimitKmH > 0
    );

    if (activeTSRs.length === 0) {
      return permanentLimit;
    }

    const strictestTSR = Math.min(...activeTSRs.map((tsr) => tsr.imposedSpeedLimitKmH!));
    return Math.min(permanentLimit, strictestTSR);
  }

  /* =========================================================
     SUBSCRIPTION & SNAPSHOT
     ========================================================= */

  public subscribe(listener: (snapshot: SimulationSnapshot) => void): () => void {
    this.listeners.push(listener);
    listener(this.getSnapshot());

    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  public getSnapshot(): SimulationSnapshot {
    const currentScenario =
      operationalScenarios.find((s) => s.id === this.activeScenarioId) || operationalScenarios[0];
    const activeRoutes = Array.from(new Set(this.sections.map((s) => s.id)));

    const throughputAndTelemetry = this.throughputEngine.computeMetrics(
      this.trains,
      this.sections,
      this.signals,
      this.activeConflicts,
      this.predictedConflicts,
      this.simulationTime
    );

    return {
      simulationTime: Number(this.simulationTime.toFixed(1)),
      simulationRunning: this.running,
      running: this.running,
      simulationSpeedMultiplier: this.speedMultiplier,
      speedMultiplier: this.speedMultiplier,
      activeScenarioId: this.activeScenarioId,
      scenario: structuredClone(currentScenario),
      availableScenarios: operationalScenarios,
      predictionHorizonSeconds: this.predictionHorizonSeconds,
      trains: structuredClone(this.trains),
      activeTrains: structuredClone(
        this.trains.filter((t) => !t.completed && t.status !== "COMPLETED" && t.speed > 0)
      ),
      signals: structuredClone(this.signals),
      sections: structuredClone(this.sections),
      blocks: structuredClone(this.blocks),
      stations: structuredClone(this.stations),
      junctions: structuredClone(this.junctions),
      routes: activeRoutes,
      topology: corridorTopology,
      conflicts: structuredClone(this.activeConflicts),
      predictedConflicts: structuredClone(this.predictedConflicts),
      networkHealth: this.networkHealth,
      networkCapacity: this.networkCapacity,
      throughput: this.throughputMetrics ? this.throughputMetrics.corridorThroughput : 0,
      averageDelay: this.averageDelay,
      occupiedBlocks: structuredClone(this.occupiedBlocks),
      clearBlocks: structuredClone(this.blocks.filter((b) => b.status === "AVAILABLE")),
      congestedSections: structuredClone(this.congestedSections),
      advisorRecommendations: structuredClone(this.recommendations),
      recommendations: structuredClone(this.recommendations),
      throughputMetrics: structuredClone(this.throughputMetrics || throughputAndTelemetry.throughput),
      telemetry: structuredClone(throughputAndTelemetry.telemetry),
      networkAssessment: structuredClone(this.networkAssessment),
      aiScore: this.networkAssessment ? this.networkAssessment.efficiencyScore : 100,
      aiScoreBreakdown: this.networkAssessment?.aiScoreBreakdown
        ? structuredClone(this.networkAssessment.aiScoreBreakdown)
        : undefined,
      predictedForwardState: this.predictedForwardState
        ? structuredClone(this.predictedForwardState)
        : undefined,
      selectedTimelineOffset: this.selectedTimelineOffset,
      decisionHistory: structuredClone(this.decisionHistory),
      availableStrategies: structuredClone(this.availableStrategies),
      strategyAuditHistory: structuredClone(this.strategyAuditHistory),
      activeIncidents: structuredClone(this.activeIncidents),
      recoveryPlans: structuredClone(this.recoveryPlans),
      activeRecoveryExecutions: Array.from(this.activeRecoveryExecutions.values()).map((e) => structuredClone(e)),
      recoveryAuditHistory: structuredClone(this.recoveryAuditHistory),
      events: this.eventEngine.getRecentEvents(50),
      benchmarkComparison: this.benchmarkComparison ? structuredClone(this.benchmarkComparison) : undefined,
    };
  }

  /* =========================================================
     SIMULATION STEP (TICK)
     ========================================================= */

  public step(secondsPassed?: number): void {
    const dt =
      secondsPassed !== undefined
        ? secondsPassed
        : (this.config.tickIntervalMs / 1000) * this.speedMultiplier;

    this.simulationTime += dt;

    // 1. Step train physics
    this.trains = this.trains.map((train) =>
      this.updateTrainPhysics(train, dt)
    );

    // 2. Continuous high-frequency safety engines (occupancy, signals, conflicts, telemetry flux)
    this.evaluatePerTickEngines();

    // 3. Closed-loop decision verification (Phase 8C observational outcome measurement)
    this.evaluatePendingDecisions();

    // 4. Staged recovery plan execution & closed-loop verification (Phase 10 Step 5.2)
    this.evaluateActiveRecoveryExecutions();

    // 5. Decoupled predictive optimization (scheduled cadence + event invalidation)
    this.evaluatePeriodicOptimization();

    // 6. Update conflict-free tracking
    this.throughputEngine.updateConflictFreeTime(dt, this.activeConflicts.length > 0);

    // 7. Notify subscribers
    this.notify();
  }

  private tick(): void {
    this.step();
  }

  private updateTrainPhysics(train: Train, secondsPassed: number): Train {
    if (
      train.status === "CRITICAL" ||
      train.status === "HELD" ||
      train.status === "STOPPED" ||
      train.status === "COMPLETED" ||
      train.completed
    ) {
      const updatedStatus = calculateTrainStatus(train, this.trains, this.activeConflicts, this.activeIncidents);
      return {
        ...train,
        status: updatedStatus,
        delay: train.delayMinutes,
        progress: train.position,
        totalTravelTimeSeconds: (train.totalTravelTimeSeconds || 0) + secondsPassed,
      };
    }

    const sectionRange =
      corridorTopology.sectionMap[train.currentSection] ||
      (multiLineSections as Record<string, any>)[train.currentSection];
    if (!sectionRange) return train;

    const effectiveSectionLimit = this.getEffectiveSectionSpeedLimit(train.currentSection);
    const speedKmh = Math.max(0, Math.min(Number(train.speed) || 0, train.maxSpeed || 130));

    // Natural deceleration if current speed exceeds active section TSR limit
    const regulatedSpeedKmh =
      effectiveSectionLimit > 0 && speedKmh > effectiveSectionLimit
        ? Math.max(effectiveSectionLimit, speedKmh - 10 * secondsPassed)
        : speedKmh;

    const distanceTravelledKm = (regulatedSpeedKmh * secondsPassed) / 3600;

    this.throughputEngine.addDistanceTravelled(distanceTravelledKm);

    let distanceInsideSectionKm =
      (train.position / 100) * sectionRange.lengthKm + distanceTravelledKm;

    let currentSectionId = train.currentSection;
    let currentLength = sectionRange.lengthKm;
    let completed = false;

    // Handle section boundary crossing
    while (distanceInsideSectionKm >= currentLength) {
      const nextSectionId = resolveNextSection(currentSectionId);

      if (!nextSectionId) {
        // Reached end of corridor (destination terminus)
        distanceInsideSectionKm = currentLength;
        completed = true;
        this.throughputEngine.recordSectionExit(currentSectionId);
        this.throughputEngine.recordTrainCompletion({
          trainId: train.id,
          trainName: train.name,
          completedAt: this.simulationTime,
          totalTravelTimeSeconds: (train.totalTravelTimeSeconds || 0) + secondsPassed,
          finalDelayMinutes: train.delayMinutes,
          origin: train.origin,
          destination: train.destination,
          averageSpeedKmH: train.speed,
        });

        this.eventEngine.emitEvent(
          "TRAIN_COMPLETED",
          `Train ${train.name} (${train.id}) completed corridor journey at Saharanpur Terminus`,
          this.simulationTime,
          "SUCCESS",
          train.id,
          "TRAIN"
        );
        this.stateRevision++;
        break;
      }

      // Absolute block interlocking protection: prevent entry into occupied or blocked downstream section
      const isNextOccupied = this.trains.some(
        (t) =>
          t.id !== train.id &&
          t.currentSection === nextSectionId &&
          !t.completed &&
          t.status !== "COMPLETED"
      );

      const isNextBlocked = this.activeIncidents.some(
        (inc) =>
          inc.affectedSectionId === nextSectionId &&
          (inc.type === "TRACK_SECTION_BLOCKAGE" || inc.isCompleteBlockage) &&
          inc.status !== "RESOLVED_CLOSED"
      );

      if (isNextOccupied || isNextBlocked) {
        distanceInsideSectionKm = currentLength * 0.99;
        break;
      }

      const overflowKm = distanceInsideSectionKm - currentLength;
      const nextRange =
        corridorTopology.sectionMap[nextSectionId] ||
        (multiLineSections as Record<string, any>)[nextSectionId];

      if (!nextRange) {
        distanceInsideSectionKm = currentLength;
        break;
      }

      this.throughputEngine.recordSectionExit(currentSectionId);
      this.throughputEngine.recordSectionEntry(nextSectionId);

      this.eventEngine.emitEvent(
        "SECTION_EXIT",
        `${train.name} exited section ${currentSectionId}`,
        this.simulationTime,
        "INFO",
        train.id,
        "SECTION"
      );

      this.eventEngine.emitEvent(
        "SECTION_ENTER",
        `${train.name} entered section ${nextSectionId}`,
        this.simulationTime,
        "INFO",
        train.id,
        "SECTION"
      );

      this.stateRevision++;
      currentSectionId = nextSectionId;
      currentLength = nextRange.lengthKm;
      distanceInsideSectionKm = overflowKm;
    }

    const boundedPercent = Math.max(
      0,
      Math.min((distanceInsideSectionKm / currentLength) * 100, 100)
    );

    const roundedPos = Number(boundedPercent.toFixed(2));
    const blockResolution = calculateCurrentBlock(currentSectionId, roundedPos);

    const updatedTrain: Train = {
      ...train,
      speed: Number(regulatedSpeedKmh.toFixed(1)),
      maxSpeed: train.maxSpeed || 130,
      currentSection: currentSectionId,
      currentBlock: blockResolution.blockId,
      position: roundedPos,
      progress: roundedPos,
      delay: train.delayMinutes,
      completed,
      totalTravelTimeSeconds: (train.totalTravelTimeSeconds || 0) + secondsPassed,
    };

    updatedTrain.status = calculateTrainStatus(updatedTrain, this.trains, this.activeConflicts, this.activeIncidents);
    return updatedTrain;
  }

  private synchronizeSectionAndBlockState(): void {
    // 1. Synchronize track sections
    this.sections = this.sections.map((section) => {
      const occupyingTrains = this.trains.filter(
        (t) =>
          t.currentSection === section.id &&
          !t.completed &&
          t.status !== "COMPLETED"
      );

      const isOccupied = occupyingTrains.length > 0;
      const primaryOccupant = isOccupied ? occupyingTrains[0].id : null;

      const isBlocked = this.activeIncidents.some(
        (inc) =>
          inc.affectedSectionId === section.id &&
          (inc.type === "TRACK_SECTION_BLOCKAGE" || inc.isCompleteBlockage) &&
          inc.status !== "RESOLVED_CLOSED"
      );

      const effectiveSpeed = this.getEffectiveSectionSpeedLimit(section.id);

      let status: SectionStatus = "AVAILABLE";
      if (isBlocked) {
        status = "BLOCKED";
      } else if (isOccupied) {
        status = "OCCUPIED";
      } else if (effectiveSpeed < section.maximumSpeed) {
        status = "RESTRICTED";
      }

      return {
        ...section,
        status,
        effectiveSpeedLimit: effectiveSpeed,
        occupiedBy: primaryOccupant,
        occupiedTrains: occupyingTrains.map((t) => t.id),
      };
    });

    // 2. Synchronize discrete track blocks
    this.blocks = this.blocks.map((block) => {
      const occupyingTrain = this.trains.find(
        (t) =>
          !t.completed &&
          t.status !== "COMPLETED" &&
          t.currentSection === block.sectionId &&
          t.currentBlock === block.id
      );

      const isSectionBlocked = this.activeIncidents.some(
        (inc) =>
          inc.affectedSectionId === block.sectionId &&
          (inc.type === "TRACK_SECTION_BLOCKAGE" || inc.isCompleteBlockage) &&
          inc.status !== "RESOLVED_CLOSED"
      );

      let status: SectionStatus = "AVAILABLE";
      let occupiedBy: string | null = null;

      if (isSectionBlocked) {
        status = "BLOCKED";
      } else if (occupyingTrain) {
        status = "OCCUPIED";
        occupiedBy = occupyingTrain.id;
      }

      return {
        ...block,
        status,
        occupiedBy,
      };
    });

    // 3. Update derived state collections
    this.occupiedBlocks = this.blocks.filter((b) => b.status === "OCCUPIED");
    this.congestedSections = this.sections.filter(
      (s) =>
        (s.occupiedTrains && s.occupiedTrains.length > 1) ||
        (s.status === "OCCUPIED" && (s.capacity || 1) === 1 && (s.occupiedTrains?.length || 0) > 1)
    );
  }

  /**
   * Evaluates per-tick core safety and monitoring engines:
   * Track section occupancy, Discrete block tracking, Conflict detection, Signal lamps, and Continuous telemetry flux.
   * Runs unconditionally every tick.
   */
  private evaluatePerTickEngines(): void {
    // 0. Synchronize Section & Block States
    this.synchronizeSectionAndBlockState();

    // 1. Conflict Engine
    const conflictResult = conflictEngine.evaluateConflicts(
      this.trains,
      this.sections,
      this.junctions,
      this.predictionHorizonSeconds
    );
    this.activeConflicts = conflictResult.activeConflicts;
    this.predictedConflicts = conflictResult.predictedConflicts;

    // Track conflict event transitions
    for (const conf of this.activeConflicts) {
      const confId = conf.id || `${conf.trainA}-${conf.trainB}`;
      if (!this.priorConflictsSet.has(confId)) {
        this.priorConflictsSet.add(confId);
        this.eventEngine.emitEvent(
          "CONFLICT_DETECTED",
          `Spatial conflict detected: ${conf.reason}`,
          this.simulationTime,
          conf.severity === "HIGH" ? "CRITICAL" : "WARNING",
          confId,
          "CONFLICT"
        );
        // Discrete conflict emergence triggers state invalidation
        this.stateRevision++;
      }
    }
    for (const priorId of Array.from(this.priorConflictsSet)) {
      if (!this.activeConflicts.some((c) => (c.id || `${c.trainA}-${c.trainB}`) === priorId)) {
        this.priorConflictsSet.delete(priorId);
        this.eventEngine.emitEvent(
          "CONFLICT_CLEARED",
          `Conflict resolved and cleared: ${priorId}`,
          this.simulationTime,
          "SUCCESS",
          priorId,
          "CONFLICT"
        );
        // Conflict resolution triggers state invalidation
        this.stateRevision++;
      }
    }

    // 2. Signal Engine
    this.signals = signalEngine.evaluateSignals(
      this.trains,
      this.sections,
      this.activeConflicts,
      this.junctions,
      this.signals,
      this.simulationTime,
      this.activeIncidents
    );

    // Track signal aspect transitions
    for (const sig of this.signals) {
      const priorAspect = this.priorSignalsMap.get(sig.id);
      if (priorAspect && priorAspect !== sig.aspect) {
        this.eventEngine.emitEvent(
          "SIGNAL_CHANGE",
          `Signal ${sig.id} changed aspect: ${priorAspect} → ${sig.aspect} (${sig.reason})`,
          this.simulationTime,
          sig.aspect === "RED" ? "CRITICAL" : sig.aspect === "YELLOW" ? "WARNING" : "INFO",
          sig.id,
          "SIGNAL"
        );
      }
      this.priorSignalsMap.set(sig.id, sig.aspect);
    }

    // 3. Throughput Engine
    const throughputResult = this.throughputEngine.computeMetrics(
      this.trains,
      this.sections,
      this.signals,
      this.activeConflicts,
      this.predictedConflicts,
      this.simulationTime
    );
    this.throughputMetrics = throughputResult.throughput;
    this.telemetry = throughputResult.telemetry;

    // 4. Calculate Derived Network Metrics
    const activeTrains = this.trains.filter((t) => !t.completed && t.status !== "COMPLETED");
    const delayedTrains = activeTrains.filter((t) => t.delayMinutes > 0);
    const totalDelay = activeTrains.reduce((acc, t) => acc + t.delayMinutes, 0);

    this.averageDelay = activeTrains.length > 0 ? Number((totalDelay / activeTrains.length).toFixed(1)) : 0.0;
    this.networkCapacity =
      this.blocks.length > 0 ? Math.round((this.occupiedBlocks.length / this.blocks.length) * 100) : 0;

    // Derive holistic Overall Health State
    const hasHighSeverityConflict = this.activeConflicts.some(
      (c) => c.severity === "HIGH" || c.severity === "CRITICAL"
    );
    if (hasHighSeverityConflict || this.sections.some((s) => s.status === "BLOCKED")) {
      this.networkHealth = "CRITICAL";
    } else if (this.congestedSections.length >= 2 || this.networkCapacity >= 80) {
      this.networkHealth = "CONGESTED";
    } else if (
      delayedTrains.length > 0 ||
      this.networkCapacity >= 60 ||
      this.predictedConflicts.length > 0 ||
      this.activeConflicts.length > 0
    ) {
      this.networkHealth = "WARNING";
    } else {
      this.networkHealth = "NORMAL";
    }

    // Track bottleneck transition
    if (
      this.throughputMetrics.bottleneckSection &&
      this.throughputMetrics.bottleneckSection !== this.priorBottleneckSection
    ) {
      this.priorBottleneckSection = this.throughputMetrics.bottleneckSection;
      this.eventEngine.emitEvent(
        "BOTTLENECK_DETECTED",
        `Bottleneck identified: Section ${this.priorBottleneckSection} exhibiting elevated density`,
        this.simulationTime,
        "WARNING",
        this.priorBottleneckSection,
        "SECTION"
      );
    }

    // 5. Development-Time Cross-Panel Consistency Assertions
    this.validateSimulationState();
  }

  /**
   * Validates internal consistency invariants across all domain objects.
   * Logs clear errors in development mode if any discrepancy is detected.
   */
  private validateSimulationState(): void {
    if (typeof process !== "undefined" && process.env?.NODE_ENV === "production") {
      return;
    }

    const activeTrains = this.trains.filter((t) => !t.completed && t.status !== "COMPLETED");

    // Invariant 1: Duplicate Train IDs
    const seenIds = new Set<string>();
    for (const t of activeTrains) {
      if (seenIds.has(t.id)) {
        console.error(
          `[DATA CONSISTENCY ERROR] Duplicate train ID "${t.id}" detected at simulation time ${this.simulationTime.toFixed(1)}s`
        );
      }
      seenIds.add(t.id);
    }

    // Invariant 2: Train localization & attribute bounds
    for (const train of activeTrains) {
      if (train.position < 0 || train.position > 100) {
        console.error(
          `[DATA CONSISTENCY ERROR] Train ${train.id} has invalid position: ${train.position}% (expected 0-100)`
        );
      }
      if (train.progress !== train.position) {
        console.error(
          `[DATA CONSISTENCY ERROR] Train ${train.id} progress (${train.progress}) !== position (${train.position})`
        );
      }
      if (train.delay !== train.delayMinutes) {
        console.error(
          `[DATA CONSISTENCY ERROR] Train ${train.id} delay alias (${train.delay}) !== delayMinutes (${train.delayMinutes})`
        );
      }
      if (train.delayMinutes < 0) {
        console.error(
          `[DATA CONSISTENCY ERROR] Train ${train.id} has negative delay: ${train.delayMinutes} min`
        );
      }
      if (train.speed < 0 || train.speed > (train.maxSpeed || 150) + 5) {
        console.error(
          `[DATA CONSISTENCY ERROR] Train ${train.id} speed (${train.speed}) exceeds maxSpeed (${train.maxSpeed})`
        );
      }

      // Invariant: train.currentBlock must match calculated block from currentSection and position
      const expectedBlock = calculateCurrentBlock(train.currentSection, train.position).blockId;
      if (train.currentBlock !== expectedBlock) {
        console.error(
          `[DATA CONSISTENCY ERROR] Train ${train.id} currentBlock "${train.currentBlock}" !== expected "${expectedBlock}" for ${train.currentSection} at ${train.position}%`
        );
      }

      const matchedBlock = this.blocks.find((b) => b.id === train.currentBlock);
      if (!matchedBlock) {
        console.error(
          `[DATA CONSISTENCY ERROR] Train ${train.id} references nonexistent block ID "${train.currentBlock}"`
        );
      } else if (matchedBlock.occupiedBy !== train.id && matchedBlock.status !== "BLOCKED") {
        console.error(
          `[DATA CONSISTENCY ERROR] Block ${matchedBlock.id} occupiedBy ("${matchedBlock.occupiedBy}") !== train ID "${train.id}"`
        );
      }
    }

    // Invariant 3: Block occupancy back-references
    for (const block of this.occupiedBlocks) {
      if (!block.occupiedBy) {
        console.error(
          `[DATA CONSISTENCY ERROR] Block ${block.id} is marked OCCUPIED but has null occupiedBy`
        );
        continue;
      }
      const occupyingTrain = activeTrains.find((t) => t.id === block.occupiedBy);
      if (!occupyingTrain) {
        console.error(
          `[DATA CONSISTENCY ERROR] Block ${block.id} references nonexistent active train "${block.occupiedBy}"`
        );
      } else if (occupyingTrain.currentBlock !== block.id) {
        console.error(
          `[DATA CONSISTENCY ERROR] Block ${block.id} claims train ${occupyingTrain.id}, but train is in block ${occupyingTrain.currentBlock}`
        );
      }
    }

    // Invariant 4: Canonical train fleet presence (T001 to T006 must all exist)
    const expectedTrainIds = ["T001", "T002", "T003", "T004", "T005", "T006"];
    for (const expectedId of expectedTrainIds) {
      if (!this.trains.some((t) => t.id === expectedId)) {
        console.error(
          `[DATA INTEGRITY] Train ${expectedId} is missing from SimulationEngine.trains`
        );
      }
    }
  }

  /**
   * Evaluates forward kinematic projection, candidate action search, and AI advisor recommendations.
   * Executed at adaptive cadence (e.g. every 2.0s simulated time) or immediately on state invalidation.
   */
  private evaluatePeriodicOptimization(force: boolean = false): void {
    const elapsedSinceLastOptimization = this.simulationTime - this.lastOptimizationSimulationTime;
    const isCadenceDue = elapsedSinceLastOptimization >= this.optimizationCadenceSeconds;
    const isRevisionChanged = this.stateRevision !== this.lastEvaluatedRevision;

    if (!force && !isCadenceDue && !isRevisionChanged) {
      return;
    }

    this.optimizationExecutionCount++;
    this.lastOptimizationSimulationTime = this.simulationTime;
    this.lastEvaluatedRevision = this.stateRevision;

    // 4. Forward Kinematics Projection
    const forwardResult = predictionEngine.simulateForward(
      this.trains,
      this.sections,
      this.signals,
      this.junctions,
      this.predictionHorizonSeconds,
      [],
      this.activeIncidents
    );
    this.predictedForwardState = forwardResult.predictedState;

    // 5. Advisor Engine (Coordinates Multi-Train Optimization Tree)
    const advisorResult = advisorEngine.generateRecommendations(
      this.trains,
      this.sections,
      this.signals,
      this.activeConflicts,
      this.predictedConflicts,
      this.throughputMetrics,
      this.simulationTime,
      this.junctions,
      this.telemetry?.sectionUtilizations || [],
      this.predictionHorizonSeconds,
      this.adaptiveEngine,
      this.stateRevision,
      this.activeIncidents
    );

    this.availableStrategies = advisorResult.availableStrategies || [];
    const newlySynthesized = (advisorResult.availableRecoveryPlans || []).map((plan) => {
      if (
        this.authorizedRecoveryPlanIds.has(plan.recoveryPlanId) ||
        this.authorizedRecoveryPlanIds.has(plan.associatedIncidentId)
      ) {
        return { ...plan, executionStatus: "AUTHORIZED" as const };
      }
      if (this.dismissedRecoveryPlanIds.has(plan.recoveryPlanId)) {
        return { ...plan, executionStatus: "DISMISSED" as const };
      }
      return plan;
    });

    // Retain currently executing plans that are active in activeRecoveryExecutions
    const existingActivePlans = this.recoveryPlans.filter(
      (p) =>
        this.activeRecoveryExecutions.has(p.recoveryPlanId) &&
        !newlySynthesized.some((np) => np.recoveryPlanId === p.recoveryPlanId)
    );

    this.recoveryPlans = [...newlySynthesized, ...existingActivePlans];

    // Merge status of applied recommendations & filter dismissed
    this.recommendations = advisorResult.recommendations
      .filter((r) => !this.dismissedRecommendationIds.has(r.id))
      .map((rec) => {
        const applied = this.appliedRecommendations.get(rec.id);
        if (applied) {
          return {
            ...rec,
            status: applied.status,
            appliedAt: applied.appliedAt,
          };
        }
        return rec;
      });

    for (const [id, appliedRec] of this.appliedRecommendations.entries()) {
      if (
        !this.recommendations.some((r) => r.id === id) &&
        !this.dismissedRecommendationIds.has(id)
      ) {
        this.recommendations.push(appliedRec);
      }
    }

    this.throughputEngine.recordRecommendations(this.recommendations.length);
    this.networkAssessment = advisorResult.assessment;
  }

  /**
   * Unified full evaluation method. Preserves backwards-compatibility for existing tests/callers by
   * running per-tick safety engines and forcing optimization evaluation.
   */
  public evaluateAllEngines(): void {
    this.evaluatePerTickEngines();
    this.evaluatePendingDecisions();
    this.evaluatePeriodicOptimization(true);
  }

  private notify(): void {
    const snapshot = this.getSnapshot();
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }
}

/**
 * Singleton shared instance for application-wide unified simulation state.
 */
export const simulationEngine = new SimulationEngine();

export function createSimulationEngine(
  initialTrains?: Train[],
  config?: Partial<SimulationConfig>
): SimulationEngine {
  return new SimulationEngine(initialTrains, config);
}