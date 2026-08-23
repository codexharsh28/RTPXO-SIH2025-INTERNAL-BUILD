/**
 * RTPXO - Benchmark Runner (Phase 7E Honest Deterministic Baseline Comparison)
 * Executes identical simulation scenarios under Baseline Dispatcher (FCFS, uncoordinated)
 * vs RTPXO Predictive Optimizer, producing honest, unpadded comparative operational telemetry.
 */

import { Train } from "@/types/railway";
import {
  BenchmarkComparisonResult,
  BenchmarkRunTelemetry,
} from "@/types/optimization";
import { operationalScenarios } from "@/data/scenarios";
import { SimulationEngine } from "./simulationEngine";

export class BenchmarkRunner {
  /**
   * Runs an honest side-by-side benchmark comparison for a specified scenario.
   */
  public runBenchmark(
    scenarioId: string = "DELAYED_TRAIN",
    durationTicks: number = 20 // 20 ticks = 10s simulated at default config
  ): BenchmarkComparisonResult {
    const scenario =
      operationalScenarios.find((s) => s.id === scenarioId) ||
      operationalScenarios[0];

    // =========================================================================
    // RUN A: Baseline Conventional Dispatcher (No Predictive Advisory)
    // =========================================================================
    const baselineSim = new SimulationEngine(structuredClone(scenario.trains));
    let baselineStops = 0;

    for (let i = 0; i < durationTicks; i++) {
      // Step simulation without applying advisory recommendations
      baselineSim.step();
      const snap = baselineSim.getSnapshot();
      baselineStops += snap.trains.filter(
        (t) => (t.status === "HELD" || t.status === "STOPPED") && !t.completed
      ).length;
    }

    const baselineSnap = baselineSim.getSnapshot();
    const baselineThroughput = baselineSnap.throughputMetrics.corridorThroughput;
    const baselineDelay = baselineSnap.throughputMetrics.averageDelay;

    const baselineTelemetry: BenchmarkRunTelemetry = {
      mode: "BASELINE_DISPATCHER",
      scenarioId: scenario.id,
      durationSeconds: baselineSnap.simulationTime,
      corridorThroughput: baselineThroughput,
      averageDelayMinutes: baselineDelay,
      maximumDelayMinutes: baselineSnap.throughputMetrics.maximumDelay,
      completedTrainsCount: baselineSnap.throughputMetrics.trainsCompleted,
      bottleneckSectionUtilization: baselineSnap.throughputMetrics.corridorUtilization,
      conflictCount: baselineSnap.conflicts.length,
      conflictFreeTimeSeconds: baselineSnap.throughputMetrics.conflictFreeTimeSeconds,
      unnecessaryStopsCount: baselineStops,
      averageSpeedKmH: Math.round(
        baselineSnap.trains.reduce((acc, t) => acc + t.speed, 0) / (baselineSnap.trains.length || 1)
      ),
    };

    // =========================================================================
    // RUN B: RTPXO Predictive Optimizer (Proactive Multi-Train Intervention)
    // =========================================================================
    const optimizedSim = new SimulationEngine(structuredClone(scenario.trains));
    let optStops = 0;

    for (let i = 0; i < durationTicks; i++) {
      // Step simulation and automatically dispatch pending recommendations
      optimizedSim.step();
      const snap = optimizedSim.getSnapshot();
      for (const rec of snap.recommendations) {
        if (rec.status === "PENDING" && rec.isSafeToDispatch) {
          optimizedSim.applyRecommendation(rec.id);
        }
      }
      optStops += snap.trains.filter(
        (t) => (t.status === "HELD" || t.status === "STOPPED") && !t.completed
      ).length;
    }

    const optSnap = optimizedSim.getSnapshot();
    const optThroughput = optSnap.throughputMetrics.corridorThroughput;
    const optDelay = optSnap.throughputMetrics.averageDelay;

    const optimizedTelemetry: BenchmarkRunTelemetry = {
      mode: "RTPXO_OPTIMIZER",
      scenarioId: scenario.id,
      durationSeconds: optSnap.simulationTime,
      corridorThroughput: Number(optThroughput.toFixed(2)),
      averageDelayMinutes: optDelay,
      maximumDelayMinutes: optSnap.throughputMetrics.maximumDelay,
      completedTrainsCount: optSnap.throughputMetrics.trainsCompleted,
      bottleneckSectionUtilization: optSnap.throughputMetrics.corridorUtilization,
      conflictCount: optSnap.conflicts.length,
      conflictFreeTimeSeconds: optSnap.throughputMetrics.conflictFreeTimeSeconds,
      unnecessaryStopsCount: optStops,
      averageSpeedKmH: Math.round(
        optSnap.trains.reduce((acc, t) => acc + t.speed, 0) / (optSnap.trains.length || 1)
      ),
    };

    // =========================================================================
    // Delta Analytics (Raw Measured Comparison)
    // =========================================================================
    const throughputImprovementPercent = baselineTelemetry.corridorThroughput > 0
      ? Number(
          (
            ((optimizedTelemetry.corridorThroughput - baselineTelemetry.corridorThroughput) /
              baselineTelemetry.corridorThroughput) *
            100
          ).toFixed(1)
        )
      : 0;

    const delayReductionMinutes = Number(
      (baselineTelemetry.averageDelayMinutes - optimizedTelemetry.averageDelayMinutes).toFixed(1)
    );

    const stopsReducedCount =
      baselineTelemetry.unnecessaryStopsCount - optimizedTelemetry.unnecessaryStopsCount;

    const conflictFreeGainPercent = Number(
      (
        ((optimizedTelemetry.conflictFreeTimeSeconds - baselineTelemetry.conflictFreeTimeSeconds) /
          Math.max(1, baselineTelemetry.conflictFreeTimeSeconds + 1)) *
        100
      ).toFixed(1)
    );

    const efficiencyGainSummary = `RTPXO measured ${throughputImprovementPercent >= 0 ? "+" : ""}${throughputImprovementPercent}% section throughput delta and ${delayReductionMinutes >= 0 ? "+" : ""}${delayReductionMinutes} minutes delay delta vs conventional baseline dispatching.`;

    return {
      scenarioId: scenario.id,
      baseline: baselineTelemetry,
      optimized: optimizedTelemetry,
      throughputImprovementPercent,
      delayReductionMinutes,
      stopsReducedCount,
      conflictFreeGainPercent,
      efficiencyGainSummary,
      timestamp: Date.now(),
    };
  }
}

export const benchmarkRunner = new BenchmarkRunner();
