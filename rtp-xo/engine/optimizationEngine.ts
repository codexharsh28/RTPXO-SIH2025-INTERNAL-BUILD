/**
 * RTPXO - Optimization Engine (Phase 6 Master Multi-Train Optimizer)
 * Coordinates candidate action generation, rolling forward lookahead simulations,
 * hard safety validation, objective function scoring, and decision selection.
 */

import { Train, RailwaySection, Signal, Junction, TrainConflict } from "@/types/railway";
import {
  AIRecommendation,
  NetworkAssessment,
  PredictedConflict,
  RecommendationUrgency,
  RecommendationConstraints,
  RecommendationExpectedEffect,
  CounterfactualComparison,
  WhatIfProjection,
} from "@/types/advisor";
import {
  CandidateAction,
  CandidateEvaluation,
  RejectedAlternative,
  PredictionHorizonSeconds,
} from "@/types/optimization";
import { ThroughputMetrics, SectionUtilization, CongestionState } from "@/types/metrics";
import { corridorTopology, resolveNextSection } from "@/data/topology";
import { ActiveIncident, DisruptionRecoveryPlan } from "@/types/incident";

import { predictionEngine } from "./predictionEngine";
import { speedTrajectoryModel } from "./speedTrajectoryModel";
import { junctionOptimizer } from "./junctionOptimizer";
import { bottleneckOptimizer } from "./bottleneckOptimizer";
import { objectiveEvaluator } from "./objectiveEvaluator";
import { AdaptiveDecisionEngine, adaptiveDecisionEngine } from "./adaptiveDecisionEngine";
import { strategySynthesisEngine } from "./strategySynthesisEngine";
import { recoveryPlanEngine } from "./recoveryPlanEngine";
import { CoordinatedStrategyPlan } from "@/types/strategy";

