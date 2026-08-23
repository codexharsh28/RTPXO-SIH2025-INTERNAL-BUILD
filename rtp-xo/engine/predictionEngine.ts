/**
 * RTPXO - Prediction Engine (Phase 6 Forward Lookahead Simulator)
 * Pure, deterministic, side-effect-free forward kinematic network simulator.
 * Projects network state, block occupancies, signal aspects, and conflict occurrences
 * over rolling horizons (300s, 600s, 900s) without mutating live simulation state.
 */

import { Train, RailwaySection, Signal, Junction, SignalAspect } from "@/types/railway";
import {
  PredictedStateSnapshot,
  PredictedTrainState,
  PredictedSectionState,
  PredictedSignalState,
  PredictedHeadwayState,
  TimelineCheckpoint,
  CandidateAction,
} from "@/types/optimization";
import { ActiveIncident } from "@/types/incident";
import { corridorTopology, resolveNextSection } from "@/data/topology";
import { conflictEngine } from "./conflictEngine";

export class PredictionEngine {
  /**
   * Helper to derive effective speed limit factoring in active TSRs.
   */
  private getEffectiveSectionSpeedLimit(
    sectionId: string,
    sections: RailwaySection[],
    activeIncidents: ActiveIncident[]
  ): number {
    const section = sections.find((s) => s.id === sectionId);
    const permanentLimit = section?.maximumSpeed ?? 130;

    const activeTSRs = activeIncidents.filter(
      (inc) =>
        inc.affectedSectionId === sectionId &&
        inc.type === "TEMPORARY_SPEED_RESTRICTION" &&
        inc.status !== "RESOLVED_CLOSED" &&
        inc.imposedSpeedLimitKmH !== undefined &&
        inc.imposedSpeedLimitKmH > 0
    );

    if (activeTSRs.length === 0) {
      return permanentLimit;
    }

    const strictestTSR = Math.min(...activeTSRs.map((tsr) => tsr.imposedSpeedLimitKmH!));
    return Math.min(permanentLimit, strictestTSR);
  }

  /**
   * Explicit hypothetical evaluation of a coordinated multi-action candidate set (Phase 9).
   * Validates action compatibility, bounds permutation depth, and performs non-mutating lookahead simulation.
   */
  public simulateJointActionsForward(
    trains: Train[],
    sections: RailwaySection[],
    signals: Signal[],
    junctions: Junction[],
    horizonSeconds: number = 300,
    candidateActions: CandidateAction[] = [],
    activeIncidents: ActiveIncident[] = []
  ): {
    predictedState: PredictedStateSnapshot;
    isSafe: boolean;
    safetyViolationReason?: string;
  } {
    // 1. Validate action compatibility: ensure no duplicate target trains with conflicting actions
    const targetedTrainIds = new Set<string>();
    for (const act of candidateActions) {
      if (targetedTrainIds.has(act.affectedTrainId)) {
        const fallbackBaseline = this.simulateForward(trains, sections, signals, junctions, horizonSeconds, [], activeIncidents);
        return {
          predictedState: fallbackBaseline.predictedState,
          isSafe: false,
          safetyViolationReason: `Conflicting actions detected: multiple candidate actions target train ${act.affectedTrainId}`,
        };
      }
      targetedTrainIds.add(act.affectedTrainId);
    }

    // 2. Bound joint action permutation size to prevent combinatorial overload
    if (candidateActions.length > 5) {
      const fallbackBaseline = this.simulateForward(trains, sections, signals, junctions, horizonSeconds, [], activeIncidents);
      return {
        predictedState: fallbackBaseline.predictedState,
        isSafe: false,
        safetyViolationReason: `Joint action count exceeds maximum bound of 5 (actual: ${candidateActions.length})`,
      };
    }

    return this.simulateForward(trains, sections, signals, junctions, horizonSeconds, candidateActions, activeIncidents);
  }

