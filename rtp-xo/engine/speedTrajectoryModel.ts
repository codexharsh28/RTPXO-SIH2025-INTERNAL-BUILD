/**
 * RTPXO - Speed Trajectory Model (Phase 6 Trajectory Profiling)
 * Computes multi-stage kinematic speed profiles to eliminate stop-and-go energy loss
 * and optimize gliding arrival across block section boundaries.
 */

import { Train, RailwaySection } from "@/types/railway";
import { SpeedTrajectory, SpeedTrajectoryStage } from "@/types/optimization";

export class SpeedTrajectoryModel {
  /**
   * Generates a multi-stage continuous speed trajectory for a train.
   */
  public generateTrajectory(
    train: Train,
    section: RailwaySection,
    downstreamOccupied: boolean,
    targetSpeedKmH?: number
  ): SpeedTrajectory {
    const currentSpeed = Math.max(train.speed, 20);
    const speedLimit = section.maximumSpeed || 110;
    const remainingKm = Math.max(1, ((100 - train.position) / 100) * section.lengthKm);

    const stages: SpeedTrajectoryStage[] = [];

    if (downstreamOccupied && train.position >= 50) {
      // Glide Deceleration Profile
      const glideSpeed = 60;
      const cruiseDist = Math.max(0.5, remainingKm * 0.6);
      const decelDist = remainingKm - cruiseDist;

      const stage1Duration = Math.round((cruiseDist / currentSpeed) * 3600);
      const stage2Duration = Math.round((decelDist / ((currentSpeed + glideSpeed) / 2)) * 3600);

      stages.push({
        stageIndex: 1,
        speedKmH: currentSpeed,
        distanceKm: Number(cruiseDist.toFixed(1)),
        durationSeconds: stage1Duration,
        instruction: `Maintain cruise velocity at ${currentSpeed} km/h for ${cruiseDist.toFixed(1)} km`,
      });

      stages.push({
        stageIndex: 2,
        speedKmH: glideSpeed,
        distanceKm: Number(decelDist.toFixed(1)),
        durationSeconds: stage2Duration,
        instruction: `Smooth glide deceleration to ${glideSpeed} km/h approaching downstream block boundary`,
      });

      return {
        trainId: train.id,
        initialSpeedKmH: currentSpeed,
        targetSpeedKmH: glideSpeed,
        totalDistanceKm: Number(remainingKm.toFixed(1)),
        totalDurationSeconds: stage1Duration + stage2Duration,
        stages,
        summary: `Maintain ${currentSpeed} km/h for ${cruiseDist.toFixed(1)} km, then glide to ${glideSpeed} km/h over ${decelDist.toFixed(1)} km to prevent red aspect stop.`,
      };
    } else if (train.status === "DELAYED" && !downstreamOccupied) {
      // Schedule Recovery Acceleration Profile
      const maxPermitted = targetSpeedKmH || Math.min(train.maxSpeed || 130, speedLimit);
      const accelDist = Math.min(2.0, remainingKm * 0.25);
      const cruiseDist = remainingKm - accelDist;

      const stage1Duration = Math.round((accelDist / ((currentSpeed + maxPermitted) / 2)) * 3600);
      const stage2Duration = Math.round((cruiseDist / maxPermitted) * 3600);

      stages.push({
        stageIndex: 1,
        speedKmH: maxPermitted,
        distanceKm: Number(accelDist.toFixed(1)),
        durationSeconds: stage1Duration,
        instruction: `Progressive acceleration from ${currentSpeed} km/h to line speed ${maxPermitted} km/h`,
      });

      stages.push({
        stageIndex: 2,
        speedKmH: maxPermitted,
        distanceKm: Number(cruiseDist.toFixed(1)),
        durationSeconds: stage2Duration,
        instruction: `Sustained line speed cruise at ${maxPermitted} km/h through section exit`,
      });

      return {
        trainId: train.id,
        initialSpeedKmH: currentSpeed,
        targetSpeedKmH: maxPermitted,
        totalDistanceKm: Number(remainingKm.toFixed(1)),
        totalDurationSeconds: stage1Duration + stage2Duration,
        stages,
        summary: `Accelerate to line speed ${maxPermitted} km/h over ${accelDist.toFixed(1)} km, then sustain cruise to recover delay.`,
      };
    } else {
      // Steady State Nominal Profile
      const target = targetSpeedKmH || currentSpeed;
      const duration = Math.round((remainingKm / target) * 3600);

      stages.push({
        stageIndex: 1,
        speedKmH: target,
        distanceKm: Number(remainingKm.toFixed(1)),
        durationSeconds: duration,
        instruction: `Maintain steady state speed at ${target} km/h through section exit`,
      });

      return {
        trainId: train.id,
        initialSpeedKmH: currentSpeed,
        targetSpeedKmH: target,
        totalDistanceKm: Number(remainingKm.toFixed(1)),
        totalDurationSeconds: duration,
        stages,
        summary: `Maintain steady state speed ${target} km/h for ${remainingKm.toFixed(1)} km to preserve synchronized headway.`,
      };
    }
  }
}

export const speedTrajectoryModel = new SpeedTrajectoryModel();
