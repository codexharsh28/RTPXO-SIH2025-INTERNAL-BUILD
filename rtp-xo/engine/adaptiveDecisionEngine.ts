/**
 * RTPXO - Adaptive Decision Intelligence & Policy Learning Engine (Phase 8D)
 * Deterministic online statistical learning from verified Phase 8C outcomes.
 * Provides historical evidence-weighted candidate ranking adjustments without altering railway physics or safety rules.
 */

import { Train, RailwaySection } from "@/types/railway";
import { RecommendationAction } from "@/types/advisor";
import { CongestionState } from "@/types/metrics";
import {
  CandidateAction,
  DecisionAuditRecord,
  AdaptiveDecisionInsight,
  AdaptiveLearningBucket,
  AdaptiveConfidenceLevel,
} from "@/types/optimization";
import { CoordinatedStrategyAuditRecord } from "@/types/strategy";
import { DisruptionRecoveryAuditRecord } from "@/types/incident";

export class AdaptiveDecisionEngine {
  private learningBuckets: Map<string, AdaptiveLearningBucket> = new Map();
  private retainedOutcomes: DecisionAuditRecord[] = [];
  private retainedStrategyOutcomes: CoordinatedStrategyAuditRecord[] = [];
  private readonly MAX_BUCKETS = 1000;
  private readonly MAX_RETAINED_OUTCOMES = 500;
  public readonly MAX_ADAPTIVE_BONUS = 10.0;
  public readonly MAX_ADAPTIVE_PENALTY = -10.0;

  /**
   * Constructs a standardized context key from operational parameters.
   */
  public buildContextKey(
    action: RecommendationAction | string,
    priorityClass: string,
    congestionState: CongestionState | string,
    conflictPresence: string,
    sectionId: string
  ): string {
    return `${action}|${priorityClass}|${congestionState}|${conflictPresence}|${sectionId}`;
  }

  /**
   * Derives categorical context dimensions for a train, section, and conflict state.
   */
  public extractContextDimensions(
    action: RecommendationAction | string,
    train: Train,
    sectionId: string,
    hasActiveConflict: boolean,
    congestionState: CongestionState | string = "MODERATE"
  ): {
    exactKey: string;
    sectionIndependentKey: string;
    congestionActionKey: string;
    actionOnlyKey: string;
  } {
    const priorityClass =
      train.priority >= 8 ? "HIGH" : train.type === "FREIGHT" ? "FREIGHT" : "STANDARD";
    const conflictPresence = hasActiveConflict ? "CONFLICT" : "CLEAR";

    const exactKey = this.buildContextKey(
      action,
      priorityClass,
      congestionState,
      conflictPresence,
      sectionId
    );

    const sectionIndependentKey = this.buildContextKey(
      action,
      priorityClass,
      congestionState,
      conflictPresence,
      "*"
    );

    const congestionActionKey = this.buildContextKey(
      action,
      "*",
      congestionState,
      "*",
      "*"
    );

    const actionOnlyKey = this.buildContextKey(action, "*", "*", "*", "*");

    return {
      exactKey,
      sectionIndependentKey,
      congestionActionKey,
      actionOnlyKey,
    };
  }

