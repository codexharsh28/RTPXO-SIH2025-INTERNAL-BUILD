"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { SimulationSnapshot } from "@/types/simulation";
import { simulationEngine } from "@/engine/simulationEngine";
import { Train, RailwaySection } from "@/types/railway";
import { ActiveIncident } from "@/types/incident";
import { PredictionHorizonSeconds } from "@/types/optimization";
import { getTrainCorridorCoordinates } from "@/data/topology";
import { AIScoreBreakdown, RecommendationStatus } from "@/types/advisor";

// Safe Web Audio API Control Room Chime
function playControlRoomAlertChime() {
  if (typeof window === "undefined") return;
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.25);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  } catch {
    // Ignore browser auto-play policy blocks
  }
}

export function formatSimulationClock(seconds: number): string {
  const totalSecs = Math.floor(seconds);
  const hours = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;

  return [
    String(hours).padStart(2, "0"),
    String(mins).padStart(2, "0"),
    String(secs).padStart(2, "0"),
  ].join(":");
}

export interface TrainVisualState {
  statusText: string;
  statusLabel: string;
  shortStatusText: string;
  statusCategory: "ON_TIME" | "DELAYED" | "CONFLICT" | "APPROACHING_JUNCTION" | "HELD";
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
  dotColor: string;
  isPulsing: boolean;
}

/**
 * Single Authoritative Train Visual State Derivation
 * Ensures TrainMarker.tsx, NetworkMap.tsx, TrainTable.tsx, and CompactFleetRoster.tsx
 * can NEVER diverge in status text or status colors.
 */
export function getTrainVisualState(
  train: {
    id: string;
    status: string;
    delayMinutes?: number;
    delay?: number;
  },
  options: {
    isSelected?: boolean;
    inConflict?: boolean;
    inBottleneck?: boolean;
  } = {}
): TrainVisualState {
  const { isSelected = false, inConflict = false, inBottleneck = false } = options;
  const delay = train.delayMinutes ?? train.delay ?? 0;
  const rawStatus = (train.status || "ON_TIME").toUpperCase();

  // 1. Critical Conflict Status
  if (inConflict || rawStatus === "CONFLICT" || rawStatus === "CRITICAL") {
    return {
      statusText: "CONFLICT",
      statusLabel: "CONFLICT",
      shortStatusText: "CONFLICT",
      statusCategory: "CONFLICT",
      badgeBg: isSelected ? "#0c4a6e" : "#7f1d1d",
      badgeBorder: isSelected ? "#00B4D8" : "#EF4444",
      badgeText: "text-red-300",
      dotColor: "#EF4444",
      isPulsing: true,
    };
  }

  // 2. Interlocking / Staged Hold
  if (rawStatus === "HELD" || rawStatus === "HOLDING" || rawStatus === "STOPPED") {
    return {
      statusText: "HELD",
      statusLabel: "HELD",
      shortStatusText: "HELD",
      statusCategory: "HELD",
      badgeBg: isSelected ? "#0c4a6e" : "#4c1d95",
      badgeBorder: isSelected ? "#00B4D8" : "#8B5CF6",
      badgeText: "text-purple-300",
      dotColor: "#8B5CF6",
      isPulsing: false,
    };
  }

  // 3. Proactive Approaching Junction (AI-Predicted State)
  if (rawStatus === "APPROACHING_JUNCTION" || rawStatus === "APPROACHING") {
    return {
      statusText: "APPROACHING JUNCTION",
      statusLabel: "APPROACHING JUNCTION",
      shortStatusText: "APPR. JCT",
      statusCategory: "APPROACHING_JUNCTION",
      badgeBg: isSelected ? "#0c4a6e" : "#083344",
      badgeBorder: isSelected ? "#48CAE4" : "#00B4D8",
      badgeText: "text-cyan-300",
      dotColor: "#00B4D8",
      isPulsing: true,
    };
  }

  // 4. Delayed Trains
  if (rawStatus === "DELAYED" || delay > 0) {
    return {
      statusText: "DELAYED",
      statusLabel: "DELAYED",
      shortStatusText: `+${delay}m`,
      statusCategory: "DELAYED",
      badgeBg: isSelected ? "#0c4a6e" : "#78350f",
      badgeBorder: isSelected ? "#00B4D8" : "#F59E0B",
      badgeText: "text-amber-300",
      dotColor: "#F59E0B",
      isPulsing: false,
    };
  }

  // 5. Section Bottleneck / Traffic Density Regulation
  if (inBottleneck || rawStatus === "BOTTLENECK") {
    return {
      statusText: "BOTTLENECK",
      statusLabel: "BOTTLENECK",
      shortStatusText: "PACE (BTN)",
      statusCategory: "DELAYED",
      badgeBg: isSelected ? "#0c4a6e" : "#713f12",
      badgeBorder: isSelected ? "#00B4D8" : "#EAB308",
      badgeText: "text-yellow-300",
      dotColor: "#EAB308",
      isPulsing: false,
    };
  }

  // 6. Default Nominal Free-Flow (ON_TIME)
  return {
    statusText: "ON TIME",
    statusLabel: "ON TIME",
    shortStatusText: "ON TIME",
    statusCategory: "ON_TIME",
    badgeBg: isSelected ? "#0c4a6e" : "#064e3b",
    badgeBorder: isSelected ? "#00B4D8" : "#10B981",
    badgeText: "text-emerald-300",
    dotColor: "#10B981",
    isPulsing: false,
  };
}

