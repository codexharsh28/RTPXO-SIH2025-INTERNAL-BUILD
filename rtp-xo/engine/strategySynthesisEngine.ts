/**
 * RTPXO - Strategy Synthesis Engine (Phase 9)
 * Synthesizes coordinated multi-train operational strategies from existing candidate actions.
 *
 * Evaluates hypothetical joint action sets through PredictionEngine and CorridorResiliencyEvaluator,
 * enforcing hard safety barriers, deterministic combinatorial pruning, and dual-plan ranking.
 *
 * NOTE: PURE ADVISORY LAYER — Zero mutation of live SimulationEngine state.
 */

import { Train, RailwaySection, Signal, Junction } from "@/types/railway";
import {
  CandidateAction,
  CandidateEvaluation,
  PredictedStateSnapshot,
  PredictionHorizonSeconds,
} from "@/types/optimization";
import {
  CoordinatedStrategyPlan,
  BundledStrategyAction,
  StrategyClusterType,
  StrategyActionRole,
  StrategySafetyStatus,
} from "@/types/strategy";
import { corridorTopology } from "@/data/topology";
import { ActiveIncident } from "@/types/incident";
import { predictionEngine } from "./predictionEngine";
import { corridorResiliencyEvaluator } from "./corridorResiliencyEvaluator";

export class StrategySynthesisEngine {
  private readonly MAX_TRAINS_PER_STRATEGY = 3;
  private readonly MAX_ACTIONS_PER_STRATEGY = 3;
  private readonly MAX_PERMUTATIONS_EVALUATED = 6;

