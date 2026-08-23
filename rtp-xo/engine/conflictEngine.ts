/**
 * RTPXO - Conflict Detection & Predictive Engine
 * Evaluates active and future train conflicts including same-section headway violations,
 * junction convergence, and forward lookahead trajectory overlaps.
 */

import { Train, Junction, TrainConflict, RailwaySection } from "@/types/railway";
import { PredictedConflict } from "@/types/advisor";
import { corridorTopology, getTrainCorridorCoordinates } from "@/data/topology";
import { junctions as initialJunctions } from "@/data/junctions";

export interface ConflictEvaluationResult {
  activeConflicts: TrainConflict[];
  predictedConflicts: PredictedConflict[];
}

export class ConflictEngine {
  private lookaheadHorizonSeconds: number;

  constructor(lookaheadHorizonSeconds: number = 180) {
    this.lookaheadHorizonSeconds = lookaheadHorizonSeconds;
  }

  /**
   * Evaluates all active and predicted conflicts for the current simulation state.
   */
  public evaluateConflicts(
    trains: Train[],
    sections: RailwaySection[],
    junctions: Junction[] = initialJunctions,
    horizonSeconds?: number
  ): ConflictEvaluationResult {
    const activeTrains = trains.filter((t) => !t.completed && t.status !== "COMPLETED");
    const activeConflicts: TrainConflict[] = [];
    const predictedConflicts: PredictedConflict[] = [];
    const effectiveHorizon = horizonSeconds !== undefined ? horizonSeconds : this.lookaheadHorizonSeconds;

    // Pairwise comparison of all active trains
    for (let i = 0; i < activeTrains.length; i++) {
      for (let j = i + 1; j < activeTrains.length; j++) {
        const trainA = activeTrains[i];
        const trainB = activeTrains[j];

        // 1. Same-Section Spatial Separation Conflict
        if (trainA.currentSection === trainB.currentSection) {
          // If both trains are stationary / held, no dynamic moving headway conflict
          if (trainA.speed === 0 && trainB.speed === 0) {
            continue;
          }

          const sectionRange = corridorTopology.sectionMap[trainA.currentSection];
          const sectionLength = sectionRange ? sectionRange.lengthKm : 30;

          const positionDiffPercent = Math.abs(trainA.position - trainB.position);
          const separationDistanceKm = (positionDiffPercent / 100) * sectionLength;

          const leadTrain = trainA.position > trainB.position ? trainA : trainB;
          const trailTrain = trainA.position > trainB.position ? trainB : trainA;
          const isTrailingTrainFaster = trailTrain.speed > leadTrain.speed;
          const closingSpeedKmh = trailTrain.speed - leadTrain.speed;

          // Realistic Railway Headway Constraints:
          // A headway violation in the same section exists if:
          // 1. Immediate spatial proximity violation (<= 3.0 km separation)
          // 2. Trailing train is catching up at higher speed (closing speed >= 25 km/h and separation <= 20 km, or closing speed >= 10 km/h and separation <= 6 km)
          // Normal block separation where lead train is faster (diverging) is nominal operation.
          if (!isTrailingTrainFaster) {
            if (separationDistanceKm > 3.0) {
              continue;
            }
          } else {
            if (separationDistanceKm > 20.0) {
              continue;
            }
            if (separationDistanceKm > 6.0 && closingSpeedKmh < 25) {
              continue;
            }
            if (separationDistanceKm > 3.0 && closingSpeedKmh < 10) {
              continue;
            }
          }

          let severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
          if (separationDistanceKm <= 1.5 || (separationDistanceKm <= 2.5 && closingSpeedKmh >= 25)) {
            severity = "CRITICAL";
          } else if (separationDistanceKm <= 3.0 || (separationDistanceKm <= 8.0 && closingSpeedKmh >= 30)) {
            severity = "HIGH";
          } else if (separationDistanceKm <= 20.0 && isTrailingTrainFaster) {
            severity = "MEDIUM";
          } else {
            severity = "LOW";
          }

          activeConflicts.push({
            id: `CONF-HEADWAY-${trainA.id}-${trainB.id}`,
            type: "HEADWAY_VIOLATION",
            trainA: trainA.id,
            trainB: trainB.id,
            junctionId: "NONE",
            sectionA: trainA.currentSection,
            sectionB: trainB.currentSection,
            severity,
            reason: `${trailTrain.name} (${trailTrain.id} at ${trailTrain.speed} km/h) is trailing ${leadTrain.name} (${leadTrain.id} at ${leadTrain.speed} km/h) with only ${separationDistanceKm.toFixed(1)} km separation in section ${trainA.currentSection}.`,
          });

          continue;
        }

        // 2. Junction / Route Convergence Conflict
        for (const junction of junctions) {
          const aUsesJunction = junction.connectedSections.includes(trainA.currentSection);
          const bUsesJunction = junction.connectedSections.includes(trainB.currentSection);

          if (!aUsesJunction || !bUsesJunction) continue;

          const secDefA = sections.find((s) => s.id === trainA.currentSection);
          const secDefB = sections.find((s) => s.id === trainB.currentSection);

          const sectionA = corridorTopology.sectionMap[trainA.currentSection];
          const sectionB = corridorTopology.sectionMap[trainB.currentSection];

          const distToJuncA =
            secDefA?.endStation === junction.stationId
              ? ((100 - trainA.position) / 100) * (sectionA?.lengthKm || 25)
              : (trainA.position / 100) * (sectionA?.lengthKm || 25);

          const distToJuncB =
            secDefB?.endStation === junction.stationId
              ? ((100 - trainB.position) / 100) * (sectionB?.lengthKm || 25)
              : (trainB.position / 100) * (sectionB?.lengthKm || 25);

          const speedKmhA = Math.max(trainA.speed, 10);
          const speedKmhB = Math.max(trainB.speed, 10);

          const etaSecondsA = (distToJuncA / speedKmhA) * 3600;
          const etaSecondsB = (distToJuncB / speedKmhB) * 3600;

          const etaDifference = Math.abs(etaSecondsA - etaSecondsB);

          // If both trains will reach the junction within 180 seconds of each other
          if (etaSecondsA <= 180 && etaSecondsB <= 180 && etaDifference <= 90) {
            activeConflicts.push({
              id: `CONF-JUNC-${junction.id}-${trainA.id}-${trainB.id}`,
              type: "JUNCTION_CONVERGENCE",
              trainA: trainA.id,
              trainB: trainB.id,
              junctionId: junction.id,
              sectionA: trainA.currentSection,
              sectionB: trainB.currentSection,
              severity: etaDifference <= 45 ? "HIGH" : "MEDIUM",
              reason: `Simultaneous junction arrival predicted at ${junction.name}: ${trainA.id} (ETA ${Math.round(etaSecondsA)}s) and ${trainB.id} (ETA ${Math.round(etaSecondsB)}s).`,
            });
          }
        }

        // 3. Forward Lookahead Kinematic Trajectory Prediction
        const lookaheadConflict = this.predictFutureTrajectoryConflict(
          trainA,
          trainB,
          effectiveHorizon
        );

        if (lookaheadConflict) {
          predictedConflicts.push(lookaheadConflict);
        }
      }
    }

    return {
      activeConflicts,
      predictedConflicts,
    };
  }

