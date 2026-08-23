/**
 * RTPXO - AI Advisory & Decision Engine (Phase 6 Optimized)
 * Transparent, deterministic traffic-control optimization engine with multi-train coordination,
 * rolling forward lookahead simulations, speed trajectory profiling, and explainable decision selection.
 */

import { Train, RailwaySection, Signal, Junction, TrainConflict } from "@/types/railway";
import {
  AIRecommendation,
  NetworkAssessment,
  PredictedConflict,
  Bottleneck,
  AssessmentStatus,
} from "@/types/advisor";
import { ThroughputMetrics, SectionUtilization } from "@/types/metrics";
import { PredictionHorizonSeconds } from "@/types/optimization";
import { ActiveIncident, DisruptionRecoveryPlan } from "@/types/incident";
import { junctions as defaultJunctions } from "@/data/junctions";
import { optimizationEngine } from "./optimizationEngine";
import { AdaptiveDecisionEngine } from "./adaptiveDecisionEngine";
import { CoordinatedStrategyPlan } from "@/types/strategy";

export class AdvisorEngine {
  /**
   * Generates actionable recommendations and network assessments from simulation state.
   */
  public generateRecommendations(
    trains: Train[],
    sections: RailwaySection[],
    signals: Signal[],
    activeConflicts: TrainConflict[],
    predictedConflicts: PredictedConflict[],
    throughput: ThroughputMetrics,
    simulationTime: number,
    junctions: Junction[] = defaultJunctions,
    sectionUtilizations: SectionUtilization[] = [],
    horizonSeconds: PredictionHorizonSeconds = 300,
    adaptiveEngine?: AdaptiveDecisionEngine,
    stateRevision: number = 0,
    activeIncidents: ActiveIncident[] = []
  ): {
    recommendations: AIRecommendation[];
    assessment: NetworkAssessment;
    availableStrategies?: CoordinatedStrategyPlan[];
    availableRecoveryPlans?: DisruptionRecoveryPlan[];
  } {
    const derivedUtilizations: SectionUtilization[] =
      sectionUtilizations && sectionUtilizations.length > 0
        ? sectionUtilizations
        : sections.map((sec) => {
            const count = trains.filter(
              (t) => t.currentSection === sec.id && !t.completed && t.status !== "COMPLETED"
            ).length;
            const capacity = sec.capacity || 1;
            const occRate = Math.min(100, Math.round((count / capacity) * 100));
            const isBn = count > capacity || (count >= 1 && throughput.bottleneckSection === sec.id);
            return {
              sectionId: sec.id,
              sectionName: sec.name,
              sectionLengthKm: sec.lengthKm || 25,
              occupancyRate: occRate,
              activeTrainCount: count,
              capacity,
              speedLimitKmH: sec.maximumSpeed,
              averageSpeedKmH: 60,
              speedUtilizationPercent: Math.round((60 / sec.maximumSpeed) * 100),
              trainsEntered: count,
              trainsExited: 0,
              sectionThroughput: Number(((60 / (sec.lengthKm || 25)) * 0.6).toFixed(2)),
              averageDwellSeconds: 0,
              averageDelayMinutes: 0,
              congestionState: isBn ? "SATURATED" : count > 0 ? "MODERATE" : "FREE_FLOW",
              bottleneckScore: isBn ? 80 : 20,
              isBottleneck: isBn,
              densityScore: Number((count / capacity).toFixed(2)),
            };
          });

    // 1. Generate optimized recommendations via master OptimizationEngine
    const optResult = optimizationEngine.optimizeNetwork(
      trains,
      sections,
      signals,
      junctions,
      activeConflicts,
      predictedConflicts,
      throughput,
      derivedUtilizations,
      simulationTime,
      horizonSeconds,
      adaptiveEngine,
      stateRevision,
      activeIncidents
    );

    const recommendations = optResult.recommendations;
    const availableStrategies = optResult.availableStrategies;
    const availableRecoveryPlans = optResult.availableRecoveryPlans;
    const bottlenecks: Bottleneck[] = [];

    // 2. Identify and record bottleneck sections
    if (throughput.bottleneckSection) {
      const bottleneckSec = sections.find((s) => s.id === throughput.bottleneckSection);
      const trainsInBottleneck = trains.filter(
        (t) => t.currentSection === throughput.bottleneckSection && !t.completed && t.status !== "COMPLETED"
      );

      if (bottleneckSec) {
        bottlenecks.push({
          id: `BN-${bottleneckSec.id}`,
          sectionId: bottleneckSec.id,
          sectionName: bottleneckSec.name,
          severity: trainsInBottleneck.length > 1 ? "HIGH" : "MEDIUM",
          utilizationPercent: Math.min(100, trainsInBottleneck.length * 100),
          delayedTrainsCount: trainsInBottleneck.filter((t) => t.status === "DELAYED").length,
          trainsQueued: trainsInBottleneck.map((t) => t.id),
          reason: `High traffic density in section ${bottleneckSec.name} (${trainsInBottleneck.length} active train(s), avg speed ${bottleneckSec.maximumSpeed} km/h limit).`,
          suggestedAction: trainsInBottleneck.length > 1 ? "HOLD_TRAIN" : "CLEAR_SECTION",
        });
      }
    }

    // 3. Holistic Network Assessment & Explainable AI Scoring
    let assessmentStatus: AssessmentStatus = "OPTIMAL";
    if (activeConflicts.some((c) => c.severity === "HIGH" || c.severity === "CRITICAL")) {
      assessmentStatus = "CRITICAL";
    } else if (activeConflicts.length > 0 || bottlenecks.some((b) => b.severity === "HIGH" || b.utilizationPercent >= 100)) {
      assessmentStatus = "CONGESTED";
    } else if (bottlenecks.length > 0 || recommendations.length > 0) {
      assessmentStatus = "OPTIMIZING";
    }

    const { score: efficiencyScore, breakdown: aiScoreBreakdown } = calculateAIScore(
      trains,
      activeConflicts,
      predictedConflicts,
      bottlenecks,
      activeIncidents,
      recommendations.length,
      throughput.corridorThroughput
    );

    const summary =
      assessmentStatus === "OPTIMAL"
        ? "Corridor flow is optimal. Section throughput is maximized with clear headway."
        : assessmentStatus === "OPTIMIZING"
        ? `RTPXO Advisor optimizing section throughput over ${horizonSeconds}s lookahead horizon. ${recommendations.length} verified candidate action(s) available.`
        : assessmentStatus === "CONGESTED"
        ? `Traffic density elevated in ${bottlenecks.map((b) => b.sectionName).join(", ") || "corridor"}. Speed moderation advised.`
        : `CRITICAL CONFLICT DETECTED. Immediate operator safety intervention required.`;

    const assessment: NetworkAssessment = {
      status: assessmentStatus,
      summary,
      activeBottlenecks: bottlenecks,
      predictedConflicts,
      recommendedActionsCount: recommendations.length,
      efficiencyScore,
      aiScoreBreakdown,
      timestamp: simulationTime,
    };

    return {
      recommendations,
      assessment,
      availableStrategies,
      availableRecoveryPlans,
    };
  }
}