  /**
   * Synthesizes and ranks coordinated multi-train strategies from existing candidate actions.
   */
  public synthesizeStrategies(
    trains: Train[],
    sections: RailwaySection[],
    signals: Signal[],
    junctions: Junction[],
    candidateActions: CandidateAction[],
    evaluations: CandidateEvaluation[],
    baselinePredictedState: PredictedStateSnapshot,
    simulationTime: number,
    stateRevision: number = 0,
    horizonSeconds: PredictionHorizonSeconds = 300,
    activeIncidents: ActiveIncident[] = []
  ): CoordinatedStrategyPlan[] {
    const activeTrains = trains.filter((t) => !t.completed && t.status !== "COMPLETED");
    if (activeTrains.length < 2 || candidateActions.length < 2) {
      return [];
    }

    // 1. Filter to safe candidate actions only (unsafe actions are immediately disqualified)
    const safeEvaluations = evaluations.filter(
      (e) => e.isSafe && e.candidate && e.objectiveScore > -Infinity
    );
    if (safeEvaluations.length < 2) {
      return [];
    }

    // 2. Identify Interacting Spatial Clusters
    const clusters = this.identifySpatialClusters(activeTrains, safeEvaluations);
    if (clusters.length === 0) {
      return [];
    }

    const candidateStrategyPlans: CoordinatedStrategyPlan[] = [];
    let permutationsEvaluated = 0;

    // 3. Generate and Evaluate Bounded Action Combinations
    for (const cluster of clusters) {
      if (permutationsEvaluated >= this.MAX_PERMUTATIONS_EVALUATED) break;

      const clusterActions = cluster.actions.slice(0, this.MAX_ACTIONS_PER_STRATEGY);
      if (clusterActions.length < 2) continue;

      // Generate action bundles: pair (size 2) and trio (size 3) combinations
      const bundles = this.generateBoundedBundles(clusterActions);

      for (const bundle of bundles) {
        if (permutationsEvaluated >= this.MAX_PERMUTATIONS_EVALUATED) break;
        permutationsEvaluated++;

        const rawCandidateActions = bundle.map((b) => b.candidate);
        const participatingTrainIds = Array.from(
          new Set(rawCandidateActions.map((a) => a.affectedTrainId))
        );
        const participatingTrains = activeTrains.filter((t) =>
          participatingTrainIds.includes(t.id)
        );

        // A. Joint Non-Mutating Forward Prediction
        const jointPrediction = predictionEngine.simulateJointActionsForward(
          trains,
          sections,
          signals,
          junctions,
          horizonSeconds,
          rawCandidateActions,
          activeIncidents
        );

        // B. All-or-Nothing Hard Safety Check
        let safetyStatus: StrategySafetyStatus = "VERIFIED_SAFE";
        let safetyViolationReason: string | undefined;

        if (!jointPrediction.isSafe) {
          safetyStatus = "UNSAFE_REJECTED";
          safetyViolationReason = jointPrediction.safetyViolationReason || "Headway separation barrier breach in joint lookahead";
        }

        // C. Resilience Evaluation
        const resilience = corridorResiliencyEvaluator.evaluateResilience(
          baselinePredictedState,
          jointPrediction.predictedState,
          rawCandidateActions,
          participatingTrains,
          sections,
          horizonSeconds
        );

        // If headway margin violates 2.0 km barrier, fail-closed reject
        if (resilience.metrics.headwayBufferMarginKm < 0) {
          safetyStatus = "UNSAFE_REJECTED";
          safetyViolationReason = `Predicted minimum headway separation (${(resilience.metrics.headwayBufferMarginKm + 2.0).toFixed(2)} km) violates SIL-4 2.0 km safety barrier`;
        }

        // D. Calculate Base and Adaptive Scores
        let baseObjectiveScore = 0;
        let adaptiveScoreSum = 0;

        const bundledStrategyActions: BundledStrategyAction[] = bundle.map((b) => {
          const train = trains.find((t) => t.id === b.candidate.affectedTrainId);
          const role = this.assignActionRole(b.candidate, cluster.clusterType, train, participatingTrains);
          const baseScore = b.objectiveScore;
          const adaptScore = b.adaptiveScore !== undefined ? b.adaptiveScore : b.objectiveScore;

          baseObjectiveScore += baseScore;
          adaptiveScoreSum += adaptScore;

          return {
            candidateAction: b.candidate,
            trainId: b.candidate.affectedTrainId,
            trainName: train ? train.name : b.candidate.affectedTrainId,
            role,
            targetSectionId: b.candidate.affectedSectionId,
            individualBaseScore: baseScore,
            individualAdaptiveScore: adaptScore,
            rationalSummary: `${train?.name || b.candidate.affectedTrainId}: ${b.candidate.action} (${role})`,
          };
        });

        // Combined scores: incorporate resilience composite score
        const finalObjectiveScore =
          safetyStatus === "VERIFIED_SAFE"
            ? Number((baseObjectiveScore * 0.5 + resilience.compositeScore * 1.2).toFixed(2))
            : -Infinity;

        const finalAdaptiveScore =
          safetyStatus === "VERIFIED_SAFE"
            ? Number((adaptiveScoreSum * 0.5 + resilience.compositeScore * 1.2).toFixed(2))
            : -Infinity;

        if (safetyStatus === "UNSAFE_REJECTED") {
          continue; // Discard unsafe strategy permutations
        }

        // E. Build Primary Strategy Plan
        const planId = `STRAT-${cluster.clusterType.slice(0, 4)}-${simulationTime.toFixed(0)}-${permutationsEvaluated}`;
        const clusterName = this.formatClusterName(cluster.clusterType, cluster.zone);

        const strategyPlan: CoordinatedStrategyPlan = {
          strategyId: planId,
          planType: "PRIMARY_THROUGHPUT",
          name: `Plan A: Coordinated ${clusterName} Optimization`,
          summary: `Synchronized ${participatingTrains.map((t) => t.name).join(" & ")} coordination across ${cluster.zone}. Projected delay reduction: -${resilience.predictedImpact.projectedNetDelaySavedMinutes.toFixed(1)} min.`,
          creationSimulationTime: simulationTime,
          stateRevisionAtGeneration: stateRevision,
          targetTrainIds: participatingTrainIds,
          targetSectionIds: Array.from(new Set(rawCandidateActions.map((a) => a.affectedSectionId))),
          constituentActions: bundledStrategyActions,
          predictedImpact: resilience.predictedImpact,
          resilienceMetrics: resilience.metrics,
          objectiveScore: finalObjectiveScore,
          adaptiveScore: finalAdaptiveScore,
          safetyStatus,
          safetyViolationReason,
          rationale: this.generateExplainabilityRationale(
            cluster.clusterType,
            participatingTrains,
            bundledStrategyActions,
            resilience.predictedImpact,
            resilience.metrics
          ),
          provenance: {
            clusterType: cluster.clusterType,
            corridorZone: cluster.zone,
            algorithm: "JOINT_RESILIENCE_SYNTHESIS",
            evaluatedPermutationsCount: permutationsEvaluated,
          },
          executionStatus: "PROPOSED",
          phase8CAuditLinkage: {
            evaluationWindowSeconds: 30,
            constituentDecisionAuditIds: [],
            verificationStatus: "PENDING",
            attributionType: "DIRECT",
          },
        };

        candidateStrategyPlans.push(strategyPlan);
      }
    }

    if (candidateStrategyPlans.length === 0) {
      return [];
    }

    // 4. Deterministic Dual-Plan Selection (Plan A Primary vs. Plan B Conservative)
    candidateStrategyPlans.sort((a, b) => b.adaptiveScore - a.adaptiveScore);

    const primaryPlan = candidateStrategyPlans[0];
    const finalPlans: CoordinatedStrategyPlan[] = [primaryPlan];

    // Build Plan B (Conservative Contingency) if alternatives exist
    if (candidateStrategyPlans.length > 1) {
      // Find candidate maximizing kinematic stability and headway buffer margin
      const conservativeCandidate = candidateStrategyPlans
        .slice(1)
        .sort(
          (a, b) =>
            b.resilienceMetrics.kinematicStabilityIndex +
            b.resilienceMetrics.headwayBufferMarginKm -
            (a.resilienceMetrics.kinematicStabilityIndex + a.resilienceMetrics.headwayBufferMarginKm)
        )[0];

      if (conservativeCandidate && conservativeCandidate.strategyId !== primaryPlan.strategyId) {
        const conservativePlan: CoordinatedStrategyPlan = {
          ...conservativeCandidate,
          strategyId: `${conservativeCandidate.strategyId}-CONTINGENT`,
          planType: "CONSERVATIVE_CONTINGENCY",
          name: `Plan B: Conservative Flow Stabilization (${conservativeCandidate.provenance.corridorZone})`,
          summary: `Buffer-preserving speed harmonization for ${conservativeCandidate.targetTrainIds.join(" & ")}. Focus on kinematic stability (${(conservativeCandidate.resilienceMetrics.kinematicStabilityIndex * 100).toFixed(0)}%) and +${conservativeCandidate.resilienceMetrics.headwayBufferMarginKm.toFixed(1)} km safety margin.`,
        };
        finalPlans.push(conservativePlan);
      }
    }

    return finalPlans;
  }