  /**
   * Retrieves statistical insight for a candidate action using the fallback hierarchy.
   */
  public evaluateAdaptiveInsight(
    candidate: CandidateAction,
    train: Train,
    section: RailwaySection,
    hasConflict: boolean,
    congestionState: CongestionState | string,
    baseObjectiveScore: number
  ): AdaptiveDecisionInsight {
    const {
      exactKey,
      sectionIndependentKey,
      congestionActionKey,
      actionOnlyKey,
    } = this.extractContextDimensions(
      candidate.action,
      train,
      section.id,
      hasConflict,
      congestionState
    );

    let matchedBucket: AdaptiveLearningBucket | undefined;
    let fallbackLevel: AdaptiveDecisionInsight["fallbackLevel"] = "NEUTRAL_PRIOR";
    let matchedKey = exactKey;

    if (this.learningBuckets.has(exactKey)) {
      matchedBucket = this.learningBuckets.get(exactKey);
      fallbackLevel = "EXACT";
      matchedKey = exactKey;
    } else if (this.learningBuckets.has(sectionIndependentKey)) {
      matchedBucket = this.learningBuckets.get(sectionIndependentKey);
      fallbackLevel = "SECTION_INDEPENDENT";
      matchedKey = sectionIndependentKey;
    } else if (this.learningBuckets.has(congestionActionKey)) {
      matchedBucket = this.learningBuckets.get(congestionActionKey);
      fallbackLevel = "CONGESTION_ACTION";
      matchedKey = congestionActionKey;
    } else if (this.learningBuckets.has(actionOnlyKey)) {
      matchedBucket = this.learningBuckets.get(actionOnlyKey);
      fallbackLevel = "ACTION_ONLY";
      matchedKey = actionOnlyKey;
    }

    // Safety constraint check: unsafe candidates are strictly non-rescuable
    if (baseObjectiveScore === -Infinity) {
      return {
        contextKey: exactKey,
        historicalSampleCount: matchedBucket?.attempts ?? 0,
        verifiedSampleCount: (matchedBucket?.verifiedAccurate ?? 0) + (matchedBucket?.deviated ?? 0),
        successRate: matchedBucket?.successRate ?? 0.5,
        confidenceScore: matchedBucket?.confidenceScore ?? 0,
        confidenceLevel: matchedBucket?.confidenceLevel ?? "LOW",
        adaptiveAdjustment: 0,
        adaptiveScore: -Infinity,
        baseObjectiveScore: -Infinity,
        evidenceSummary: "Safety constraint violation: Candidate strictly rejected regardless of historical policy learning.",
        fallbackLevel,
      };
    }

    if (!matchedBucket || (matchedBucket.verifiedAccurate + matchedBucket.deviated === 0)) {
      return {
        contextKey: exactKey,
        historicalSampleCount: matchedBucket?.attempts ?? 0,
        verifiedSampleCount: 0,
        successRate: 0.5,
        confidenceScore: 0,
        confidenceLevel: "LOW",
        adaptiveAdjustment: 0,
        adaptiveScore: baseObjectiveScore,
        baseObjectiveScore,
        evidenceSummary: `Neutral prior: No verified historical outcomes recorded for ${candidate.action} in this context.`,
        fallbackLevel: "NEUTRAL_PRIOR",
      };
    }

    const verifiedCount = matchedBucket.verifiedAccurate + matchedBucket.deviated;
    const successRate = matchedBucket.successRate;
    const confidenceScore = matchedBucket.confidenceScore;
    const confidenceLevel = matchedBucket.confidenceLevel;

    // Deterministic formula: Adjustment = (successRate - 0.5) * 20 * confidenceScore (bounded [-10, +10])
    const rawAdjustment = (successRate - 0.5) * 20 * confidenceScore;
    const adaptiveAdjustment = Math.max(
      this.MAX_ADAPTIVE_PENALTY,
      Math.min(this.MAX_ADAPTIVE_BONUS, Number(rawAdjustment.toFixed(2)))
    );

    const adaptiveScore = Number((baseObjectiveScore + adaptiveAdjustment).toFixed(2));

    const evidenceSummary =
      fallbackLevel === "EXACT"
        ? `Historical evidence: ${candidate.action} under exact context (${matchedKey}) succeeded in ${matchedBucket.verifiedAccurate} of ${verifiedCount} verified decisions (${Math.round(successRate * 100)}%). Adaptive score ${adaptiveAdjustment >= 0 ? "+" : ""}${adaptiveAdjustment}. Confidence: ${confidenceLevel}.`
        : `Historical evidence (${fallbackLevel.replace(/_/g, " ")}): ${candidate.action} succeeded in ${matchedBucket.verifiedAccurate} of ${verifiedCount} verified decisions (${Math.round(successRate * 100)}%). Adaptive score ${adaptiveAdjustment >= 0 ? "+" : ""}${adaptiveAdjustment}. Confidence: ${confidenceLevel}.`;

    return {
      contextKey: matchedKey,
      historicalSampleCount: matchedBucket.attempts,
      verifiedSampleCount: verifiedCount,
      successRate: Number(successRate.toFixed(3)),
      confidenceScore,
      confidenceLevel,
      adaptiveAdjustment,
      adaptiveScore,
      baseObjectiveScore,
      evidenceSummary,
      fallbackLevel,
    };
  }

