/**
 * RTPXO - Objective Function Evaluator (Phase 6 Transparent Objective Scoring)
 * Computes deterministic, explainable multi-objective scores for candidate actions
 * while strictly enforcing hard safety constraints.
 */

import { Train } from "@/types/railway";
import {
  CandidateAction,
  PredictedStateSnapshot,
  CandidateEvaluation,
  ObjectiveScoreBreakdown,
} from "@/types/optimization";

export class ObjectiveEvaluator {
  private readonly WEIGHT_THROUGHPUT = 40;
  private readonly WEIGHT_DELAY = 25;
  private readonly WEIGHT_BOTTLENECK = 20;
  private readonly WEIGHT_PRIORITY = 10;
  private readonly WEIGHT_BRAKING_LOSS = 15;
  private readonly WEIGHT_JUNCTION_WAIT = 10;

  /**
   * Evaluates a candidate action and computes its objective score breakdown.
   */
  public evaluateCandidate(
    candidate: CandidateAction,
    train: Train,
    currentState: PredictedStateSnapshot,
    predictedState: PredictedStateSnapshot,
    isSafe: boolean,
    safetyRejectionReason?: string
  ): CandidateEvaluation {
    if (!isSafe) {
      const breakdown: ObjectiveScoreBreakdown = {
        throughputGainScore: 0,
        delayRecoveryScore: 0,
        bottleneckReliefScore: 0,
        priorityScore: 0,
        brakingLossScore: -100,
        junctionWaitScore: 0,
        totalScore: -Infinity,
      };

      return {
        candidate,
        isSafe: false,
        safetyRejectionReason: safetyRejectionReason || "Safety constraint violation",
        predictedState,
        objectiveScore: -Infinity,
        scoreBreakdown: breakdown,
        expectedMetrics: {
          sectionThroughputDeltaPercent: 0,
          delayReductionMinutes: 0,
          bottleneckReliefPercent: 0,
        },
      };
    }

    // 1. Throughput Gain Delta
    const throughputDelta = Math.max(
      -10,
      predictedState.corridorThroughput - currentState.corridorThroughput
    );
    const throughputGainScore = Number((throughputDelta * this.WEIGHT_THROUGHPUT).toFixed(1));
    const throughputDeltaPercent = Number(
      (((predictedState.corridorThroughput - currentState.corridorThroughput) /
        (currentState.corridorThroughput || 1)) *
        100).toFixed(1)
    );

    // 2. Delay Recovery Delta
    const delaySavedMinutes = Math.max(
      0,
      currentState.totalDelayMinutes - predictedState.totalDelayMinutes
    );
    const delayRecoveryScore = Number((delaySavedMinutes * this.WEIGHT_DELAY).toFixed(1));

    // 3. Bottleneck Relief Score
    const currentBottlenecks = currentState.sections.filter((s) => s.isBottleneck).length;
    const predictedBottlenecks = predictedState.sections.filter((s) => s.isBottleneck).length;
    const bottleneckReliefPercent = currentBottlenecks > 0 ? ((currentBottlenecks - predictedBottlenecks) / currentBottlenecks) * 100 : 0;
    const bottleneckReliefScore = Number(((currentBottlenecks - predictedBottlenecks) * this.WEIGHT_BOTTLENECK).toFixed(1));

    // 4. Priority Satisfaction Score
    const priorityScore = Number(((train.priority / 10) * this.WEIGHT_PRIORITY).toFixed(1));

    // 5. Braking / Energy Loss Penalty
    const isStopping = candidate.action === "HOLD_TRAIN";
    const isReducingSpeed = candidate.action === "REDUCE_SPEED";
    const brakingLossScore = isStopping
      ? -this.WEIGHT_BRAKING_LOSS
      : isReducingSpeed
      ? -this.WEIGHT_BRAKING_LOSS * 0.4
      : 0;

    // 6. Junction Wait Time Score
    const junctionWaitScore = candidate.holdDurationSeconds
      ? -Number(((candidate.holdDurationSeconds / 60) * this.WEIGHT_JUNCTION_WAIT).toFixed(1))
      : 0;

    // Total Composite Score
    const totalScore = Number(
      (
        throughputGainScore +
        delayRecoveryScore +
        bottleneckReliefScore +
        priorityScore +
        brakingLossScore +
        junctionWaitScore +
        50 // Base normalization constant
      ).toFixed(1)
    );

    const scoreBreakdown: ObjectiveScoreBreakdown = {
      throughputGainScore,
      delayRecoveryScore,
      bottleneckReliefScore,
      priorityScore,
      brakingLossScore,
      junctionWaitScore,
      totalScore,
    };

    return {
      candidate,
      isSafe: true,
      predictedState,
      objectiveScore: totalScore,
      scoreBreakdown,
      expectedMetrics: {
        sectionThroughputDeltaPercent: Math.max(0, throughputDeltaPercent),
        delayReductionMinutes: Number(delaySavedMinutes.toFixed(1)),
        bottleneckReliefPercent: Math.max(0, bottleneckReliefPercent),
      },
    };
  }
}

export const objectiveEvaluator = new ObjectiveEvaluator();