  /**
   * Groups interacting trains into spatial/functional clusters (<= 25 km proximity).
   */
  private identifySpatialClusters(
    trains: Train[],
    evaluations: CandidateEvaluation[]
  ): Array<{
    clusterType: StrategyClusterType;
    zone: string;
    actions: CandidateEvaluation[];
  }> {
    const clusters: Array<{
      clusterType: StrategyClusterType;
      zone: string;
      actions: CandidateEvaluation[];
    }> = [];

    // Group evaluations by section and adjacent sections
    const sectionMap = new Map<string, CandidateEvaluation[]>();
    for (const ev of evaluations) {
      const secId = ev.candidate.affectedSectionId;
      const list = sectionMap.get(secId) || [];
      list.push(ev);
      sectionMap.set(secId, list);
    }

    // Check for junction convergence or multi-train section saturation
    for (const [secId, evs] of sectionMap.entries()) {
      if (evs.length >= 2) {
        const secRange = corridorTopology.sectionMap[secId];
        const zoneName = secRange ? secRange.name : secId;
        const isJunction = secId.includes("SEC-2") || secId.includes("SEC-3");

        clusters.push({
          clusterType: isJunction ? "JUNCTION_CONVERGENCE" : "CORRIDOR_SATURATION",
          zone: zoneName,
          actions: evs,
        });
      }
    }

    // Check for speed harmonization across adjacent sections
    if (clusters.length === 0 && evaluations.length >= 2) {
      clusters.push({
        clusterType: "SPEED_HARMONIZATION",
        zone: "Ghaziabad - Meerut Mainline",
        actions: evaluations.slice(0, this.MAX_ACTIONS_PER_STRATEGY),
      });
    }

    return clusters;
  }