export type HealthStatusType = "NORMAL" | "WARNING" | "CONGESTED" | "CRITICAL";

export interface TrainState {
  id: string;
  name: string;
  type: string;
  priority: number;
  speed: number;
  maxSpeed: number;
  position: number; // percentage 0-100
  distanceTraveledKm: number; // cumulative corridor km
  currentSection: string;
  currentBlock: string;
  status: string;
  delayMinutes: number;
  flaggedConflictId?: string;
  isBottleneckFactor?: boolean;
  origin: string;
  destination: string;
}

export interface BlockState {
  id: string;
  sectionId: string;
  blockNumber: number;
  lengthMeters: number;
  isOccupied: boolean;
  occupyingTrainId?: string;
  signalState: string;
}

export interface ConflictState {
  id: string;
  trainA: string;
  trainB: string;
  trainIds: string[];
  location: string;
  sectionId: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  type: string;
  timeToConflictSeconds: number;
  etaToConflict: number;
  description: string;
  isAcknowledged: boolean;
}

export interface BottleneckState {
  sectionId: string;
  sectionName: string;
  location: string;
  saturationPercent: number;
  utilizationPercent: number;
  trainsQueued: string[];
  causingTrainIds: string[];
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  reason: string;
}

export type ActionProvenanceType = "AI_SUGGESTED" | "AI_AUTONOMOUS" | "OPERATOR_CONFIRMED";

export interface AdvisoryState {
  id: string;
  message: string;
  action: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  targetSpeed?: number;
  relatedTrainIds: string[];
  affectedTrainId: string;
  affectedSectionId?: string;
  confidence: number;
  isSafeToDispatch: boolean;
  status: RecommendationStatus;
  provenance: ActionProvenanceType;
}

export interface AuditEntryState {
  id: string;
  timestamp: number;
  timestampFormatted: string;
  simulationTime: number;
  action: string;
  reasoning: string;
  affectedTrainId?: string;
  actor: string; // e.g. "OPERATOR_DISPATCHER" | "AUTONOMOUS_OPTIMIZER"
  provenance: ActionProvenanceType;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  outcome?: string;
}

export interface ConfirmationActionPayload {
  title: string;
  description: string;
  impactSummary: string;
  actor: string;
  affectedTrainId?: string;
  onConfirm: () => void;
}

export interface NetworkState {
  tick: number;
  simTime: string;
  simulationTimeSeconds: number;
  running: boolean;
  speedMultiplier: number;
  activeScenarioId: string;
  trains: TrainState[];
  blocks: BlockState[];
  sections: RailwaySection[];
  conflicts: ConflictState[];
  predictedConflicts: any[];
  bottlenecks: BottleneckState[];
  readonly healthStatus: HealthStatusType;
  readonly aiScore: number;
  aiScoreBreakdown: AIScoreBreakdown;
  throughput: {
    current: number;
    trend: number[];
    delta: number;
    baseline: number;
    trainsCompleted: number;
    delaySavedMinutes: number;
  };
  advisories: AdvisoryState[];
  auditLog: AuditEntryState[];
  activeIncidents: ActiveIncident[];
  recoveryPlans: any[];
  availableStrategies: any[];
  rawSnapshot: SimulationSnapshot;
  
