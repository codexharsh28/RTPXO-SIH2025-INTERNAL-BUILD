/**
 * RTPXO - Bottleneck Optimizer (Phase 6 Bottleneck Maximization)
 * Detects corridor throughput constraints and generates targeted intervention actions
 * to maximize physical section exit rate and minimize dwell times.
 */

import { Train, RailwaySection } from "@/types/railway";
import { CandidateAction } from "@/types/optimization";
import { SectionUtilization } from "@/types/metrics";
import { corridorTopology } from "@/data/topology";

export class BottleneckOptimizer {
  /**
   * Generates candidate actions specifically targeted at relieving bottleneck sections.
   */
  public generateBottleneckInterventions(
    trains: Train[],
    sections: RailwaySection[],
    sectionUtilizations: SectionUtilization[]
  ): CandidateAction[] {
    const candidates: CandidateAction[] = [];
    const bottleneckSec = sectionUtilizations.find((u) => u.isBottleneck);

    if (!bottleneckSec) return candidates;

    const trainsInBottleneck = trains.filter(
      (t) => t.currentSection === bottleneckSec.sectionId && !t.completed && t.status !== "COMPLETED"
    );

    const sectionDef = sections.find((s) => s.id === bottleneckSec.sectionId);
    if (!sectionDef) return candidates;

    const sectionRange = corridorTopology.sectionMap[bottleneckSec.sectionId];
    const nextSectionRange = corridorTopology.sections.find(
      (s) => s.startStationId === sectionRange?.endStationId
    );

    const isDownstreamOccupied = nextSectionRange
      ? trains.some((t) => t.currentSection === nextSectionRange.id && !t.completed)
      : false;

    // 1. If single train in bottleneck is running below line speed and downstream is clear -> Accelerate to clear section
    if (trainsInBottleneck.length === 1 && !isDownstreamOccupied) {
      const leadTrain = trainsInBottleneck[0];
      if (leadTrain.speed < sectionDef.maximumSpeed) {
        const optimalSpeed = Math.min(leadTrain.maxSpeed || 120, sectionDef.maximumSpeed);
        candidates.push({
          id: `CAND-BN-CLEAR-${leadTrain.id}`,
          affectedTrainId: leadTrain.id,
          action: "INCREASE_SPEED",
          targetSpeed: optimalSpeed,
          affectedSectionId: bottleneckSec.sectionId,
          description: `Accelerate lead train ${leadTrain.name} to ${optimalSpeed} km/h to rapidly clear bottleneck section ${bottleneckSec.sectionName}`,
        });
      }
    }

    // 2. If multiple trains are in bottleneck -> Regulate trailing train to maintain safe flow without stopping
    if (trainsInBottleneck.length >= 2) {
      const leadTrain = trainsInBottleneck.reduce((max, t) => (t.position > max.position ? t : max), trainsInBottleneck[0]);
      const trailingTrain = trainsInBottleneck.reduce((min, t) => (t.position < min.position ? t : min), trainsInBottleneck[0]);
      const safeFollowSpeed = Math.max(10, Math.min(trailingTrain.speed, Math.round(leadTrain.speed * 0.8)));
      candidates.push({
        id: `CAND-BN-FOLLOW-${trailingTrain.id}`,
        affectedTrainId: trailingTrain.id,
        action: "REDUCE_SPEED",
        targetSpeed: safeFollowSpeed,
        affectedSectionId: bottleneckSec.sectionId,
        description: `Moderate speed of trailing train ${trailingTrain.name} to ${safeFollowSpeed} km/h to prevent bunching in saturated section ${bottleneckSec.sectionName}`,
      });
    }

    // 3. Upstream pacing: if an upstream train is approaching the bottleneck section, pace its entry speed to preserve headway
    const prevSectionRange = corridorTopology.sections.find(
      (s) => s.endStationId === sectionRange?.startStationId
    );
    if (prevSectionRange) {
      const approachingTrains = trains.filter(
        (t) => t.currentSection === prevSectionRange.id && !t.completed && t.position >= 40 && t.speed > 70
      );
      for (const appTrain of approachingTrains) {
        const paceSpeed = Math.min(75, Math.round(appTrain.speed * 0.85));
        candidates.push({
          id: `CAND-BN-PACE-${appTrain.id}`,
          affectedTrainId: appTrain.id,
          action: "REDUCE_SPEED",
          targetSpeed: paceSpeed,
          affectedSectionId: prevSectionRange.id,
          description: `Pace approach of ${appTrain.name} to ${paceSpeed} km/h before entering saturated section ${bottleneckSec.sectionName}`,
        });
      }
    }

    return candidates;
  }
}

export const bottleneckOptimizer = new BottleneckOptimizer();