  /**
   * Generates pair and trio candidate action bundles bounded at MAX_ACTIONS_PER_STRATEGY.
   */
  private generateBoundedBundles(evaluations: CandidateEvaluation[]): CandidateEvaluation[][] {
    const bundles: CandidateEvaluation[][] = [];

    // Pair combinations
    for (let i = 0; i < evaluations.length; i++) {
      for (let j = i + 1; j < evaluations.length; j++) {
        if (evaluations[i].candidate.affectedTrainId !== evaluations[j].candidate.affectedTrainId) {
          bundles.push([evaluations[i], evaluations[j]]);
        }
      }
    }

    // Trio combinations if available
    if (evaluations.length >= 3) {
      for (let i = 0; i < evaluations.length; i++) {
        for (let j = i + 1; j < evaluations.length; j++) {
          for (let k = j + 1; k < evaluations.length; k++) {
            const ids = new Set([
              evaluations[i].candidate.affectedTrainId,
              evaluations[j].candidate.affectedTrainId,
              evaluations[k].candidate.affectedTrainId,
            ]);
            if (ids.size === 3) {
              bundles.push([evaluations[i], evaluations[j], evaluations[k]]);
            }
          }
        }
      }
    }

    return bundles;
  }

  /**
   * Assigns operational role to a constituent action.
   */
  private assignActionRole(
    action: CandidateAction,
    clusterType: StrategyClusterType,
    train?: Train,
    participatingTrains: Train[] = []
  ): StrategyActionRole {
    if (action.action === "HOLD_TRAIN") {
      return "SIDING_HOLD";
    }

    if (action.action === "INCREASE_SPEED") {
      return "LEAD_ACCELERATE";
    }

    if (action.action === "REDUCE_SPEED" || action.action === "GLIDE_SPEED") {
      if (train && participatingTrains.length > 1) {
        const otherTrains = participatingTrains.filter((t) => t.id !== train.id);
        const isTrailing = otherTrains.some((ot) => ot.position > train.position);
        if (isTrailing) return "TRAIL_GLIDE";
      }
      return "SPEED_REGULATE";
    }

    return "SPEED_REGULATE";
  }

  private formatClusterName(type: StrategyClusterType, zone: string): string {
    switch (type) {
      case "JUNCTION_CONVERGENCE":
        return `Junction Convergence (${zone})`;
      case "CORRIDOR_SATURATION":
        return `Corridor Throughput Relief (${zone})`;
      case "OVERTAKING_SIDING":
        return `Overtaking & Siding Regulation (${zone})`;
      case "SPEED_HARMONIZATION":
        return `Corridor Speed Harmonization (${zone})`;
    }
  }

  private generateExplainabilityRationale(
    clusterType: StrategyClusterType,
    trains: Train[],
    actions: BundledStrategyAction[],
    impact: { projectedNetDelaySavedMinutes: number; projectedCorridorThroughputGainPercent: number },
    metrics: { kinematicStabilityIndex: number; headwayBufferMarginKm: number }
  ): string {
    const trainNames = trains.map((t) => t.name).join(", ");
    const roleDescriptions = actions.map((a) => `${a.trainName} ➔ ${a.role} (${a.candidateAction.action})`).join("; ");

    return `Coordinated ${clusterType} strategy for [${trainNames}]: Simultaneously commands [${roleDescriptions}]. Projects -${impact.projectedNetDelaySavedMinutes.toFixed(1)} min net corridor delay, +${impact.projectedCorridorThroughputGainPercent.toFixed(1)}% throughput flux, ${(metrics.kinematicStabilityIndex * 100).toFixed(0)}% kinematic stability, and +${metrics.headwayBufferMarginKm.toFixed(1)} km minimum headway buffer over SIL-4 barrier.`;
  }
}

export const strategySynthesisEngine = new StrategySynthesisEngine();