  // Professional CTC Dispatch Controls
  unacknowledgedAlertIds: string[];
  unacknowledgedCount: number;
  isAlarmAudioMuted: boolean;
  toggleAlarmAudio: () => void;
  acknowledgeAlert: (alertId: string) => void;
  acknowledgeAllAlerts: () => void;
  
  // Two-Step Confirmation System
  pendingConfirmation: ConfirmationActionPayload | null;
  requestConfirmation: (payload: ConfirmationActionPayload) => void;
  cancelConfirmation: () => void;
  confirmPendingAction: () => void;

  // Real-Time Dispatch Toast
  activeToast: string | null;
  showToast: (message: string) => void;

  // Bound Actions
  start: () => void;
  pause: () => void;
  toggle: () => void;
  stop: () => void;
  reset: (newTrains?: Train[]) => void;
  resetScenario: () => void;
  loadScenario: (scenarioId: string) => void;
  setSpeedMultiplier: (multiplier: number) => void;
  setPredictionHorizon: (horizon: PredictionHorizonSeconds) => void;
  applyRecommendation: (recId: string) => boolean;
  dismissRecommendation: (recId: string) => void;
  overrideTrainSpeed: (trainId: string, speedKmH: number) => void;
  holdTrain: (trainId: string) => void;
  releaseTrain: (trainId: string, speedKmH?: number) => void;
  dispatchStrategy: (strategyId: string) => boolean;
  dismissStrategy: (strategyId: string) => void;
  declareIncident: (incident: ActiveIncident) => void;
  clearIncident: (incidentId: string) => void;
  authorizeRecoveryPlan: (planId: string) => boolean;
  dismissRecoveryPlan: (planId: string) => void;
}

/**
 * useNetworkState - Single Authoritative React Hook for RTPXO
 *
 * Wraps SimulationEngine, OptimizationEngine, ConflictEngine, ThroughputEngine,
 * and ObjectiveEvaluator into ONE unified, consistent snapshot per tick.
 */