  /**
   * Consumes a completed Phase 8C DecisionAuditRecord and updates online statistical learning buckets.
   */
  public recordOutcome(record: DecisionAuditRecord): void {
    if (!record.actualOutcome) return;

    this.retainedOutcomes.push(record);
    if (this.retainedOutcomes.length > this.MAX_RETAINED_OUTCOMES) {
      this.retainedOutcomes.shift();
    }

    const pre = record.preState;
    const congestionState: "FREE_FLOW" | "MODERATE" | "SATURATED" =
      pre.sectionOccupancyCount > 1
        ? "SATURATED"
        : pre.sectionOccupancyCount > 0
        ? "MODERATE"
        : "FREE_FLOW";

    const priorityClass = pre.trainPriorityClass || "STANDARD";
    const conflictPresence = pre.hasActiveConflict ? "CONFLICT" : "CLEAR";

    const exactKey = this.buildContextKey(
      record.action,
      priorityClass,
      congestionState,
      conflictPresence,
      pre.sectionId
    );

    const sectionIndependentKey = this.buildContextKey(
      record.action,
      priorityClass,
      congestionState,
      conflictPresence,
      "*"
    );

    const congestionActionKey = this.buildContextKey(
      record.action,
      "*",
      congestionState,
      "*",
      "*"
    );

    const actionOnlyKey = this.buildContextKey(record.action, "*", "*", "*", "*");

    const targetKeys = [exactKey, sectionIndependentKey, congestionActionKey, actionOnlyKey];

    const isAccurate = record.actualOutcome.verificationStatus === "VERIFIED_ACCURATE";
    const isDeviated = record.actualOutcome.verificationStatus === "DEVIATED";
    const isInconclusive = record.actualOutcome.verificationStatus === "INCONCLUSIVE";
    const isSuperseded = record.actualOutcome.attributionType === "SUPERSEDED";

    for (const key of targetKeys) {
      let bucket = this.learningBuckets.get(key);
      if (!bucket) {
        if (this.learningBuckets.size >= this.MAX_BUCKETS) {
          // Evict oldest bucket
          const oldestKey = this.learningBuckets.keys().next().value;
          if (oldestKey) this.learningBuckets.delete(oldestKey);
        }

        bucket = {
          contextKey: key,
          attempts: 0,
          verifiedAccurate: 0,
          deviated: 0,
          inconclusive: 0,
          superseded: 0,
          successRate: 0.5,
          averageDelayDelta: 0,
          averageThroughputDelta: 0,
          confidenceScore: 0,
          confidenceLevel: "LOW",
          lastUpdatedSimulationTime: record.simulationTime,
        };
        this.learningBuckets.set(key, bucket);
      }

      bucket.attempts++;
      bucket.lastUpdatedSimulationTime = record.simulationTime;

      if (isSuperseded) {
        bucket.superseded++;
      } else if (isInconclusive) {
        bucket.inconclusive++;
      } else if (isAccurate || isDeviated) {
        if (isAccurate) {
          bucket.verifiedAccurate++;
        } else if (isDeviated) {
          bucket.deviated++;
        }

        const verifiedSamples = bucket.verifiedAccurate + bucket.deviated;
        bucket.successRate = Number((bucket.verifiedAccurate / verifiedSamples).toFixed(3));

        // Confidence: scales with sample size up to 10 verified samples
        bucket.confidenceScore = Math.min(1.0, Number((verifiedSamples / 10).toFixed(2)));
        bucket.confidenceLevel =
          verifiedSamples >= 8 ? "HIGH" : verifiedSamples >= 3 ? "MEDIUM" : "LOW";

        // Incremental rolling averages
        bucket.averageDelayDelta = Number(
          (
            bucket.averageDelayDelta +
            (record.actualOutcome.actualDelayDeltaMinutes - bucket.averageDelayDelta) / verifiedSamples
          ).toFixed(2)
        );
        bucket.averageThroughputDelta = Number(
          (
            bucket.averageThroughputDelta +
            (record.actualOutcome.actualThroughputDelta - bucket.averageThroughputDelta) / verifiedSamples
          ).toFixed(2)
        );
      }
    }
  }

