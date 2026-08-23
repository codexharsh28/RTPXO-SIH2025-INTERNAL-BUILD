/**
 * RTPXO - Corridor Resilience Evaluator (Phase 9)
 * Purely observational and deterministic evaluator for multi-train corridor resilience.
 *
 * Evaluates holistic network stability, delay propagation suppression, conflict exposure,
 * bottleneck persistence, and kinematic recovery efficiency between baseline and strategic states.
 *
 * NOTE: PURE OBSERVATIONAL LAYER — Zero mutation of live SimulationEngine state.
 */

import { Train, RailwaySection } from "@/types/railway";
import { CandidateAction, PredictedStateSnapshot } from "@/types/optimization";
import { CorridorResilienceMetrics, StrategyPredictedImpact } from "@/types/strategy";

export class CorridorResiliencyEvaluator {
  /**
   * Computes comprehensive corridor resilience metrics by comparing a hypothetical
   * joint strategy forward state against the unadjusted baseline forward state.
   */
  public evaluateResilience(
    baselinePredictedState: PredictedStateSnapshot,
    strategyPredictedState: PredictedStateSnapshot,
    constituentActions: CandidateAction[],
    participatingTrains: Train[],
    sections: RailwaySection[],
    horizonSeconds: number = 300
  ): {
    metrics: CorridorResilienceMetrics;
    predictedImpact: StrategyPredictedImpact;
    compositeScore: number;
  } {
    // 1. Delay Propagation (Minutes): Change in cumulative delay across all trains
    const baselineDelay = baselinePredictedState.totalDelayMinutes;
    const strategyDelay = strategyPredictedState.totalDelayMinutes;
    const delayPropagationMinutes = Number((strategyDelay - baselineDelay).toFixed(2));
    const delaySavedMinutes = Math.max(0, Number((baselineDelay - strategyDelay).toFixed(2)));

    // 2. Conflict Exposure (Seconds): Cumulative predicted conflict-seconds across horizon
    const timeStepSeconds = 2.0;
    let conflictExposureSeconds = 0;

    if (strategyPredictedState.timeline && strategyPredictedState.timeline.length > 0) {
      for (const cp of strategyPredictedState.timeline) {
        conflictExposureSeconds += cp.activeConflictsCount * timeStepSeconds * 10;
      }
    } else {
      conflictExposureSeconds = strategyPredictedState.predictedConflictsCount * 30;
    }

    // 3. Throughput Degradation (%): Percentage below theoretical nominal throughput (30 T/h baseline)
    const nominalCorridorCapacityTpH = 30.0;
    const currentThroughput = strategyPredictedState.corridorThroughput;
    const throughputDegradationPercent = Number(
      Math.max(0, ((nominalCorridorCapacityTpH - currentThroughput) / nominalCorridorCapacityTpH) * 100).toFixed(1)
    );

    // 4. Bottleneck Persistence Ratio (0.0 to 1.0): Fraction of sections or timeline checkpoints bottle-necked
    let bottleneckPersistenceRatio = 0;
    if (strategyPredictedState.timeline && strategyPredictedState.timeline.length > 0) {
      const bottleneckCheckpoints = strategyPredictedState.timeline.filter(
        (cp) => cp.bottleneckSection !== null && cp.bottleneckSection !== undefined
      ).length;
      bottleneckPersistenceRatio = Number((bottleneckCheckpoints / strategyPredictedState.timeline.length).toFixed(2));
    } else {
      const bottleneckSections = strategyPredictedState.sections.filter((s) => s.isBottleneck).length;
      bottleneckPersistenceRatio = Number((bottleneckSections / Math.max(1, sections.length)).toFixed(2));
    }

    // 5. Recovery Time (Seconds): Projected time until active conflicts resolve or delay stabilizes
    let recoveryTimeSeconds = 0;
    if (strategyPredictedState.timeline && strategyPredictedState.timeline.length > 0) {
      const firstClearCheckpoint = strategyPredictedState.timeline.find(
        (cp) => cp.activeConflictsCount === 0 && cp.headways.every((h) => h.isHeadwayCompliant)
      );
      recoveryTimeSeconds = firstClearCheckpoint ? firstClearCheckpoint.offsetSeconds : horizonSeconds;
    } else {
      recoveryTimeSeconds = strategyPredictedState.predictedConflictsCount === 0 ? 0 : Math.min(horizonSeconds, 180);
    }

    // 6. Affected Train Count
    const affectedTrainCount = Math.max(
      constituentActions.length,
      participatingTrains.length
    );

    // 7. Recovery Efficiency: Delay minutes saved per unit of deceleration/braking applied
    let totalSpeedReductionApplied = 0;
    for (const action of constituentActions) {
      if (action.action === "HOLD_TRAIN") {
        totalSpeedReductionApplied += 80; // Approximate stop equivalent
      } else if (action.action === "REDUCE_SPEED" && action.targetSpeed !== undefined) {
        const train = participatingTrains.find((t) => t.id === action.affectedTrainId);
        const currentSpeed = train ? train.speed : 80;
        totalSpeedReductionApplied += Math.max(0, currentSpeed - action.targetSpeed);
      }
    }

    const recoveryEfficiencyRatio =
      totalSpeedReductionApplied > 0
        ? Number((delaySavedMinutes / (totalSpeedReductionApplied / 10)).toFixed(2))
        : delaySavedMinutes > 0
        ? 2.0
        : 1.0;

    // 8. Headway Buffer Margin (km above 2.0 km SIL-4 limit)
    let minHeadwayObserved = 10.0;
    if (strategyPredictedState.timeline && strategyPredictedState.timeline.length > 0) {
      for (const cp of strategyPredictedState.timeline) {
        for (const hw of cp.headways) {
          if (hw.separationDistanceKm < minHeadwayObserved) {
            minHeadwayObserved = hw.separationDistanceKm;
          }
        }
      }
    }
    const headwayBufferMarginKm = Number(Math.max(0, minHeadwayObserved - 2.0).toFixed(2));

    // 9. Kinematic Stability Index (0.0 to 1.0): Inverse variance of commanded speed deltas
    const speedDeltas: number[] = [];
    for (const action of constituentActions) {
      const train = participatingTrains.find((t) => t.id === action.affectedTrainId);
      if (train && action.targetSpeed !== undefined) {
        speedDeltas.push(Math.abs(train.speed - action.targetSpeed));
      }
    }
    const avgDelta = speedDeltas.length > 0 ? speedDeltas.reduce((a, b) => a + b, 0) / speedDeltas.length : 0;
    const variance =
      speedDeltas.length > 0
        ? speedDeltas.reduce((a, b) => a + Math.pow(b - avgDelta, 2), 0) / speedDeltas.length
        : 0;
    const kinematicStabilityIndex = Number((1 / (1 + variance / 50)).toFixed(2));

    // Compile Metrics
    const metrics: CorridorResilienceMetrics = {
      delayPropagationMinutes,
      conflictExposureSeconds,
      throughputDegradationPercent,
      bottleneckPersistenceRatio,
      recoveryTimeSeconds,
      affectedTrainCount,
      recoveryEfficiencyRatio,
      headwayBufferMarginKm,
      kinematicStabilityIndex,
    };

    // Projected Net Impacts
    const baselineThroughput = Math.max(1, baselinePredictedState.corridorThroughput);
    const throughputDelta = strategyPredictedState.corridorThroughput - baselineThroughput;
    const projectedCorridorThroughputGainPercent = Number(
      ((throughputDelta / baselineThroughput) * 100).toFixed(1)
    );

    const baselineBottlenecks = baselinePredictedState.sections.filter((s) => s.isBottleneck).length;
    const strategyBottlenecks = strategyPredictedState.sections.filter((s) => s.isBottleneck).length;
    const projectedBottleneckReliefPercent =
      baselineBottlenecks > 0
        ? Number((((baselineBottlenecks - strategyBottlenecks) / baselineBottlenecks) * 100).toFixed(1))
        : 0;

    const projectedConflictFreeHorizonSeconds = Math.max(0, horizonSeconds - conflictExposureSeconds);

    const predictedImpact: StrategyPredictedImpact = {
      projectedNetDelaySavedMinutes: delaySavedMinutes,
      projectedCorridorThroughputGainPercent,
      projectedBottleneckReliefPercent,
      projectedConflictFreeHorizonSeconds,
    };

    // Composite Mathematical Resiliency Score (Bounded, Deterministic)
    // Score = 35 * DelayRecovery + 30 * ThroughputGain + 20 * KinematicStability + 15 * HeadwayBuffer - ConflictPenalty
    const delayScore = Math.min(40, delaySavedMinutes * 10);
    const throughputScore = Math.min(30, Math.max(-10, projectedCorridorThroughputGainPercent * 1.5));
    const stabilityScore = kinematicStabilityIndex * 20;
    const bufferScore = Math.min(10, headwayBufferMarginKm * 5);
    const conflictPenalty = (conflictExposureSeconds / horizonSeconds) * 25;

    const compositeScore = Number(
      (delayScore + throughputScore + stabilityScore + bufferScore - conflictPenalty).toFixed(2)
    );

    return {
      metrics,
      predictedImpact,
      compositeScore,
    };
  }
}

export const corridorResiliencyEvaluator = new CorridorResiliencyEvaluator();