  /**
   * Projects network forward in time under candidate control actions and active incident constraints.
   */
  public simulateForward(
    trains: Train[],
    sections: RailwaySection[],
    signals: Signal[],
    junctions: Junction[],
    horizonSeconds: number = 300,
    candidateActions: CandidateAction[] = [],
    activeIncidents: ActiveIncident[] = []
  ): {
    predictedState: PredictedStateSnapshot;
    isSafe: boolean;
    safetyViolationReason?: string;
  } {
    // Validate action set for duplicate targets
    const targetMap = new Set<string>();
    for (const act of candidateActions) {
      if (targetMap.has(act.affectedTrainId)) {
        // Fall back to baseline and mark unsafe due to conflict
        return {
          predictedState: this.simulateForward(trains, sections, signals, junctions, horizonSeconds, [], activeIncidents).predictedState,
          isSafe: false,
          safetyViolationReason: `Conflicting candidate actions for identical train ${act.affectedTrainId} in joint strategy`,
        };
      }
      targetMap.add(act.affectedTrainId);
    }

    let safetyViolationReason: string | undefined;
    let isSafe = true;

    // Pre-validate candidate actions against active incident constraints
    for (const act of candidateActions) {
      const train = trains.find((t) => t.id === act.affectedTrainId);
      const actSection = act.affectedSectionId || train?.currentSection;
      if (!actSection) continue;

      // 1. Check if action commands speed exceeding active TSR limit
      if (act.targetSpeed !== undefined && act.targetSpeed > 0) {
        const effectiveLimit = this.getEffectiveSectionSpeedLimit(actSection, sections, activeIncidents);
        if (act.targetSpeed > effectiveLimit) {
          isSafe = false;
          safetyViolationReason = `Commanded target speed (${act.targetSpeed} km/h) violates active TSR limit (${effectiveLimit} km/h) on section ${actSection}`;
        }
      }

      // 2. Check if action commands movement into or inside blocked section
      const isBlocked = activeIncidents.some(
        (inc) =>
          inc.affectedSectionId === actSection &&
          (inc.type === "TRACK_SECTION_BLOCKAGE" || inc.isCompleteBlockage) &&
          inc.status !== "RESOLVED_CLOSED"
      );
      if (isBlocked && act.action !== "HOLD_TRAIN") {
        isSafe = false;
        safetyViolationReason = `Commanded action ${act.action} targets blocked track section ${actSection}`;
      }
    }

    // 1. Create deep clone of trains and apply candidate action parameters
    let simTrains: Train[] = trains.map((t) => {
      const action = candidateActions.find((a) => a.affectedTrainId === t.id);
      const cloned = structuredClone(t);

      if (action) {
        if (action.action === "HOLD_TRAIN") {
          cloned.speed = 0;
          cloned.status = "HELD";
        } else if (action.action === "REDUCE_SPEED" || action.action === "INCREASE_SPEED" || action.action === "MAINTAIN_SPEED" || action.action === "GLIDE_SPEED") {
          if (action.targetSpeed !== undefined) {
            cloned.speed = action.targetSpeed;
            cloned.targetSpeed = action.targetSpeed;
            if ((cloned.status === "HELD" || cloned.status === "STOPPED") && action.targetSpeed > 0) {
              cloned.status = "ON_TIME";
            }
          }
        } else if (action.action === "PRIORITIZE_TRAIN") {
          cloned.priority = Math.min(10, cloned.priority + 1);
        }
      }

      return cloned;
    });

    let simSections = structuredClone(sections);
    const stepSizeSeconds = 10;
    const totalSteps = Math.max(1, Math.floor(horizonSeconds / stepSizeSeconds));

    // Helper to capture timeline checkpoint state
    const captureCheckpoint = (offsetSec: number): TimelineCheckpoint => {
      const evalConflicts = conflictEngine.evaluateConflicts(
        simTrains,
        simSections,
        junctions,
        Math.min(180, horizonSeconds)
      );

      const chkTrains: PredictedTrainState[] = simTrains.map((t) => {
        const initialTrain = trains.find((it) => it.id === t.id);
        let predictedDelay = t.delayMinutes;

        if (initialTrain && t.speed > initialTrain.speed && initialTrain.delayMinutes > 0) {
          const secRange = corridorTopology.sectionMap[t.currentSection];
          const remKm = Math.max(1, ((100 - initialTrain.position) / 100) * (secRange?.lengthKm || 25));
          const timeOldMin = (remKm / Math.max(20, initialTrain.speed)) * 60;
          const timeNewMin = (remKm / t.speed) * 60;
          const savedMin = Math.max(0, timeOldMin - timeNewMin);
          predictedDelay = Math.max(0, Number((initialTrain.delayMinutes - savedMin).toFixed(1)));
        }

        return {
          trainId: t.id,
          currentSection: t.currentSection,
          positionPercent: t.position,
          speedKmH: t.speed,
          delayMinutes: predictedDelay,
          status: t.status,
        };
      });

      const chkSections: PredictedSectionState[] = simSections.map((sec) => {
        const occTrains = simTrains.filter(
          (t) => t.currentSection === sec.id && !t.completed && t.status !== "COMPLETED"
        );
        const count = occTrains.length;
        const capacity = sec.capacity || 1;
        const occupancyRate = Math.min(100, Math.round((count / capacity) * 100));

        const liveFlux = occTrains.reduce((acc, t) => {
          return acc + t.speed / (sec.lengthKm || 25);
        }, 0);

        const sectionThroughput = Number((liveFlux * 0.6 + (count > 0 ? 0.8 : 0)).toFixed(2));
        const isBottleneck = count >= capacity && count > 0;

        return {
          sectionId: sec.id,
          activeTrainCount: count,
          occupancyRate,
          sectionThroughput,
          isBottleneck,
        };
      });

      const headways: PredictedHeadwayState[] = [];
      for (let i = 0; i < simTrains.length; i++) {
        for (let j = i + 1; j < simTrains.length; j++) {
          const tA = simTrains[i];
          const tB = simTrains[j];
          if (tA.completed || tB.completed) continue;

          if (tA.currentSection === tB.currentSection) {
            const secRange = corridorTopology.sectionMap[tA.currentSection];
            const lengthKm = secRange ? secRange.lengthKm : 25;
            const diffKm = Number(((Math.abs(tA.position - tB.position) / 100) * lengthKm).toFixed(2));
            headways.push({
              trainA: tA.id,
              trainB: tB.id,
              sectionId: tA.currentSection,
              separationDistanceKm: diffKm,
              isHeadwayCompliant: diffKm >= 2.0,
            });
          }
        }
      }

      const predictedSignals: PredictedSignalState[] = signals.map((sig) => {
        const occTrains = simTrains.filter(
          (t) => t.currentSection === sig.sectionId && !t.completed && t.status !== "COMPLETED"
        );
        const isOccupied = occTrains.length > 0;
        const isCritical = occTrains.some((t) => t.status === "CRITICAL");
        const isConflict = evalConflicts.activeConflicts.some(
          (c) => c.sectionA === sig.sectionId || c.sectionB === sig.sectionId
        );

        const isSigFailed = activeIncidents.some(
          (inc) =>
            inc.affectedSignalId === sig.id &&
            inc.type === "SIGNAL_ASPECT_FAILURE" &&
            inc.status !== "RESOLVED_CLOSED"
        );

        const isSecBlocked = activeIncidents.some(
          (inc) =>
            inc.affectedSectionId === sig.sectionId &&
            (inc.type === "TRACK_SECTION_BLOCKAGE" || inc.isCompleteBlockage) &&
            inc.status !== "RESOLVED_CLOSED"
        );

        let aspect: SignalAspect = "GREEN";
        let reason = "Block clear and available for nominal speed";
        if (isSigFailed) {
          aspect = "RED";
          reason = "Signal Aspect Failure: Degraded Mode";
        } else if (isSecBlocked) {
          aspect = "RED";
          reason = "Signal Held: Track section is BLOCKED by active incident";
        } else if (isCritical || isConflict) {
          aspect = "RED";
          reason = isCritical ? "Emergency brake: Critical train ahead" : "Forecast conflict detected on block";
        } else if (isOccupied) {
          aspect = "RED";
          reason = `Forecast block occupied by ${occTrains.map((t) => t.name).join(", ")}`;
        }

        return {
          signalId: sig.id,
          sectionId: sig.sectionId,
          aspect,
          reason,
        };
      });

      const bottleneckSec = chkSections.find((s) => s.isBottleneck);

      return {
        offsetSeconds: offsetSec,
        absoluteSimulationTime: offsetSec,
        trains: chkTrains,
        sections: chkSections,
        signals: predictedSignals,
        headways,
        activeConflictsCount: evalConflicts.activeConflicts.length,
        conflicts: evalConflicts.predictedConflicts,
        bottleneckSection: bottleneckSec ? bottleneckSec.sectionId : null,
      };
    };

    const timelineCheckpoints: TimelineCheckpoint[] = [];
    // Target checkpoint offsets (e.g. 0, 60, 120, 300, 600, 900) bounded strictly by configured horizon
    const targetCheckpointOffsets = [60, 120, 300, 600, 900].filter((off) => off <= horizonSeconds);

    // Initial milestone (+0s)
    timelineCheckpoints.push(captureCheckpoint(0));

    // 2. Step forward in discrete time intervals
    for (let step = 0; step < totalSteps; step++) {
      const currentOffsetSec = (step + 1) * stepSizeSeconds;

      // Advance physics
      simTrains = simTrains.map((train) => {
        if (
          train.status === "CRITICAL" ||
          train.status === "HELD" ||
          train.status === "STOPPED" ||
          train.status === "COMPLETED" ||
          train.completed
        ) {
          return train;
        }

        const sectionRange = corridorTopology.sectionMap[train.currentSection];
        if (!sectionRange) return train;

        const effectiveLimit = this.getEffectiveSectionSpeedLimit(
          train.currentSection,
          sections,
          activeIncidents
        );
        const trainSpeed =
          effectiveLimit > 0 && train.speed > effectiveLimit ? effectiveLimit : train.speed;

        const distanceTravelledKm = (trainSpeed * stepSizeSeconds) / 3600;
        let distanceInsideSectionKm =
          (train.position / 100) * sectionRange.lengthKm + distanceTravelledKm;

        let currentSectionId = train.currentSection;
        let currentLength = sectionRange.lengthKm;
        let completed = false;

        while (distanceInsideSectionKm >= currentLength) {
          const nextSectionId = resolveNextSection(currentSectionId);

          if (!nextSectionId) {
            distanceInsideSectionKm = currentLength;
            completed = true;
            break;
          }

          // Block signal protection: Train cannot enter occupied or blocked downstream block
          const isNextOccupied = simTrains.some(
            (t) =>
              t.id !== train.id &&
              t.currentSection === nextSectionId &&
              !t.completed &&
              t.status !== "COMPLETED"
          );

          const isNextBlocked = activeIncidents.some(
            (inc) =>
              inc.affectedSectionId === nextSectionId &&
              (inc.type === "TRACK_SECTION_BLOCKAGE" || inc.isCompleteBlockage) &&
              inc.status !== "RESOLVED_CLOSED"
          );

          if (isNextOccupied || isNextBlocked) {
            distanceInsideSectionKm = currentLength * 0.99;
            break;
          }

          const overflowKm = distanceInsideSectionKm - currentLength;
          const nextRange = corridorTopology.sectionMap[nextSectionId];
          if (!nextRange) break;

          currentSectionId = nextSectionId;
          currentLength = nextRange.lengthKm;
          distanceInsideSectionKm = overflowKm;
        }

        const boundedPercent = Math.max(
          0,
          Math.min((distanceInsideSectionKm / currentLength) * 100, 100)
        );

        return {
          ...train,
          speed: trainSpeed,
          currentSection: currentSectionId,
          position: Number(boundedPercent.toFixed(2)),
          status: completed ? "COMPLETED" : train.status,
          completed,
        };
      });

      // Synchronize sections
      simSections = simSections.map((sec) => {
        const occ = simTrains.filter(
          (t) => t.currentSection === sec.id && !t.completed && t.status !== "COMPLETED"
        );
        const isBlocked = activeIncidents.some(
          (inc) =>
            inc.affectedSectionId === sec.id &&
            (inc.type === "TRACK_SECTION_BLOCKAGE" || inc.isCompleteBlockage) &&
            inc.status !== "RESOLVED_CLOSED"
        );
        return {
          ...sec,
          status: isBlocked ? "BLOCKED" : occ.length > 0 ? "OCCUPIED" : "AVAILABLE",
          occupiedTrains: occ.map((t) => t.id),
        };
      });

      // Safety check: Headway separation margin (2.0 km hard barrier)
      for (let i = 0; i < simTrains.length; i++) {
        for (let j = i + 1; j < simTrains.length; j++) {
          const tA = simTrains[i];
          const tB = simTrains[j];
          if (tA.completed || tB.completed) continue;

          if (tA.currentSection === tB.currentSection) {
            const secRange = corridorTopology.sectionMap[tA.currentSection];
            const lengthKm = secRange ? secRange.lengthKm : 25;
            const diffKm = (Math.abs(tA.position - tB.position) / 100) * lengthKm;

            const lead = tA.position >= tB.position ? tA : tB;
            const trail = tA.position >= tB.position ? tB : tA;

            // Initial separation check
            const initialA = trains.find((t) => t.id === tA.id);
            const initialB = trains.find((t) => t.id === tB.id);
            const initialDiffKm =
              initialA && initialB && initialA.currentSection === initialB.currentSection
                ? (Math.abs(initialA.position - initialB.position) / 100) * lengthKm
                : 25;

            // Headway separation violation:
            if (
              (initialDiffKm >= 2.0 && diffKm < 2.0 && tA.speed > 0 && tB.speed > 0) ||
              (trail.speed > lead.speed && diffKm < initialDiffKm) ||
              (initialDiffKm < 2.0 && trail.speed >= lead.speed)
            ) {
              isSafe = false;
              safetyViolationReason = `Headway separation violation (${diffKm.toFixed(1)} km) between ${tA.name} and ${tB.name} in section ${tA.currentSection}`;
              break;
            }
          }
        }
        if (!isSafe) break;
      }

      // Sample checkpoint if current step matches target checkpoint offset
      if (targetCheckpointOffsets.includes(currentOffsetSec)) {
        timelineCheckpoints.push(captureCheckpoint(currentOffsetSec));
      }

      if (!isSafe) break;
    }

    // 3. Assemble Predicted Snapshot
    const activeConflicts = conflictEngine.evaluateConflicts(simTrains, simSections, junctions, horizonSeconds);

    const predictedTrains: PredictedTrainState[] = simTrains.map((t) => {
      const initialTrain = trains.find((it) => it.id === t.id);
      let predictedDelay = t.delayMinutes;

      if (initialTrain && t.speed > initialTrain.speed && initialTrain.delayMinutes > 0) {
        const secRange = corridorTopology.sectionMap[t.currentSection];
        const remKm = Math.max(1, ((100 - initialTrain.position) / 100) * (secRange?.lengthKm || 25));
        const timeOldMin = (remKm / Math.max(20, initialTrain.speed)) * 60;
        const timeNewMin = (remKm / t.speed) * 60;
        const savedMin = Math.max(0, timeOldMin - timeNewMin);
        predictedDelay = Math.max(0, Number((initialTrain.delayMinutes - savedMin).toFixed(1)));
      }

      return {
        trainId: t.id,
        currentSection: t.currentSection,
        positionPercent: t.position,
        speedKmH: t.speed,
        delayMinutes: predictedDelay,
        status: t.status,
      };
    });

    const predictedSections: PredictedSectionState[] = simSections.map((sec) => {
      const occTrains = simTrains.filter(
        (t) => t.currentSection === sec.id && !t.completed && t.status !== "COMPLETED"
      );
      const count = occTrains.length;
      const capacity = sec.capacity || 1;
      const occupancyRate = Math.min(100, Math.round((count / capacity) * 100));

      const liveFlux = occTrains.reduce((acc, t) => {
        return acc + t.speed / (sec.lengthKm || 25);
      }, 0);

      const sectionThroughput = Number((liveFlux * 0.6 + (count > 0 ? 0.8 : 0)).toFixed(2));
      const isBottleneck = count >= capacity && count > 0;

      return {
        sectionId: sec.id,
        activeTrainCount: count,
        occupancyRate,
        sectionThroughput,
        isBottleneck,
      };
    });

    const sumSectionThroughput = predictedSections.reduce(
      (acc, s) => acc + s.sectionThroughput,
      0
    );
    const corridorThroughput = Number(
      (sumSectionThroughput / (predictedSections.length || 1)).toFixed(2)
    );

    const totalDelayMinutes = predictedTrains.reduce((acc, t) => acc + (t.delayMinutes || 0), 0);
    const averageDelayMinutes = predictedTrains.length > 0 ? Number((totalDelayMinutes / predictedTrains.length).toFixed(1)) : 0;
    const maximumDelayMinutes = predictedTrains.reduce((max, t) => Math.max(max, t.delayMinutes || 0), 0);

    const predictedState: PredictedStateSnapshot = {
      timeHorizonSeconds: horizonSeconds,
      trains: predictedTrains,
      sections: predictedSections,
      activeConflictsCount: activeConflicts.activeConflicts.length,
      predictedConflictsCount: activeConflicts.predictedConflicts.length,
      corridorThroughput,
      totalDelayMinutes,
      averageDelayMinutes,
      maximumDelayMinutes,
      timeline: timelineCheckpoints,
    };

    return {
      predictedState,
      isSafe,
      safetyViolationReason,
    };
  }
}

export const predictionEngine = new PredictionEngine();