  /**
   * Consumes a completed Phase 8C CoordinatedStrategyAuditRecord and updates strategy cluster policy learning (Phase 9).
   */
  public recordStrategyOutcome(record: CoordinatedStrategyAuditRecord): void {
    if (!record.actualOutcome) return;

    this.retainedStrategyOutcomes.push(record);
    if (this.retainedStrategyOutcomes.length > this.MAX_RETAINED_OUTCOMES) {
      this.retainedStrategyOutcomes.shift();
    }

    const trainCountTag = `${record.participatingTrainIds.length}_TRAINS`;
    const exactStrategyKey = `STRATEGY|${record.planType}|${trainCountTag}|*|*`;
    const generalizedStrategyKey = `STRATEGY|${record.planType}|*|*|*`;
    const targetKeys = [exactStrategyKey, generalizedStrategyKey];

    const isAccurate = record.actualOutcome.verificationStatus === "VERIFIED_ACCURATE";
    const isDeviated = record.actualOutcome.verificationStatus === "DEVIATED";
    const isInconclusive = record.actualOutcome.verificationStatus === "INCONCLUSIVE";
    const isSuperseded = record.actualOutcome.attributionType === "SUPERSEDED";

    for (const key of targetKeys) {
      let bucket = this.learningBuckets.get(key);
      if (!bucket) {
        if (this.learningBuckets.size >= this.MAX_BUCKETS) {
          const oldestKey = this.learningBuckets.keys().next().value;
          if (oldestKey) this.learningBuckets.delete(oldestKey);
        }

        bucket = {
          contextKey: key,
          attempts: 0,
          verifiedAccurate: 0,
          deviated: 0,
          inconclusive: 0,
          superseded: 0,
          successRate: 0.5,
          averageDelayDelta: 0,
          averageThroughputDelta: 0,
          confidenceScore: 0,
          confidenceLevel: "LOW",
          lastUpdatedSimulationTime: record.dispatchedSimulationTime,
        };
        this.learningBuckets.set(key, bucket);
      }

      bucket.attempts++;
      bucket.lastUpdatedSimulationTime = record.dispatchedSimulationTime;

      if (isSuperseded) {
        bucket.superseded++;
      } else if (isInconclusive) {
        bucket.inconclusive++;
      } else if (isAccurate || isDeviated) {
        if (isAccurate) {
          bucket.verifiedAccurate++;
        } else if (isDeviated) {
          bucket.deviated++;
        }

        const verifiedSamples = bucket.verifiedAccurate + bucket.deviated;
        bucket.successRate = Number((bucket.verifiedAccurate / verifiedSamples).toFixed(3));

        bucket.confidenceScore = Math.min(1.0, Number((verifiedSamples / 10).toFixed(2)));
        bucket.confidenceLevel =
          verifiedSamples >= 8 ? "HIGH" : verifiedSamples >= 3 ? "MEDIUM" : "LOW";

        bucket.averageDelayDelta = Number(
          (
            bucket.averageDelayDelta +
            (record.actualOutcome.actualDelayDelta - bucket.averageDelayDelta) / verifiedSamples
          ).toFixed(2)
        );
        bucket.averageThroughputDelta = Number(
          (
            bucket.averageThroughputDelta +
            (record.actualOutcome.actualThroughputDelta - bucket.averageThroughputDelta) / verifiedSamples
          ).toFixed(2)
        );
      }
    }
  }

  private retainedRecoveryOutcomes: DisruptionRecoveryAuditRecord[] = [];

