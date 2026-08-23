/**
 * RTPXO - Dynamic Signal Engine
 * Computes live multi-aspect signaling (GREEN, YELLOW, RED) based on
 * real-time train positions, section occupancy, junction states, and conflict alerts.
 */

import {
  Signal,
  SignalAspect,
  Train,
  RailwaySection,
  Junction,
  TrainConflict,
} from "@/types/railway";
import { ActiveIncident } from "@/types/incident";
import { signals as initialSignals } from "@/data/signals";
import { corridorTopology } from "@/data/topology";

export interface EvaluatedSignal extends Signal {
  aspect: SignalAspect;
  reason: string;
  affectedTrainId?: string;
  affectedSectionId: string;
  evaluatedAt: number;
}

export class SignalEngine {
  /**
   * Evaluates all signals against the current simulation snapshot.
   */
  public evaluateSignals(
    trains: Train[],
    sections: RailwaySection[],
    conflicts: TrainConflict[],
    junctions: Junction[],
    baseSignals: Signal[] = initialSignals,
    simulationTime: number = 0,
    activeIncidents: ActiveIncident[] = []
  ): EvaluatedSignal[] {
    return baseSignals.map((signal) => {
      const section = sections.find((s) => s.id === signal.sectionId);
      const sectionRange = corridorTopology.sectionMap[signal.sectionId];

      if (!section) {
        return {
          ...signal,
          aspect: "RED" as SignalAspect,
          reason: "Railway section unavailable or out of service.",
          affectedSectionId: signal.sectionId,
          evaluatedAt: simulationTime,
        };
      }

      // 0a. Check for direct SIGNAL_ASPECT_FAILURE incident affecting this signal
      const signalIncident = activeIncidents.find(
        (inc) =>
          inc.affectedSignalId === signal.id &&
          inc.type === "SIGNAL_ASPECT_FAILURE" &&
          inc.status !== "RESOLVED_CLOSED"
      );
      if (signalIncident) {
        return {
          ...signal,
          aspect: "RED" as SignalAspect,
          reason: `Signal Aspect Failure: Degraded Mode (${signalIncident.reason})`,
          affectedSectionId: signal.sectionId,
          evaluatedAt: simulationTime,
        };
      }

      // 0b. Check if Section is BLOCKED (via section.status or active TRACK_SECTION_BLOCKAGE incident)
      const sectionBlockedIncident = activeIncidents.find(
        (inc) =>
          inc.affectedSectionId === signal.sectionId &&
          (inc.type === "TRACK_SECTION_BLOCKAGE" || inc.isCompleteBlockage) &&
          inc.status !== "RESOLVED_CLOSED"
      );
      if (section.status === "BLOCKED" || sectionBlockedIncident) {
        return {
          ...signal,
          aspect: "RED" as SignalAspect,
          reason: `Signal Held: Block section is BLOCKED (${sectionBlockedIncident?.reason || "Active Disruption"}).`,
          affectedSectionId: signal.sectionId,
          evaluatedAt: simulationTime,
        };
      }

      // 1. Check for HIGH / CRITICAL conflicts affecting this section or junction
      const activeHighConflicts = conflicts.filter(
        (c) =>
          (c.severity === "HIGH" || c.severity === "CRITICAL") &&
          (c.sectionA === signal.sectionId ||
            c.sectionB === signal.sectionId ||
            (signal.stationId && c.junctionId.includes(signal.stationId)))
      );

      if (activeHighConflicts.length > 0) {
        const topConflict = activeHighConflicts[0];
        return {
          ...signal,
          aspect: "RED",
          reason: `Signal Held: High conflict detected (${topConflict.reason})`,
          affectedTrainId: topConflict.trainA,
          affectedSectionId: signal.sectionId,
          evaluatedAt: simulationTime,
        };
      }

      // 2. Check for CRITICAL status trains occupying this section
      const trainsInSection = trains.filter(
        (t) => t.currentSection === signal.sectionId && !t.completed && t.status !== "COMPLETED"
      );

      const criticalTrain = trainsInSection.find((t) => t.status === "CRITICAL");
      if (criticalTrain) {
        return {
          ...signal,
          aspect: "RED",
          reason: `Emergency Stop: ${criticalTrain.name} (${criticalTrain.id}) in CRITICAL state.`,
          affectedTrainId: criticalTrain.id,
          affectedSectionId: signal.sectionId,
          evaluatedAt: simulationTime,
        };
      }

      // 3. Check for MEDIUM severity conflicts
      const activeMediumConflicts = conflicts.filter(
        (c) =>
          c.severity === "MEDIUM" &&
          (c.sectionA === signal.sectionId ||
            c.sectionB === signal.sectionId ||
            (signal.stationId && c.junctionId.includes(signal.stationId)))
      );

      if (activeMediumConflicts.length > 0) {
        const topConflict = activeMediumConflicts[0];
        return {
          ...signal,
          aspect: "YELLOW",
          reason: `Caution Aspect: Potential conflict being monitored (${topConflict.trainA} ↔ ${topConflict.trainB}).`,
          affectedTrainId: topConflict.trainA,
          affectedSectionId: signal.sectionId,
          evaluatedAt: simulationTime,
        };
      }

      // 4. Multiple trains on same single-track section
      if (trainsInSection.length > 1) {
        const leadTrain = trainsInSection.reduce((prev, curr) =>
          curr.position > prev.position ? curr : prev
        );
        return {
          ...signal,
          aspect: "RED",
          reason: `Block section occupied by multiple trains (${trainsInSection.map((t) => t.id).join(", ")}).`,
          affectedTrainId: leadTrain.id,
          affectedSectionId: signal.sectionId,
          evaluatedAt: simulationTime,
        };
      }

      // 5. Single train in section - aspect depends on proximity to section exit / next block
      if (trainsInSection.length === 1) {
        const train = trainsInSection[0];

        // Check if downstream next section is occupied or blocked
        const nextSectionId = sectionRange ? this.findNextSectionId(signal.sectionId) : null;
        const nextSectionOccupied = nextSectionId
          ? trains.some((t) => t.currentSection === nextSectionId && !t.completed && t.status !== "COMPLETED")
          : false;
        const nextSectionBlocked = nextSectionId
          ? activeIncidents.some(
              (inc) =>
                inc.affectedSectionId === nextSectionId &&
                (inc.type === "TRACK_SECTION_BLOCKAGE" || inc.isCompleteBlockage) &&
                inc.status !== "RESOLVED_CLOSED"
            ) || sections.find((s) => s.id === nextSectionId)?.status === "BLOCKED"
          : false;

        const nextSectionUnavailable = nextSectionOccupied || nextSectionBlocked;

        if (train.position >= 85) {
          // Very close to signal/section boundary
          if (nextSectionUnavailable) {
            return {
              ...signal,
              aspect: "RED",
              reason: `Stop: Next section (${nextSectionId}) is occupied or blocked. Hold before block boundary.`,
              affectedTrainId: train.id,
              affectedSectionId: signal.sectionId,
              evaluatedAt: simulationTime,
            };
          }
          return {
            ...signal,
            aspect: "YELLOW",
            reason: `${train.name} (${train.id}) is at block boundary (${Math.round(train.position)}%). Caution aspect.`,
            affectedTrainId: train.id,
            affectedSectionId: signal.sectionId,
            evaluatedAt: simulationTime,
          };
        }

        if (train.position >= 60 && nextSectionUnavailable) {
          return {
            ...signal,
            aspect: "YELLOW",
            reason: `Approach Caution: Downstream section (${nextSectionId}) is occupied or blocked. Reduce speed.`,
            affectedTrainId: train.id,
            affectedSectionId: signal.sectionId,
            evaluatedAt: simulationTime,
          };
        }

        return {
          ...signal,
          aspect: "GREEN",
          reason: `Block active: ${train.name} (${train.id}) proceeding at ${train.speed} km/h.`,
          affectedTrainId: train.id,
          affectedSectionId: signal.sectionId,
          evaluatedAt: simulationTime,
        };
      }

      // 6. Section is completely clear
      return {
        ...signal,
        aspect: "GREEN",
        reason: "Section clear. Route set for line speed.",
        affectedSectionId: signal.sectionId,
        evaluatedAt: simulationTime,
      };
    });
  }

  private findNextSectionId(currentSectionId: string): string | null {
    const currentRange = corridorTopology.sectionMap[currentSectionId];
    if (!currentRange) return null;

    const nextRange = corridorTopology.sections.find(
      (sec) => sec.startStationId === currentRange.endStationId
    );

    return nextRange ? nextRange.id : null;
  }
}

export const signalEngine = new SignalEngine();