  /**
   * Projects train positions forward in time to anticipate section entry conflicts.
   */
  private predictFutureTrajectoryConflict(
    trainA: Train,
    trainB: Train,
    horizonSeconds: number
  ): PredictedConflict | null {
    const coordsA = getTrainCorridorCoordinates(trainA);
    const coordsB = getTrainCorridorCoordinates(trainB);

    const speedKmhA = Math.max(trainA.speed, 0);
    const speedKmhB = Math.max(trainB.speed, 0);

    // If both moving in same direction and rear train is moving faster
    const trailTrain = coordsA.cumulativeKm < coordsB.cumulativeKm ? trainA : trainB;
    const leadTrain = coordsA.cumulativeKm < coordsB.cumulativeKm ? trainB : trainA;

    const trailCoords = getTrainCorridorCoordinates(trailTrain);
    const leadCoords = getTrainCorridorCoordinates(leadTrain);

    const relativeDistanceKm = leadCoords.cumulativeKm - trailCoords.cumulativeKm;
    const relativeSpeedKmh = trailTrain.speed - leadTrain.speed;

    if (relativeSpeedKmh > 5 && relativeDistanceKm > 0) {
      const timeToCatchUpSeconds = (relativeDistanceKm / relativeSpeedKmh) * 3600;

      if (timeToCatchUpSeconds <= horizonSeconds) {
        return {
          id: `PRED-${trailTrain.id}-${leadTrain.id}`,
          trainA: trailTrain.id,
          trainB: leadTrain.id,
          sectionId: trailTrain.currentSection,
          predictedTimeToConflictSeconds: Math.round(timeToCatchUpSeconds),
          severity: timeToCatchUpSeconds <= 60 ? "HIGH" : "MEDIUM",
          reason: `${trailTrain.name} (${trailTrain.id} at ${trailTrain.speed} km/h) will overtake/encroach ${leadTrain.name} (${leadTrain.id} at ${leadTrain.speed} km/h) in ~${Math.round(timeToCatchUpSeconds)}s.`,
          locationKm: Number((trailCoords.cumulativeKm + (trailTrain.speed * timeToCatchUpSeconds) / 3600).toFixed(1)),
        };
      }
    }

    return null;
  }
}

export const conflictEngine = new ConflictEngine();
