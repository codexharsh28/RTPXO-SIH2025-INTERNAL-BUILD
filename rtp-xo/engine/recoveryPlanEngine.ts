/**
 * RTPXO - Incident Recovery Plan Synthesis Engine (Phase 10 Step 3)
 * Synthesizes deterministic, multi-phase DisruptionRecoveryPlans from active incidents,
 * disruption-aware predictions, safe optimization candidates, and corridor resiliency metrics.
 *
 * NOTE: PURE ADVISORY & PLANNING LAYER — Zero mutation of live SimulationEngine state,
 * zero automatic execution, and zero automatic incident clearance.
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
  StrategySafetyStatus,
  StrategyExecutionStatus,
  StrategyActionRole,
} from "@/types/strategy";
import {
  ActiveIncident,
  DisruptionRecoveryPlan,
  RecoveryStagingPhase,
  RecoveryPhaseTriggerCondition,
} from "@/types/incident";
import { resolveNextSection, corridorTopology } from "@/data/topology";
import { corridorResiliencyEvaluator } from "./corridorResiliencyEvaluator";

export class RecoveryPlanEngine {
  /**
   * Synthesizes deterministic staged recovery plans for all active non-resolved incidents.
   */
  public synthesizeRecoveryPlans(
    incidents: ActiveIncident[],
    trains: Train[],
    sections: RailwaySection[],
    signals: Signal[],
    junctions: Junction[],
    candidateActions: CandidateAction[],
    evaluations: CandidateEvaluation[],
    availableStrategies: CoordinatedStrategyPlan[] = [],
    baselinePredictedState: PredictedStateSnapshot,
    simulationTime: number,
    horizonSeconds: PredictionHorizonSeconds = 300
  ): DisruptionRecoveryPlan[] {
    const activeIncidents = incidents.filter(
      (inc) => inc.status !== "RESOLVED_CLOSED"
    );

    if (activeIncidents.length === 0) {
      return [];
    }

    const plans: DisruptionRecoveryPlan[] = [];

    // Filter to strictly verified safe evaluations only
    const safeEvalMap = new Map<string, CandidateEvaluation>();
    for (const e of evaluations) {
      if (e.isSafe && e.objectiveScore > -Infinity && e.candidate) {
        safeEvalMap.set(e.candidate.id, e);
      }
    }

    for (const incident of activeIncidents) {
      const stagingPhases: RecoveryStagingPhase[] = [];
      let phaseCounter = 1;

      // ------------------------------------------------------------------
      // PHASE 1: Immediate Containment (Trigger: IMMEDIATE)
      // ------------------------------------------------------------------
      const containmentActions: BundledStrategyAction[] = [];

      // Find safe candidate actions that mitigate the active incident
      for (const cand of candidateActions) {
        const safeEval = safeEvalMap.get(cand.id);
        if (!safeEval) continue; // Skip unsafe candidates

        const train = trains.find((t) => t.id === cand.affectedTrainId);
        const trainSection = train?.currentSection;
        const nextSection = trainSection ? resolveNextSection(trainSection) : undefined;

        const isDirectlyAffected =
          cand.affectedSectionId === incident.affectedSectionId ||
          trainSection === incident.affectedSectionId ||
          nextSection === incident.affectedSectionId;

        if (!isDirectlyAffected) continue;

        // TSR Mitigation Candidate
        if (
          incident.type === "TEMPORARY_SPEED_RESTRICTION" &&
          cand.action === "REDUCE_SPEED" &&
          incident.imposedSpeedLimitKmH !== undefined &&
          cand.targetSpeed !== undefined &&
          cand.targetSpeed <= incident.imposedSpeedLimitKmH
        ) {
          containmentActions.push({
            candidateAction: cand,
            trainId: cand.affectedTrainId,
            trainName: train ? train.name : cand.affectedTrainId,
            role: "SPEED_REGULATE",
            targetSectionId: cand.affectedSectionId,
            individualBaseScore: safeEval.objectiveScore,
            individualAdaptiveScore: safeEval.adaptiveScore ?? safeEval.objectiveScore,
            rationalSummary: `Harmonize ${train?.name || cand.affectedTrainId} speed to ${cand.targetSpeed} km/h for active TSR on ${incident.affectedSectionId}`,
          });
        }

        // Track Blockage Upstream Hold
        if (
          (incident.type === "TRACK_SECTION_BLOCKAGE" || incident.isCompleteBlockage) &&
          cand.action === "HOLD_TRAIN" &&
          nextSection === incident.affectedSectionId
        ) {
          containmentActions.push({
            candidateAction: cand,
            trainId: cand.affectedTrainId,
            trainName: train ? train.name : cand.affectedTrainId,
            role: "SIDING_HOLD",
            targetSectionId: cand.affectedSectionId,
            individualBaseScore: safeEval.objectiveScore,
            individualAdaptiveScore: safeEval.adaptiveScore ?? safeEval.objectiveScore,
            rationalSummary: `Hold ${train?.name || cand.affectedTrainId} upstream of blocked section ${incident.affectedSectionId}`,
          });
        }

        // Signal Failure Slow Approach / Hold
        if (
          incident.type === "SIGNAL_ASPECT_FAILURE" &&
          (cand.action === "REDUCE_SPEED" || cand.action === "HOLD_TRAIN") &&
          (trainSection === incident.affectedSectionId || nextSection === incident.affectedSectionId)
        ) {
          containmentActions.push({
            candidateAction: cand,
            trainId: cand.affectedTrainId,
            trainName: train ? train.name : cand.affectedTrainId,
            role: cand.action === "HOLD_TRAIN" ? "SIDING_HOLD" : "SPEED_REGULATE",
            targetSectionId: cand.affectedSectionId,
            individualBaseScore: safeEval.objectiveScore,
            individualAdaptiveScore: safeEval.adaptiveScore ?? safeEval.objectiveScore,
            rationalSummary: `Regulate ${train?.name || cand.affectedTrainId} approach before degraded signal on ${incident.affectedSectionId}`,
          });
        }
      }

      // Check for available Phase 9 strategies matching containment
      for (const strat of availableStrategies) {
        if (strat.safetyStatus !== "VERIFIED_SAFE") continue;
        const touchesIncident = strat.targetSectionIds.includes(incident.affectedSectionId);
        if (touchesIncident) {
          for (const act of strat.constituentActions) {
            if (!containmentActions.some((a) => a.trainId === act.trainId)) {
              containmentActions.push(act);
            }
          }
        }
      }

      if (containmentActions.length > 0) {
        containmentActions.sort((a, b) => a.trainId.localeCompare(b.trainId) || a.candidateAction.id.localeCompare(b.candidateAction.id));
        stagingPhases.push({
          phaseNumber: phaseCounter++,
          phaseName: "Immediate Incident Containment",
          actions: containmentActions,
          triggerCondition: "IMMEDIATE",
        });
      }

      // ------------------------------------------------------------------
      // PHASE 2: Post-Clearance Recovery (Trigger: ON_INCIDENT_CLEARANCE)
      // ------------------------------------------------------------------
      const clearanceRecoveryActions: BundledStrategyAction[] = [];

      for (const cand of candidateActions) {
        const safeEval = safeEvalMap.get(cand.id);
        if (!safeEval) continue;

        const train = trains.find((t) => t.id === cand.affectedTrainId);
        const trainSection = train?.currentSection;
        const nextSection = trainSection ? resolveNextSection(trainSection) : undefined;

        const isApproachingOrHeld =
          trainSection === incident.affectedSectionId ||
          nextSection === incident.affectedSectionId ||
          train?.status === "HELD" ||
          train?.status === "DELAYED";

        if (isApproachingOrHeld && cand.action === "INCREASE_SPEED") {
          clearanceRecoveryActions.push({
            candidateAction: cand,
            trainId: cand.affectedTrainId,
            trainName: train ? train.name : cand.affectedTrainId,
            role: "LEAD_ACCELERATE",
            targetSectionId: cand.affectedSectionId,
            individualBaseScore: safeEval.objectiveScore,
            individualAdaptiveScore: safeEval.adaptiveScore ?? safeEval.objectiveScore,
            rationalSummary: `Resume line speed (${cand.targetSpeed} km/h) for ${train?.name || cand.affectedTrainId} upon incident clearance`,
          });
        }
      }

      if (clearanceRecoveryActions.length > 0) {
        clearanceRecoveryActions.sort((a, b) => a.trainId.localeCompare(b.trainId) || a.candidateAction.id.localeCompare(b.candidateAction.id));
        stagingPhases.push({
          phaseNumber: phaseCounter++,
          phaseName: "Post-Clearance Controlled Acceleration",
          actions: clearanceRecoveryActions,
          triggerCondition: "ON_INCIDENT_CLEARANCE",
        });
      }

      // ------------------------------------------------------------------
      // PHASE 3: Headway Stabilization (Trigger: HEADWAY_STABILIZED)
      // ------------------------------------------------------------------
      const stabilizationActions: BundledStrategyAction[] = [];

      for (const cand of candidateActions) {
        const safeEval = safeEvalMap.get(cand.id);
        if (!safeEval) continue;

        const train = trains.find((t) => t.id === cand.affectedTrainId);
        if (cand.action === "GLIDE_SPEED" || (cand.action === "REDUCE_SPEED" && cand.id.includes("CAP-REGULATE"))) {
          stabilizationActions.push({
            candidateAction: cand,
            trainId: cand.affectedTrainId,
            trainName: train ? train.name : cand.affectedTrainId,
            role: "TRAIL_GLIDE",
            targetSectionId: cand.affectedSectionId,
            individualBaseScore: safeEval.objectiveScore,
            individualAdaptiveScore: safeEval.adaptiveScore ?? safeEval.objectiveScore,
            rationalSummary: `Stabilize headway spacing for ${train?.name || cand.affectedTrainId} at ${cand.targetSpeed} km/h`,
          });
        }
      }

      if (stabilizationActions.length > 0) {
        stabilizationActions.sort((a, b) => a.trainId.localeCompare(b.trainId) || a.candidateAction.id.localeCompare(b.candidateAction.id));
        stagingPhases.push({
          phaseNumber: phaseCounter++,
          phaseName: "Headway & Spacing Stabilization",
          actions: stabilizationActions,
          triggerCondition: "HEADWAY_STABILIZED",
        });
      }

      // If at least one valid phase was synthesized, compose the DisruptionRecoveryPlan
      if (stagingPhases.length > 0) {
        const expectedIncidentDuration = incident.expectedDurationSeconds ?? 180;
        const projectedRecoveryTimeSeconds = expectedIncidentDuration + 60;

        const totalActiveDelayMinutes = trains.reduce((acc, t) => acc + t.delayMinutes, 0);
        const projectedResidualDelayMinutes = Number(
          (totalActiveDelayMinutes + (incident.isCompleteBlockage ? 4.0 : 1.5)).toFixed(1)
        );

        const plan: DisruptionRecoveryPlan = {
          recoveryPlanId: `RECPLAN-${incident.id}-${simulationTime.toFixed(0)}`,
          associatedIncidentId: incident.id,
          name: `Staged Recovery Plan: ${incident.type.replace(/_/g, " ")} (${incident.affectedSectionId})`,
          summary: `Staged ${stagingPhases.length}-phase corridor recovery plan for ${incident.id} (${incident.reason}). Projected recovery window: ${projectedRecoveryTimeSeconds}s, residual delay: ${projectedResidualDelayMinutes} min.`,
          stagingPhases,
          projectedRecoveryTimeSeconds,
          projectedResidualDelayMinutes,
          safetyStatus: "VERIFIED_SAFE",
          executionStatus: "PROPOSED",
        };

        plans.push(plan);
      }
    }

    plans.sort((a, b) => a.associatedIncidentId.localeCompare(b.associatedIncidentId));
    return plans;
  }
}

export const recoveryPlanEngine = new RecoveryPlanEngine();
