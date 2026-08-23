"use client";

import { useState, useEffect, useCallback } from "react";
import { SimulationSnapshot } from "@/types/simulation";
import { simulationEngine } from "@/engine/simulationEngine";
import { Train, RailwaySection } from "@/types/railway";
import { ActiveIncident } from "@/types/incident";
import { PredictionHorizonSeconds } from "@/types/optimization";

/**
 * useSimulationStore - Centralized React Hook for RTPXO
 *
 * Subscribes to the single authoritative SimulationEngine.
 * React components NEVER store duplicate copies of trains, speeds, delays, or metrics.
 * Every component consumes the exact same live immutable snapshot.
 */
export function useSimulationStore() {
  const [snapshot, setSnapshot] = useState<SimulationSnapshot>(() =>
    simulationEngine.getSnapshot()
  );

  useEffect(() => {
    const unsubscribe = simulationEngine.subscribe((newSnapshot) => {
      setSnapshot(newSnapshot);
    });

    return () => {
      unsubscribe();
    };
  }, []);

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
  const runBenchmark = useCallback((scenarioId?: string) => simulationEngine.runBenchmark(scenarioId), []);
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
    snapshot,
    // Top-Level State Selectors
    simulationTime: snapshot.simulationTime,
    simulationRunning: snapshot.simulationRunning,
    running: snapshot.running,
    simulationSpeedMultiplier: snapshot.simulationSpeedMultiplier,
    speedMultiplier: snapshot.speedMultiplier,
    activeScenarioId: snapshot.activeScenarioId,
    scenario: snapshot.scenario,
    trains: snapshot.trains,
    activeTrains: snapshot.activeTrains || snapshot.trains.filter((t) => !t.completed && t.status !== "COMPLETED" && t.speed > 0),
    getTrainById: (trainId: string) => snapshot.trains.find((t) => t.id === trainId),
    sections: snapshot.sections,
    blocks: snapshot.blocks,
    signals: snapshot.signals,
    stations: snapshot.stations,
    junctions: snapshot.junctions,
    routes: snapshot.routes,
    conflicts: snapshot.conflicts,
    predictedConflicts: snapshot.predictedConflicts,
    networkHealth: snapshot.networkHealth,
    networkCapacity: snapshot.networkCapacity,
    throughput: snapshot.throughput,
    averageDelay: snapshot.averageDelay,
    occupiedBlocks: snapshot.occupiedBlocks,
    clearBlocks: snapshot.clearBlocks,
    congestedSections: snapshot.congestedSections,
    recommendations: snapshot.recommendations,
    advisorRecommendations: snapshot.advisorRecommendations,
    networkAssessment: snapshot.networkAssessment,
    telemetry: snapshot.telemetry,
    throughputMetrics: snapshot.throughputMetrics,
    events: snapshot.events,
    activeIncidents: snapshot.activeIncidents,
    recoveryPlans: snapshot.recoveryPlans,
    availableStrategies: snapshot.availableStrategies,
    benchmarkComparison: snapshot.benchmarkComparison,
    // Actions
    start,
    pause,
    toggle,
    stop,
    reset,
    resetScenario,
    loadScenario,
    setSpeedMultiplier,
    setPredictionHorizon,
    runBenchmark,
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

/**
 * useNetworkState - Alias for useSimulationStore for network-level state selectors
 */
export const useNetworkState = useSimulationStore;