  /**
   * Consumes a completed DisruptionRecoveryAuditRecord and updates recovery-level policy learning (Phase 10 Step 5.3).
   */
  public recordRecoveryOutcome(record: DisruptionRecoveryAuditRecord): void {
    if (!record.recoveryCompletedSimulationTime && record.verificationStatus === "PENDING") return;

    this.retainedRecoveryOutcomes.push(record);
    if (this.retainedRecoveryOutcomes.length > this.MAX_RETAINED_OUTCOMES) {
      this.retainedRecoveryOutcomes.shift();
    }

    const phaseCountTag = `${record.phaseExecutionResults.length}_PHASES`;
    const exactRecoveryKey = `RECOVERY|${record.incidentType}|${record.incidentSeverity}|${phaseCountTag}|*`;
    const generalizedRecoveryKey = `RECOVERY|${record.incidentType}|*|*|*`;
    const targetKeys = [exactRecoveryKey, generalizedRecoveryKey];

    const isAccurate = record.verificationStatus === "VERIFIED_ACCURATE";
    const isDeviated = record.verificationStatus === "DEVIATED";
    const isInconclusive = record.verificationStatus === "INCONCLUSIVE";
    const isSuperseded = record.attributionType === "SUPERSEDED";

    for (const key of targetKeys) {
      let bucket = this.learningBuckets.get(key);
      if (!bucket) {
        if (this.learningBuckets.size >= this.MAX_BUCKETS) {
          const oldestKey = this.learningBuckets.keys().next().value;
          if (oldestKey) this.learningBuckets.delete(oldestKey);
        }

        bucket = {
          contextKey: key,
          attempts: 0,
          verifiedAccurate: 0,
          deviated: 0,
          inconclusive: 0,
          superseded: 0,
          successRate: 0.5,
          averageDelayDelta: 0,
          averageThroughputDelta: 0,
          confidenceScore: 0,
          confidenceLevel: "LOW",
          lastUpdatedSimulationTime: record.dispatchedSimulationTime,
        };
        this.learningBuckets.set(key, bucket);
      }

      bucket.attempts++;
      bucket.lastUpdatedSimulationTime = record.dispatchedSimulationTime;

      if (isSuperseded) {
        bucket.superseded++;
      } else if (isInconclusive) {
        bucket.inconclusive++;
      } else if (isAccurate || isDeviated) {
        if (isAccurate) {
          bucket.verifiedAccurate++;
        } else if (isDeviated) {
          bucket.deviated++;
        }

        const verifiedSamples = bucket.verifiedAccurate + bucket.deviated;
        bucket.successRate = Number((bucket.verifiedAccurate / verifiedSamples).toFixed(3));

        bucket.confidenceScore = Math.min(1.0, Number((verifiedSamples / 10).toFixed(2)));
        bucket.confidenceLevel =
          verifiedSamples >= 8 ? "HIGH" : verifiedSamples >= 3 ? "MEDIUM" : "LOW";

        const actualDelayDelta =
          record.actualResidualDelayMinutes !== undefined
            ? record.actualResidualDelayMinutes - record.preIncidentTotalDelayMinutes
            : 0;
        const actualThroughputDelta =
          record.recoveryCorridorThroughput !== undefined
            ? record.recoveryCorridorThroughput - record.preIncidentCorridorThroughput
            : 0;

        bucket.averageDelayDelta = Number(
          (
            bucket.averageDelayDelta +
            (actualDelayDelta - bucket.averageDelayDelta) / verifiedSamples
          ).toFixed(2)
        );
        bucket.averageThroughputDelta = Number(
          (
            bucket.averageThroughputDelta +
            (actualThroughputDelta - bucket.averageThroughputDelta) / verifiedSamples
          ).toFixed(2)
        );
      }
    }
  }

  /**
   * Returns a snapshot of a specific context bucket for inspection/auditing.
   */
  public getBucket(contextKey: string): AdaptiveLearningBucket | undefined {
    const bucket = this.learningBuckets.get(contextKey);
    return bucket ? structuredClone(bucket) : undefined;
  }

  /**
   * Returns all learned buckets.
   */
  public getAllBuckets(): AdaptiveLearningBucket[] {
    return Array.from(this.learningBuckets.values()).map((b) => structuredClone(b));
  }

  /**
   * Returns retained strategy audit outcomes.
   */
  public getRetainedStrategyOutcomes(): CoordinatedStrategyAuditRecord[] {
    return structuredClone(this.retainedStrategyOutcomes);
  }

  /**
   * Returns retained recovery audit outcomes.
   */
  public getRetainedRecoveryOutcomes(): DisruptionRecoveryAuditRecord[] {
    return structuredClone(this.retainedRecoveryOutcomes);
  }

  /**
   * Returns total count of learned buckets.
   */
  public getBucketCount(): number {
    return this.learningBuckets.size;
  }

  /**
   * Returns total retained outcomes count.
   */
  public getRetainedOutcomesCount(): number {
    return (
      this.retainedOutcomes.length +
      this.retainedStrategyOutcomes.length +
      this.retainedRecoveryOutcomes.length
    );
  }

  /**
   * Clears all online learned buckets and retained decision records.
   */
  public reset(): void {
    this.learningBuckets.clear();
    this.retainedOutcomes = [];
    this.retainedStrategyOutcomes = [];
    this.retainedRecoveryOutcomes = [];
  }
}

export const adaptiveDecisionEngine = new AdaptiveDecisionEngine();