export class OptimizationEngine {
  /**
   * Evaluates the entire multi-train network state and produces optimized, explainable recommendations.
   */
  public optimizeNetwork(
    trains: Train[],
    sections: RailwaySection[],
    signals: Signal[],
    junctions: Junction[],
    activeConflicts: TrainConflict[],
    predictedConflicts: PredictedConflict[],
    throughput: ThroughputMetrics,
    sectionUtilizations: SectionUtilization[],
    simulationTime: number,
    horizonSeconds: PredictionHorizonSeconds = 300,
    adaptiveEngine: AdaptiveDecisionEngine = adaptiveDecisionEngine,
    stateRevision: number = 0,
    activeIncidents: ActiveIncident[] = []
  ): {
    recommendations: AIRecommendation[];
    evaluations: CandidateEvaluation[];
    availableStrategies?: CoordinatedStrategyPlan[];
    availableRecoveryPlans?: DisruptionRecoveryPlan[];
  } {
    const activeTrains = trains.filter((t) => !t.completed && t.status !== "COMPLETED");
    const candidateActions: CandidateAction[] = [];
    const recommendations: AIRecommendation[] = [];
    const allEvaluations: CandidateEvaluation[] = [];

    // 1. Establish Current / Baseline Forward State (Do Nothing)
    const baseForward = predictionEngine.simulateForward(
      trains,
      sections,
      signals,
      junctions,
      horizonSeconds,
      [],
      activeIncidents
    );
    const currentBaselineState = baseForward.predictedState;

    // 2. Generate Candidate Action Space

    // A. Conflict & Headway Mitigation Candidates
    for (const conflict of activeConflicts) {
      const trainA = trains.find((t) => t.id === conflict.trainA);
      const trainB = trains.find((t) => t.id === conflict.trainB);
      if (!trainA || !trainB) continue;

      const lead = trainA.position >= trainB.position ? trainA : trainB;
      const trail = trainA.position >= trainB.position ? trainB : trainA;

      if (trainA.currentSection === trainB.currentSection) {
        // Candidate 1: Moderate speed (scaled to lead train velocity)
        const moderateSpeed = Math.max(10, Math.min(trail.speed, Math.round(lead.speed * 0.75)));
        candidateActions.push({
          id: `CAND-HEADWAY-${trail.id}-MODERATE`,
          affectedTrainId: trail.id,
          action: "REDUCE_SPEED",
          targetSpeed: moderateSpeed,
          affectedSectionId: trail.currentSection,
          description: `Moderate speed of ${trail.name} to ${moderateSpeed} km/h to preserve headway behind ${lead.name}`,
        });

        // Candidate 2: Aggressive deceleration
        const slowSpeed = Math.max(10, Math.min(trail.speed, Math.round(lead.speed * 0.5)));
        candidateActions.push({
          id: `CAND-HEADWAY-${trail.id}-SLOW`,
          affectedTrainId: trail.id,
          action: "REDUCE_SPEED",
          targetSpeed: slowSpeed,
          affectedSectionId: trail.currentSection,
          description: `Decelerate ${trail.name} to ${slowSpeed} km/h`,
        });

        // Candidate 3: Hold trailing train
        candidateActions.push({
          id: `CAND-HEADWAY-${trail.id}-HOLD`,
          affectedTrainId: trail.id,
          action: "HOLD_TRAIN",
          holdDurationSeconds: 60,
          affectedSectionId: trail.currentSection,
          description: `Hold trailing train ${trail.name} until safe headway separation is restored`,
        });
      }
    }

    // B. Junction Sequencing Candidates
    const junctionSequences = junctionOptimizer.evaluateJunctionSequences(
      trains,
      sections,
      junctions
    );
    for (const juncSeq of junctionSequences) {
      candidateActions.push(juncSeq.candidateAction);
    }

    // C. Bottleneck Interventions
    const bottleneckInterventions = bottleneckOptimizer.generateBottleneckInterventions(
      trains,
      sections,
      sectionUtilizations
    );
    for (const bnAction of bottleneckInterventions) {
      candidateActions.push(bnAction);
    }

    // D. Active Incident & Disruption Mitigation Candidates (Phase 10)
    for (const inc of activeIncidents) {
      if (inc.status === "RESOLVED_CLOSED") continue;

      if (inc.type === "TEMPORARY_SPEED_RESTRICTION" && inc.imposedSpeedLimitKmH !== undefined) {
        const tsrSpeed = inc.imposedSpeedLimitKmH;
        const affectedTrains = trains.filter(
          (t) =>
            !t.completed &&
            t.status !== "COMPLETED" &&
            (t.currentSection === inc.affectedSectionId ||
              resolveNextSection(t.currentSection) === inc.affectedSectionId)
        );

        for (const t of affectedTrains) {
          if (t.speed > tsrSpeed) {
            candidateActions.push({
              id: `CAND-INC-TSR-${t.id}-${inc.id}`,
              affectedTrainId: t.id,
              action: "REDUCE_SPEED",
              targetSpeed: tsrSpeed,
              affectedSectionId: inc.affectedSectionId,
              description: `Regulate speed of ${t.name} to ${tsrSpeed} km/h for active TSR on ${inc.affectedSectionId} (${inc.reason})`,
            });
          }
        }
      } else if (inc.type === "TRACK_SECTION_BLOCKAGE" || inc.isCompleteBlockage) {
        // Hold approaching trains upstream of blocked block
        const approachingTrains = trains.filter(
          (t) =>
            !t.completed &&
            t.status !== "COMPLETED" &&
            resolveNextSection(t.currentSection) === inc.affectedSectionId
        );

        for (const t of approachingTrains) {
          candidateActions.push({
            id: `CAND-INC-HOLD-${t.id}-${inc.id}`,
            affectedTrainId: t.id,
            action: "HOLD_TRAIN",
            holdDurationSeconds: 120,
            affectedSectionId: t.currentSection,
            description: `Hold approaching train ${t.name} upstream of blocked section ${inc.affectedSectionId} (${inc.reason})`,
          });
        }
      }
    }

    // E. Schedule Recovery & Speed Gliding Candidates
    for (const train of activeTrains) {
      const sectionRange = corridorTopology.sectionMap[train.currentSection];
      const section = sections.find((s) => s.id === train.currentSection);
      if (!section || !sectionRange) continue;

      const nextSectionRange = corridorTopology.sections.find(
        (sec) => sec.startStationId === sectionRange.endStationId
      );
      const isDownstreamOccupied = nextSectionRange
        ? trains.some((t) => t.currentSection === nextSectionRange.id && !t.completed)
        : false;

      const trainsInThisSec = trains.filter(
        (t) => t.currentSection === section.id && !t.completed
      );
      const isSecSaturated = trainsInThisSec.length > (section.capacity || 1);
      const leadTrain = trainsInThisSec.reduce((max, t) => (t.position > max.position ? t : max), trainsInThisSec[0]);
      const isLeadInSec = trainsInThisSec.length <= 1 || leadTrain.id === train.id;

      // Saturated section regulation for trailing trains
      if (isSecSaturated && !isLeadInSec) {
        const regSpeed = Math.max(10, Math.min(train.speed, Math.round(leadTrain.speed * 0.8)));
        candidateActions.push({
          id: `CAND-CAP-REGULATE-${train.id}`,
          affectedTrainId: train.id,
          action: "REDUCE_SPEED",
          targetSpeed: regSpeed,
          affectedSectionId: train.currentSection,
          description: `Regulate speed of trailing train ${train.name} to ${regSpeed} km/h in saturated section ${section.name}`,
        });
      }

      const isApproachingJuncConflict = activeConflicts.some(
        (c) => (c.trainA === train.id || c.trainB === train.id) && (c.junctionId !== undefined || c.type === "JUNCTION_CONVERGENCE")
      );

      // Delayed train acceleration candidate (only if lead in clear/un-saturated section, downstream is clear, and not approaching junction conflict)
      if (
        (train.status === "DELAYED" || train.delayMinutes > 0) &&
        isLeadInSec &&
        !isSecSaturated &&
        !isDownstreamOccupied &&
        !isApproachingJuncConflict &&
        train.speed < section.maximumSpeed
      ) {
        const optimalSpeed = Math.min(train.maxSpeed || 130, section.maximumSpeed);
        candidateActions.push({
          id: `CAND-ACCEL-${train.id}`,
          affectedTrainId: train.id,
          action: "INCREASE_SPEED",
          targetSpeed: optimalSpeed,
          affectedSectionId: train.currentSection,
          description: `Accelerate ${train.name} to line speed ${optimalSpeed} km/h for delay recovery`,
        });
      }

      // Glide deceleration candidate
      if (train.position >= 60 && isDownstreamOccupied && train.speed > 60) {
        const glideSpeed = Math.min(60, train.maxSpeed || 130);
        candidateActions.push({
          id: `CAND-GLIDE-${train.id}`,
          affectedTrainId: train.id,
          action: "REDUCE_SPEED",
          targetSpeed: glideSpeed,
          affectedSectionId: train.currentSection,
          description: `Glide approach for ${train.name} at ${glideSpeed} km/h before occupied block`,
        });
      }
    }

    // 3. Evaluate Every Candidate via Forward Prediction & Objective Scoring
    const trainEvaluationsMap = new Map<string, CandidateEvaluation[]>();

    for (const candidate of candidateActions) {
      const train = trains.find((t) => t.id === candidate.affectedTrainId);
      const section = sections.find((s) => s.id === candidate.affectedSectionId) || sections.find((s) => s.id === train?.currentSection);
      if (!train || !section) continue;

      // Simulate forward under this candidate action factoring in active incident constraints
      const simResult = predictionEngine.simulateForward(
        trains,
        sections,
        signals,
        junctions,
        horizonSeconds,
        [candidate],
        activeIncidents
      );

      // Score candidate (Base deterministic score)
      const evaluation = objectiveEvaluator.evaluateCandidate(
        candidate,
        train,
        currentBaselineState,
        simResult.predictedState,
        simResult.isSafe,
        simResult.safetyViolationReason
      );

      // Determine operational context for adaptive scoring
      const secUtil = sectionUtilizations.find((u) => u.sectionId === section.id);
      const congestionState: CongestionState =
        secUtil?.congestionState ||
        (trains.filter((t) => t.currentSection === section.id && !t.completed).length > (section.capacity || 1)
          ? "SATURATED"
          : "MODERATE");

      const hasConflict = activeConflicts.some(
        (c) => c.trainA === train.id || c.trainB === train.id || c.sectionA === section.id || c.sectionB === section.id
      );

      // Apply Phase 8D Adaptive Intelligence Layer
      const adaptiveInsight = adaptiveEngine.evaluateAdaptiveInsight(
        candidate,
        train,
        section,
        hasConflict,
        congestionState,
        evaluation.objectiveScore
      );

      evaluation.adaptiveInsight = adaptiveInsight;
      evaluation.adaptiveScore = adaptiveInsight.adaptiveScore;

      allEvaluations.push(evaluation);

      const list = trainEvaluationsMap.get(train.id) || [];
      list.push(evaluation);
      trainEvaluationsMap.set(train.id, list);
    }

    // 4. Select Optimal Action per Train & Record Rejected Alternatives (Adaptive Ranking)
    for (const [trainId, evals] of trainEvaluationsMap.entries()) {
      const train = trains.find((t) => t.id === trainId);
      const section = sections.find((s) => s.id === train?.currentSection);
      if (!train || !section) continue;

      // Filter safe candidates and sort descending by adaptiveScore (fallback to base objectiveScore)
      const safeEvals = evals
        .filter((e) => e.isSafe)
        .sort((a, b) => {
          const scoreA = a.adaptiveScore ?? a.objectiveScore;
          const scoreB = b.adaptiveScore ?? b.objectiveScore;
          if (scoreB !== scoreA) {
            return scoreB - scoreA;
          }
          return b.objectiveScore - a.objectiveScore;
        });

      const unsafeEvals = evals.filter((e) => !e.isSafe);

      if (safeEvals.length === 0) continue;

      const bestEval = safeEvals[0];
      const selectedCandidate = bestEval.candidate;

      // Compile rejected alternatives
      const rejectedAlternatives: RejectedAlternative[] = [
        ...safeEvals.slice(1).map((e) => ({
          id: e.candidate.id,
          action: e.candidate.action,
          targetSpeed: e.candidate.targetSpeed,
          trainId: e.candidate.affectedTrainId,
          reason: `Lower ranking score (Adaptive ${e.adaptiveScore ?? e.objectiveScore} vs optimal ${bestEval.adaptiveScore ?? bestEval.objectiveScore})`,
          isSafe: true,
          objectiveScore: e.objectiveScore,
          adaptiveScore: e.adaptiveScore,
          adaptiveAdjustment: e.adaptiveInsight?.adaptiveAdjustment,
        })),
        ...unsafeEvals.map((e) => ({
          id: e.candidate.id,
          action: e.candidate.action,
          targetSpeed: e.candidate.targetSpeed,
          trainId: e.candidate.affectedTrainId,
          reason: e.safetyRejectionReason || "Hard safety constraint violation",
          isSafe: false,
          objectiveScore: -Infinity,
          adaptiveScore: -Infinity,
          adaptiveAdjustment: 0,
        })),
      ];

      // Generate Speed Trajectory Profile
      const sectionRange = corridorTopology.sectionMap[train.currentSection];
      const nextSectionRange = corridorTopology.sections.find(
        (s) => s.startStationId === sectionRange?.endStationId
      );
      const isDownstreamOccupied = nextSectionRange
        ? trains.some((t) => t.currentSection === nextSectionRange.id && !t.completed && t.status !== "COMPLETED")
        : false;

      const speedTrajectory = speedTrajectoryModel.generateTrajectory(
        train,
        section,
        isDownstreamOccupied,
        selectedCandidate.targetSpeed
      );

      const trainCountInSec = trains.filter(
        (t) => t.currentSection === train.currentSection && !t.completed && t.status !== "COMPLETED"
      ).length;
      const isSaturated =
        trainCountInSec > (section.capacity || 1) ||
        (section.status === "OCCUPIED" && trainCountInSec > 1);

      const isActionSafe = bestEval.isSafe && !bestEval.safetyRejectionReason;
      const preservesHeadway =
        isActionSafe &&
        (selectedCandidate.action === "HOLD_TRAIN" ||
          selectedCandidate.action === "REDUCE_SPEED" ||
          !activeConflicts.some(
            (c) =>
              (c.trainA === train.id || c.trainB === train.id) &&
              (c.severity === "CRITICAL" || c.severity === "HIGH")
          ));

      // Assemble structured recommendation
      const constraintsChecked: RecommendationConstraints = {
        headway: preservesHeadway ? "PASS" : "FAIL",
        downstreamOccupancy: isDownstreamOccupied ? "OCCUPIED" : "CLEAR",
        conflictRisk: activeConflicts.some(
          (c) => (c.trainA === train.id || c.trainB === train.id) && c.severity === "CRITICAL"
        )
          ? "HIGH"
          : "LOW",
        signalAuthority: isDownstreamOccupied ? "RESTRICTED" : "PASS",
        sectionCapacity: isSaturated ? "SATURATED" : "AVAILABLE",
        isSafeToDispatch: isActionSafe && preservesHeadway,
      };

      const expectedEffect: RecommendationExpectedEffect = {
        delayReductionMinutes: bestEval.expectedMetrics.delayReductionMinutes,
        sectionThroughputImpactPercent: bestEval.expectedMetrics.sectionThroughputDeltaPercent,
        networkThroughputImpactPercent: Number((bestEval.expectedMetrics.sectionThroughputDeltaPercent * 0.75).toFixed(1)),
      };

      const predictedTrainState = bestEval.predictedState.trains.find((pt) => pt.trainId === train.id);
      const predictedSecState = bestEval.predictedState.sections.find((ps) => ps.sectionId === train.currentSection);

      const projection: WhatIfProjection = {
        predictedPositionPercent: predictedTrainState ? predictedTrainState.positionPercent : Math.min(100, train.position),
        predictedArrivalTime: train.expectedArrival,
        predictedDelayMinutes: predictedTrainState ? predictedTrainState.delayMinutes : Math.max(0, train.delayMinutes - bestEval.expectedMetrics.delayReductionMinutes),
        sectionOccupancyAfter: predictedSecState ? predictedSecState.activeTrainCount : 1,
        sectionThroughputAfter: predictedSecState ? predictedSecState.sectionThroughput : bestEval.predictedState.corridorThroughput,
        conflictRiskAfter: bestEval.predictedState.activeConflictsCount > 0 ? "HIGH" : "LOW",
      };

      // Generate What-If Counterfactual Comparison
      const counterfactual: CounterfactualComparison = {
        currentSpeedKmH: train.speed,
        targetSpeedKmH: selectedCandidate.targetSpeed || train.speed,
        currentDelayMinutes: train.delayMinutes,
        projectedDelayMinutes: Math.max(0, train.delayMinutes - bestEval.expectedMetrics.delayReductionMinutes),
        currentSectionThroughput: Number((train.speed / (section.lengthKm || 25)).toFixed(2)),
        projectedSectionThroughput: Number(((selectedCandidate.targetSpeed || train.speed) / (section.lengthKm || 25)).toFixed(2)),
        projection,
      };

      const adaptiveAdj = bestEval.adaptiveInsight?.adaptiveAdjustment ?? 0;
      const adaptiveScoreVal = bestEval.adaptiveScore ?? bestEval.objectiveScore;
      const reasonText =
        adaptiveAdj !== 0 && bestEval.adaptiveInsight
          ? `${selectedCandidate.description}. Evaluated ${evals.length} candidate(s); ranked #1 with Adaptive Score ${adaptiveScoreVal} (Base: ${bestEval.objectiveScore}, Adjustment: ${adaptiveAdj >= 0 ? "+" : ""}${adaptiveAdj}, Confidence: ${bestEval.adaptiveInsight.confidenceLevel}).`
          : `${selectedCandidate.description}. Evaluated ${evals.length} candidate(s); highest objective score (${bestEval.objectiveScore}).`;

      recommendations.push({
        id: `REC-${train.id}-${selectedCandidate.action}-${simulationTime}`,
        affectedTrainId: train.id,
        action: selectedCandidate.action,
        reason: reasonText,
        urgency: (selectedCandidate.action === "HOLD_TRAIN" ? "HIGH" : selectedCandidate.action === "REDUCE_SPEED" ? "MEDIUM" : "LOW") as RecommendationUrgency,
        confidence: bestEval.adaptiveInsight?.confidenceScore ? Math.max(0.8, bestEval.adaptiveInsight.confidenceScore) : 0.95,
        affectedSectionId: selectedCandidate.affectedSectionId,
        targetSpeed: selectedCandidate.targetSpeed,
        holdDurationSeconds: selectedCandidate.holdDurationSeconds,
        expectedDelayImpact: -bestEval.expectedMetrics.delayReductionMinutes,
        expectedThroughputImpact: bestEval.expectedMetrics.sectionThroughputDeltaPercent,
        expectedEffect,
        constraintsChecked,
        counterfactual,
        speedTrajectory,
        rejectedAlternatives,
        objectiveScore: bestEval.objectiveScore,
        objectiveScoreBreakdown: bestEval.scoreBreakdown,
        adaptiveScore: bestEval.adaptiveScore,
        adaptiveInsight: bestEval.adaptiveInsight,
        predictionHorizonSeconds: horizonSeconds,
        isSafeToDispatch: true,
        createdAt: simulationTime,
        status: "PENDING",
      });
    }

    const urgencyRank: Record<RecommendationUrgency, number> = {
      CRITICAL: 4,
      HIGH: 3,
      MEDIUM: 2,
      LOW: 1,
    };

    recommendations.sort((a, b) => urgencyRank[b.urgency] - urgencyRank[a.urgency]);

    // 4. Phase 9: Coordinated Multi-Train Strategy Synthesis Layer
    const availableStrategies = strategySynthesisEngine.synthesizeStrategies(
      trains,
      sections,
      signals,
      junctions,
      candidateActions,
      allEvaluations,
      currentBaselineState,
      simulationTime,
      stateRevision,
      horizonSeconds,
      activeIncidents
    );

    // 5. Phase 10: Staged Incident Recovery Plan Synthesis Layer
    const availableRecoveryPlans = recoveryPlanEngine.synthesizeRecoveryPlans(
      activeIncidents,
      trains,
      sections,
      signals,
      junctions,
      candidateActions,
      allEvaluations,
      availableStrategies,
      currentBaselineState,
      simulationTime,
      horizonSeconds
    );

    return {
      recommendations,
      evaluations: allEvaluations,
      availableStrategies,
      availableRecoveryPlans,
    };
  }
}

export const optimizationEngine = new OptimizationEngine();