export function useNetworkState(): NetworkState {
  const [snapshot, setSnapshot] = useState<SimulationSnapshot>(() =>
    simulationEngine.getSnapshot()
  );

  // Professional CTC Alarm Acknowledgment State
  const [acknowledgedAlertIds, setAcknowledgedAlertIds] = useState<Set<string>>(() => new Set());
  const [isAlarmAudioMuted, setIsAlarmAudioMuted] = useState<boolean>(false);
  const prevCriticalCountRef = useRef<number>(0);

  // Two-Step Confirmation State
  const [pendingConfirmation, setPendingConfirmation] = useState<ConfirmationActionPayload | null>(null);
  const [activeToast, setActiveToast] = useState<string | null>(null);
  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = useCallback((message: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setActiveToast(message);
    toastTimerRef.current = setTimeout(() => {
      setActiveToast(null);
    }, 4000);
  }, []);

  useEffect(() => {
    const unsubscribe = simulationEngine.subscribe((newSnapshot) => {
      setSnapshot(newSnapshot);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // 1. Map Raw Trains to Structured TrainState with cumulative km and conflict linkages
  const trains: TrainState[] = useMemo(() => {
    const activeBottlenecks = snapshot.networkAssessment?.activeBottlenecks || [];
    const activeConflicts = snapshot.conflicts || [];

    return snapshot.trains.map((train) => {
      const coords = getTrainCorridorCoordinates(train);
      const conflict = activeConflicts.find(
        (c) => c.trainA === train.id || c.trainB === train.id
      );
      const isBottleneck = activeBottlenecks.some((b) =>
        b.trainsQueued?.includes(train.id)
      );

      return {
        id: train.id,
        name: train.name,
        type: train.type,
        priority: train.priority,
        speed: train.speed,
        maxSpeed: train.maxSpeed || 130,
        position: train.position,
        distanceTraveledKm: coords.cumulativeKm,
        currentSection: train.currentSection,
        currentBlock: train.currentBlock || `${train.currentSection}-BLK-01`,
        status: train.status,
        delayMinutes: train.delayMinutes || train.delay || 0,
        flaggedConflictId: conflict?.id,
        isBottleneckFactor: isBottleneck,
        origin: train.origin,
        destination: train.destination,
      };
    });
  }, [snapshot.trains, snapshot.conflicts, snapshot.networkAssessment]);

  // 2. Map Blocks to BlockState
  const blocks: BlockState[] = useMemo(() => {
    return snapshot.blocks.map((block) => ({
      id: block.id,
      sectionId: block.sectionId,
      blockNumber: block.blockIndex,
      lengthMeters: Math.round((block.lengthKm || 2.5) * 1000),
      isOccupied: block.status === "OCCUPIED" || block.occupiedBy !== null,
      occupyingTrainId: block.occupiedBy || undefined,
      signalState: block.status === "OCCUPIED" ? "RED" : "GREEN",
    }));
  }, [snapshot.blocks]);

  // 3. Map Conflicts to ConflictState with acknowledgment tracking
  const conflicts: ConflictState[] = useMemo(() => {
    return snapshot.conflicts.map((c) => {
      const timeToConflict = (c as any).timeToConflict ?? (c as any).timeToConflictSeconds ?? 0;
      const id = c.id || `${c.trainA}-${c.trainB}-${c.sectionA}`;
      return {
        id,
        trainA: c.trainA,
        trainB: c.trainB,
        trainIds: [c.trainA, c.trainB],
        location: c.sectionA || c.junctionId || "ND-GZB-01",
        sectionId: c.sectionA || "ND-GZB-01",
        severity: c.severity,
        type: c.type || "HEADWAY_VIOLATION",
        timeToConflictSeconds: timeToConflict,
        etaToConflict: timeToConflict,
        description: c.reason || `${c.trainA} and ${c.trainB} headway conflict on ${c.sectionA}`,
        isAcknowledged: acknowledgedAlertIds.has(id),
      };
    });
  }, [snapshot.conflicts, acknowledgedAlertIds]);

  // Track unacknowledged critical/high conflicts
  const unacknowledgedAlertIds = useMemo(() => {
    return conflicts
      .filter((c) => (c.severity === "HIGH" || c.severity === "CRITICAL") && !c.isAcknowledged)
      .map((c) => c.id);
  }, [conflicts]);

  const unacknowledgedCount = unacknowledgedAlertIds.length;

  // Sound chime when a new critical conflict enters
  useEffect(() => {
    if (unacknowledgedCount > prevCriticalCountRef.current && !isAlarmAudioMuted) {
      playControlRoomAlertChime();
    }
    prevCriticalCountRef.current = unacknowledgedCount;
  }, [unacknowledgedCount, isAlarmAudioMuted]);

  const acknowledgeAlert = useCallback((alertId: string) => {
    setAcknowledgedAlertIds((prev) => {
      const next = new Set(prev);
      next.add(alertId);
      return next;
    });
    showToast(`✓ Alarm [${alertId}] acknowledged by operator`);
  }, [showToast]);

  const acknowledgeAllAlerts = useCallback(() => {
    setAcknowledgedAlertIds((prev) => {
      const next = new Set(prev);
      unacknowledgedAlertIds.forEach((id) => next.add(id));
      return next;
    });
    showToast(`✓ All active safety alarms acknowledged (${unacknowledgedAlertIds.length})`);
  }, [unacknowledgedAlertIds, showToast]);

  const toggleAlarmAudio = useCallback(() => {
    setIsAlarmAudioMuted((prev) => {
      const next = !prev;
      showToast(next ? "🔇 Alarm Audio Muted" : "🔊 Alarm Audio Unmuted");
      return next;
    });
  }, [showToast]);

  // Confirmation Request Methods
  const requestConfirmation = useCallback((payload: ConfirmationActionPayload) => {
    setPendingConfirmation(payload);
  }, []);

  const cancelConfirmation = useCallback(() => {
    setPendingConfirmation(null);
  }, []);

  const confirmPendingAction = useCallback(() => {
    if (pendingConfirmation) {
      pendingConfirmation.onConfirm();
      showToast(`✓ ${pendingConfirmation.title} Executed [${pendingConfirmation.actor}]`);
      setPendingConfirmation(null);
    }
  }, [pendingConfirmation, showToast]);

  // 4. Map Bottlenecks to BottleneckState
  const bottlenecks: BottleneckState[] = useMemo(() => {
    const rawBottlenecks = snapshot.networkAssessment?.activeBottlenecks || [];
    return rawBottlenecks.map((b) => ({
      sectionId: b.sectionId,
      sectionName: b.sectionName,
      location: b.sectionName || b.sectionId,
      saturationPercent: b.utilizationPercent,
      utilizationPercent: b.utilizationPercent,
      trainsQueued: b.trainsQueued || [],
      causingTrainIds: b.trainsQueued || [],
      severity: b.severity,
      reason: b.reason,
    }));
  }, [snapshot.networkAssessment]);

  // 5. PURE DERIVED VALUE: HealthStatus (Derived strictly from conflicts, bottlenecks, and delays)
  const healthStatus: HealthStatusType = useMemo(() => {
    const hasCriticalConflict = conflicts.some(
      (c) => c.severity === "HIGH" || c.severity === "CRITICAL"
    );
    const hasBlockedSection = snapshot.sections.some((s) => s.status === "BLOCKED");

    if (hasCriticalConflict || hasBlockedSection) {
      return "CRITICAL";
    }

    const hasSevereBottleneck = bottlenecks.some(
      (b) => b.severity === "HIGH" || b.utilizationPercent >= 100
    );
    const isCongestedSection = snapshot.congestedSections.length >= 1;
    const isHighCapacity = (snapshot.networkCapacity || 0) >= 80;

    if (hasSevereBottleneck || isCongestedSection || isHighCapacity || conflicts.length > 0) {
      return "CONGESTED";
    }

    const hasDelays = trains.some((t) => t.delayMinutes > 2 || t.status === "DELAYED");
    const hasModerateCapacity = (snapshot.networkCapacity || 0) >= 60;
    const hasPredicted = (snapshot.predictedConflicts || []).length > 0;

    if (hasDelays || hasModerateCapacity || hasPredicted || bottlenecks.length > 0) {
      return "WARNING";
    }

    return "NORMAL";
  }, [conflicts, snapshot.sections, bottlenecks, snapshot.congestedSections, snapshot.networkCapacity, trains, snapshot.predictedConflicts]);

  // 6. PURE DERIVED VALUE: AIScore (Capped mathematically based on healthStatus)
  const aiScore: number = useMemo(() => {
    const rawScore = snapshot.networkAssessment?.efficiencyScore ?? 100;
    if (healthStatus === "CRITICAL") {
      return Math.min(35, rawScore);
    }
    if (healthStatus === "CONGESTED") {
      return Math.min(60, rawScore);
    }
    if (healthStatus === "WARNING") {
      return Math.min(80, rawScore);
    }
    return Math.min(100, Math.max(0, rawScore));
  }, [snapshot.networkAssessment, healthStatus]);

  // 7. Advisories Mapping with Three-State Provenance
  const advisories: AdvisoryState[] = useMemo(() => {
    return snapshot.recommendations.map((r) => ({
      id: r.id,
      message: r.reason,
      action: r.action,
      severity: r.urgency === "CRITICAL" ? "CRITICAL" : r.urgency === "HIGH" ? "HIGH" : r.urgency === "MEDIUM" ? "MEDIUM" : "LOW",
      targetSpeed: r.targetSpeed,
      relatedTrainIds: [r.affectedTrainId],
      affectedTrainId: r.affectedTrainId,
      affectedSectionId: r.affectedSectionId,
      confidence: r.confidence ?? 0.88,
      isSafeToDispatch: r.isSafeToDispatch,
      status: r.status,
      provenance: (r.status === "ACCEPTED" || r.status === "EXECUTED") ? "OPERATOR_CONFIRMED" : "AI_SUGGESTED",
    }));
  }, [snapshot.recommendations]);

  // 8. Detailed Immutable Audit Log Mapping
  const auditLog: AuditEntryState[] = useMemo(() => {
    const history = (snapshot as any).decisionHistory || [];
    return history.map((h: any) => {
      const isOperator = h.eventType === "MANUAL_SPEED_OVERRIDE" || h.eventType === "TRAIN_HOLD" || h.eventType === "TRAIN_RELEASE" || h.appliedBy?.includes("OPERATOR");
      const prov: ActionProvenanceType = isOperator ? "OPERATOR_CONFIRMED" : "AI_AUTONOMOUS";
      const simSecs = h.simulationTime || 0;
      return {
        id: h.id,
        timestamp: h.timestamp || Date.now(),
        timestampFormatted: `T+${formatSimulationClock(simSecs)}`,
        simulationTime: simSecs,
        action: h.actionDescription || h.action || h.eventType || "DISPATCH_ACTION",
        reasoning: h.reason || h.reasoning || "Optimized section throughput and headway",
        affectedTrainId: h.affectedTrainId,
        actor: isOperator ? "DISPATCHER_01 (HUMAN)" : "OPTIMIZER_ENGINE (AUTONOMOUS)",
        provenance: prov,
        severity: h.eventType?.includes("HOLD") ? "HIGH" : "MEDIUM",
        outcome: h.actualOutcome?.verificationStatus || "VERIFIED_ACTIVE",
      };
    });
  }, [snapshot]);

  // 9. Runtime Dev-Mode Guardrail Assertions
  if (process.env.NODE_ENV !== "production") {
    if (aiScore > 90 && healthStatus === "CONGESTED") {
      console.error(
        `[RTPXO INCONSISTENCY GUARDRAIL] aiScore is ${aiScore}% (>90%) but healthStatus is ${healthStatus}! Source: advisorEngine / calculateAIScore`
      );
    }
    if (healthStatus === "CRITICAL" && conflicts.length === 0 && (snapshot.activeIncidents || []).length === 0 && !snapshot.sections.some((s) => s.status === "BLOCKED")) {
      console.error(
        `[RTPXO INCONSISTENCY GUARDRAIL] healthStatus is CRITICAL but active conflicts = 0 and active incidents = 0!`
      );
    }
    // Conflict count reconciliation: Header conflict count * 2 must be >= count of trains with CONFLICT status
    const conflictTrainCount = trains.filter(
      (t) => t.status === "CONFLICT" || getTrainVisualState(t).statusCategory === "CONFLICT"
    ).length;
    const maxPossibleConflictTrains = conflicts.length * 2;
    if (conflictTrainCount > maxPossibleConflictTrains) {
      console.error(
        `[RTPXO CONFLICT RECONCILIATION GUARDRAIL] Conflict count violation! Header conflicts = ${conflicts.length} (max ${maxPossibleConflictTrains} trains), but ${conflictTrainCount} trains have CONFLICT status! Violating trains:`,
        trains.filter((t) => t.status === "CONFLICT").map((t) => t.id)
      );
    }
    // Specific status desync check across all trains
    trains.forEach((t) => {
      const visual = getTrainVisualState(t);
      if (t.status === "APPROACHING_JUNCTION" && visual.statusCategory !== "APPROACHING_JUNCTION") {
        console.error(
          `[RTPXO STATUS DESYNC GUARDRAIL] Train ${t.id} has status ${t.status} but visual status category is ${visual.statusCategory}!`
        );
      }
    });
  }

  // Bound Action Dispatchers
  const start = useCallback(() => simulationEngine.start(), []);
  const pause = useCallback(() => simulationEngine.pause(), []);
  const toggle = useCallback(() => simulationEngine.toggle(), []);
  const stop = useCallback(() => simulationEngine.stop(), []);
  const reset = useCallback((newTrains?: Train[]) => simulationEngine.reset(newTrains), []);
  const resetScenario = useCallback(() => simulationEngine.resetScenario(), []);
  const loadScenario = useCallback((scenarioId: string) => simulationEngine.loadScenario(scenarioId), []);
  const setSpeedMultiplier = useCallback((multiplier: number) => simulationEngine.setSpeedMultiplier(multiplier), []);
  const setPredictionHorizon = useCallback((horizon: PredictionHorizonSeconds) => simulationEngine.setPredictionHorizon(horizon), []);
  const applyRecommendation = useCallback((recId: string) => simulationEngine.applyRecommendation(recId), []);
  const dismissRecommendation = useCallback((recId: string) => simulationEngine.dismissRecommendation(recId), []);
  const overrideTrainSpeed = useCallback((trainId: string, speedKmH: number) => simulationEngine.overrideTrainSpeed(trainId, speedKmH), []);
  const holdTrain = useCallback((trainId: string) => simulationEngine.holdTrain(trainId), []);
  const releaseTrain = useCallback((trainId: string, speedKmH?: number) => simulationEngine.releaseTrain(trainId, speedKmH), []);
  const dispatchStrategy = useCallback((strategyId: string) => simulationEngine.dispatchStrategy(strategyId), []);
  const dismissStrategy = useCallback((strategyId: string) => simulationEngine.dismissStrategy(strategyId), []);
  const declareIncident = useCallback((incident: ActiveIncident) => simulationEngine.declareIncident(incident), []);
  const clearIncident = useCallback((incidentId: string) => simulationEngine.clearIncident(incidentId), []);
  const authorizeRecoveryPlan = useCallback((planId: string) => simulationEngine.authorizeRecoveryPlan(planId), []);
  const dismissRecoveryPlan = useCallback((planId: string) => simulationEngine.dismissRecoveryPlan(planId), []);

  return {
    tick: snapshot.simulationTime,
    simTime: formatSimulationClock(snapshot.simulationTime),
    simulationTimeSeconds: snapshot.simulationTime,
    running: snapshot.running,
    speedMultiplier: snapshot.speedMultiplier,
    activeScenarioId: snapshot.activeScenarioId,
    trains,
    blocks,
    sections: snapshot.sections,
    conflicts,
    predictedConflicts: snapshot.predictedConflicts || [],
    bottlenecks,
    healthStatus,
    aiScore,
    aiScoreBreakdown: snapshot.networkAssessment?.aiScoreBreakdown || {
      baseScore: 100,
      totalScore: aiScore,
      penalties: [],
      bonuses: [],
      summary: "High network efficiency",
    },
    throughput: {
      current: snapshot.throughputMetrics?.corridorThroughput || 0,
      trend: [
        snapshot.throughputMetrics?.baselineThroughput || 1.35,
        snapshot.throughputMetrics?.corridorThroughput || 1.48,
      ],
      delta: snapshot.throughputMetrics?.throughputImprovement || 0,
      baseline: snapshot.throughputMetrics?.baselineThroughput || 1.35,
      trainsCompleted: snapshot.throughputMetrics?.trainsCompleted || 0,
      delaySavedMinutes: snapshot.throughputMetrics?.estimatedDelaySavedMinutes || 0,
    },
    advisories,
    auditLog,
    activeIncidents: snapshot.activeIncidents || [],
    recoveryPlans: snapshot.recoveryPlans || [],
    availableStrategies: snapshot.availableStrategies || [],
    rawSnapshot: snapshot,
    
    // CTC Alarm State
    unacknowledgedAlertIds,
    unacknowledgedCount,
    isAlarmAudioMuted,
    toggleAlarmAudio,
    acknowledgeAlert,
    acknowledgeAllAlerts,
    
    // Two-Step Confirmation System
    pendingConfirmation,
    requestConfirmation,
    cancelConfirmation,
    confirmPendingAction,

    // Real-Time Toast
    activeToast,
    showToast,

    // Bound Dispatchers
    start,
    pause,
    toggle,
    stop,
    reset,
    resetScenario,
    loadScenario,
    setSpeedMultiplier,
    setPredictionHorizon,
    applyRecommendation,
    dismissRecommendation,
    overrideTrainSpeed,
    holdTrain,
    releaseTrain,
    dispatchStrategy,
    dismissStrategy,
    declareIncident,
    clearIncident,
    authorizeRecoveryPlan,
    dismissRecoveryPlan,
  };
}