/**
 * Deterministic, explainable AI network efficiency scoring model.
 */
export function calculateAIScore(
  trains: Train[],
  activeConflicts: TrainConflict[],
  predictedConflicts: PredictedConflict[],
  bottlenecks: Bottleneck[],
  activeIncidents: ActiveIncident[] = [],
  availableRecommendationsCount: number = 0,
  throughputTph: number = 0
): { score: number; breakdown: import("@/types/advisor").AIScoreBreakdown } {
  const baseScore = 100;
  const penalties: import("@/types/advisor").AIScoreFactor[] = [];
  const bonuses: import("@/types/advisor").AIScoreFactor[] = [];

  const activeFleet = trains.filter((t) => !t.completed && t.status !== "COMPLETED");
  const delayedTrains = activeFleet.filter((t) => t.delayMinutes > 0 || (t.delay && t.delay > 0) || t.status === "DELAYED");
  const criticalConflicts = activeConflicts.filter((c) => c.severity === "HIGH" || c.severity === "CRITICAL");
  const standardConflicts = activeConflicts.filter((c) => c.severity !== "HIGH" && c.severity !== "CRITICAL");

  // 1. Conflict Penalties
  if (criticalConflicts.length > 0) {
    const pts = criticalConflicts.length * -20;
    penalties.push({
      factor: "Critical Safety Conflicts",
      points: pts,
      description: `${criticalConflicts.length} high-severity conflict(s) detected requiring intervention`,
    });
  }

  if (standardConflicts.length > 0) {
    const pts = standardConflicts.length * -10;
    penalties.push({
      factor: "Active Operational Conflicts",
      points: pts,
      description: `${standardConflicts.length} active spatial headway conflict(s)`,
    });
  }

  if (predictedConflicts.length > 0) {
    const pts = Math.min(15, predictedConflicts.length * 4) * -1;
    penalties.push({
      factor: "Projected Forward Conflicts",
      points: pts,
      description: `${predictedConflicts.length} projected downstream convergence conflict(s)`,
    });
  }

  // 2. Delay & Schedule Deviation Penalties
  if (delayedTrains.length > 0) {
    const pts = delayedTrains.length * -6;
    penalties.push({
      factor: "Schedule Delay",
      points: pts,
      description: `${delayedTrains.length}/${activeFleet.length} trains experiencing operational delays`,
    });
  }

  const avgDelay =
    activeFleet.length > 0
      ? activeFleet.reduce((acc, t) => acc + (t.delayMinutes || t.delay || 0), 0) / activeFleet.length
      : 0;

  if (avgDelay > 5) {
    const extraDelayPts = Math.min(15, Math.round((avgDelay - 5) * 2)) * -1;
    penalties.push({
      factor: "Excess Average Corridor Delay",
      points: extraDelayPts,
      description: `Average corridor delay is ${avgDelay.toFixed(1)} min`,
    });
  }

  // 3. Bottlenecks & Disruptions
  if (bottlenecks.length > 0) {
    const highSeverityBn = bottlenecks.filter((b) => b.severity === "HIGH" || b.utilizationPercent >= 100);
    const pts = (highSeverityBn.length * -15) + ((bottlenecks.length - highSeverityBn.length) * -8);
    penalties.push({
      factor: "Track Section Saturation",
      points: pts,
      description: `${bottlenecks.length} section bottleneck(s) detected (${bottlenecks.map((b) => `${b.sectionName}: ${b.utilizationPercent}%`).join(", ")})`,
    });
  }

  const unmitigatedIncidents = activeIncidents.filter((inc) => inc.status !== "RESOLVED_CLOSED");
  if (unmitigatedIncidents.length > 0) {
    const pts = unmitigatedIncidents.length * -12;
    penalties.push({
      factor: "Active Incidents & Disruptions",
      points: pts,
      description: `${unmitigatedIncidents.length} active track disruption(s)`,
    });
  }

  // 4. Recovery & Optimization Bonuses
  if (delayedTrains.length === 0 && activeConflicts.length === 0 && activeFleet.length > 0) {
    bonuses.push({
      factor: "Optimal Free-Flow Cadence",
      points: 5,
      description: "100% on-time corridor throughput with zero safety conflicts",
    });
  }

  if (availableRecommendationsCount > 0 && (activeConflicts.length > 0 || delayedTrains.length > 0)) {
    bonuses.push({
      factor: "AI Optimization Pathway Available",
      points: 5,
      description: `${availableRecommendationsCount} verified action(s) generated to recover schedule`,
    });
  }

  const initialPenalties = penalties.reduce((acc, p) => acc + p.points, 0);
  const totalBonuses = bonuses.reduce((acc, b) => acc + b.points, 0);
  const rawSum = baseScore + initialPenalties + totalBonuses;
  const isCritical =
    criticalConflicts.length > 0 ||
    unmitigatedIncidents.some((inc) => inc.type === "TRACK_SECTION_BLOCKAGE" || inc.isCompleteBlockage);
  const isCongested =
    !isCritical &&
    (bottlenecks.some((b) => b.severity === "HIGH" || b.utilizationPercent >= 100) ||
      activeConflicts.length > 0 ||
      delayedTrains.length >= 3);
  const isWarning =
    !isCritical &&
    !isCongested &&
    (delayedTrains.length > 0 || bottlenecks.length > 0 || predictedConflicts.length > 0);

  if (isCritical) {
    if (rawSum > 35) {
      penalties.push({
        factor: "Critical Safety Cap",
        points: -(rawSum - 35),
        description: "Severe active safety conflict/blockage caps corridor efficiency score at 35%",
      });
    }
  } else if (isCongested) {
    if (rawSum > 60) {
      penalties.push({
        factor: "Section Saturation Cap",
        points: -(rawSum - 60),
        description: "Active bottleneck/congestion saturation caps maximum corridor efficiency at 60%",
      });
    }
  } else if (isWarning) {
    if (rawSum > 80) {
      penalties.push({
        factor: "Operational Warning Cap",
        points: -(rawSum - 80),
        description: "Operational delays/advisories cap maximum corridor efficiency at 80%",
      });
    }
  }

  const finalPenalties = penalties.reduce((acc, p) => acc + p.points, 0);
  const score = Math.max(0, Math.min(100, baseScore + finalPenalties + totalBonuses));

  const summary =
    score >= 85
      ? "High network efficiency with stable corridor headway."
      : score >= 60
      ? "Moderate efficiency with minor delays or headway restrictions."
      : score >= 40
      ? "Degraded corridor flow under active traffic congestion."
      : "Critical disruption requiring immediate traffic controller action.";

  return {
    score,
    breakdown: {
      baseScore,
      totalScore: score,
      penalties,
      bonuses,
      summary,
    },
  };
}

export const advisorEngine = new AdvisorEngine();
