/**
 * RTPXO - Throughput & Telemetry Engine (Phase 5 Extended)
 * Computes deterministic section-level throughput, physical flow flux,
 * bottleneck indices, completed trip metrics, and operational KPIs from live simulation state.
 */

import { Train, RailwaySection, Signal, TrainConflict } from "@/types/railway";
import {
  SectionUtilization,
  ThroughputMetrics,
  CorridorTelemetry,
  SignalStatusCount,
  CompletedTrainRecord,
  CongestionState,
} from "@/types/metrics";
import { PredictedConflict, AIRecommendation } from "@/types/advisor";
import { corridorTopology } from "@/data/topology";

export class ThroughputEngine {
  private completedRecords: CompletedTrainRecord[] = [];
  private totalCumulativeDistanceKm: number = 0;
  private conflictFreeTimeSeconds: number = 0;
  private totalRecommendationsIssued: number = 0;
  private totalRecommendationsAccepted: number = 0;
  private totalDelaySavedMinutes: number = 0;

  // Section entry/exit/dwell counters per sectionId
  private sectionEntries = new Map<string, number>();
  private sectionExits = new Map<string, number>();
  private sectionDwellTotals = new Map<string, number>();
  private sectionDwellCounts = new Map<string, number>();

  public reset(): void {
    this.completedRecords = [];
    this.totalCumulativeDistanceKm = 0;
    this.conflictFreeTimeSeconds = 0;
    this.totalRecommendationsIssued = 0;
    this.totalRecommendationsAccepted = 0;
    this.totalDelaySavedMinutes = 0;
    this.sectionEntries.clear();
    this.sectionExits.clear();
    this.sectionDwellTotals.clear();
    this.sectionDwellCounts.clear();
  }

  public recordSectionEntry(sectionId: string): void {
    const current = this.sectionEntries.get(sectionId) || 0;
    this.sectionEntries.set(sectionId, current + 1);
  }

  public recordSectionExit(sectionId: string, dwellSeconds: number = 0): void {
    const currentExits = this.sectionExits.get(sectionId) || 0;
    this.sectionExits.set(sectionId, currentExits + 1);

    if (dwellSeconds > 0) {
      const currentDwell = this.sectionDwellTotals.get(sectionId) || 0;
      const currentCount = this.sectionDwellCounts.get(sectionId) || 0;
      this.sectionDwellTotals.set(sectionId, currentDwell + dwellSeconds);
      this.sectionDwellCounts.set(sectionId, currentCount + 1);
    }
  }

  public recordTrainCompletion(record: CompletedTrainRecord): void {
    this.completedRecords.push(record);
  }

  public addDistanceTravelled(km: number): void {
    this.totalCumulativeDistanceKm += Math.max(0, km);
  }

  public updateConflictFreeTime(secondsPassed: number, hasActiveConflicts: boolean): void {
    if (!hasActiveConflicts) {
      this.conflictFreeTimeSeconds += Math.max(0, secondsPassed);
    }
  }

  public recordRecommendations(totalIssued: number): void {
    this.totalRecommendationsIssued = Math.max(this.totalRecommendationsIssued, totalIssued);
  }

  public recordRecommendationAccepted(rec: AIRecommendation): void {
    this.totalRecommendationsAccepted += 1;
    if (rec.expectedEffect?.delayReductionMinutes) {
      this.totalDelaySavedMinutes += rec.expectedEffect.delayReductionMinutes;
    } else if (rec.expectedDelayImpact < 0) {
      this.totalDelaySavedMinutes += Math.abs(rec.expectedDelayImpact);
    }
  }

  /**
   * Computes section-by-section throughput and corridor-level operational KPIs.
   */
  public computeMetrics(
    trains: Train[],
    sections: RailwaySection[],
    signals: Signal[],
    activeConflicts: TrainConflict[],
    predictedConflicts: PredictedConflict[],
    simulationTimeSeconds: number
  ): {
    throughput: ThroughputMetrics;
    telemetry: CorridorTelemetry;
  } {
    const activeTrains = trains.filter((t) => !t.completed && t.status !== "COMPLETED");
    const delayedTrains = trains.filter((t) => t.status === "DELAYED");
    const criticalTrains = trains.filter((t) => t.status === "CRITICAL");
    const onTimeTrains = trains.filter((t) => t.status === "ON_TIME");
    const stoppedTrains = trains.filter((t) => t.status === "HELD" || t.status === "STOPPED");

    let highestBottleneckScore = -1;
    let topBottleneckSectionId: string | null = null;

    // 1. Calculate Section Throughput & Utilization
    const sectionUtilizations: SectionUtilization[] = sections.map((section) => {
      const trainsInSection = trains.filter(
        (t) => t.currentSection === section.id && !t.completed && t.status !== "COMPLETED"
      );

      const capacity = section.capacity || 1;
      const count = trainsInSection.length;
      const occupancyRate = Math.min(100, Math.round((count / capacity) * 100));

      const avgSpeed =
        count > 0
          ? Math.round(
              trainsInSection.reduce((acc, t) => acc + t.speed, 0) / count
            )
          : section.maximumSpeed;

      const speedLimit = section.maximumSpeed || 110;
      const speedUtilizationPercent = Math.min(
        100,
        Math.round((avgSpeed / speedLimit) * 100)
      );

      const entered = this.sectionEntries.get(section.id) || (count > 0 ? 1 : 0);
      const exited = this.sectionExits.get(section.id) || 0;

      // Calculate dwell averages
      const dwellTotal = this.sectionDwellTotals.get(section.id) || 0;
      const dwellCount = this.sectionDwellCounts.get(section.id) || 0;
      const averageDwellSeconds =
        dwellCount > 0 ? Math.round(dwellTotal / dwellCount) : Math.round((section.lengthKm / (avgSpeed || 60)) * 3600);

      // Section average delay
      const totalSectionDelay = trainsInSection.reduce((acc, t) => acc + (t.delayMinutes || 0), 0);
      const averageDelayMinutes = count > 0 ? Number((totalSectionDelay / count).toFixed(1)) : 0;

      // Section Flow Rate: (Sum of Train Velocities / Section Length) + Exit flux
      const liveKinematicFlux = trainsInSection.reduce((acc, t) => {
        return acc + (t.speed / (section.lengthKm || 25));
      }, 0);

      const elapsedHours = Math.max(0.05, simulationTimeSeconds / 3600);
      const exitRate = (exited / elapsedHours) * 0.4;
      const sectionThroughput = Number((liveKinematicFlux * 0.6 + exitRate).toFixed(2));

      // Congestion State Classification
      let congestionState: CongestionState = "FREE_FLOW";
      if (count > capacity || count >= 2 || avgSpeed < speedLimit * 0.4) {
        congestionState = "SATURATED";
      } else if (count >= 1 && (avgSpeed < speedLimit * 0.7 || averageDelayMinutes > 3)) {
        congestionState = "CONGESTED";
      } else if (count === 1 && avgSpeed < speedLimit * 0.9) {
        congestionState = "MODERATE";
      }

      // Bottleneck Score Calculation (0-100)
      const occupancyWeight = (count / capacity) * 40;
      const speedDeficitWeight = ((speedLimit - avgSpeed) / speedLimit) * 35;
      const delayWeight = Math.min(25, averageDelayMinutes * 3);
      const bottleneckScore = Math.min(
        100,
        Math.round(occupancyWeight + speedDeficitWeight + delayWeight)
      );

      const isBottleneck = bottleneckScore >= 40 && count > 0;
      if (bottleneckScore > highestBottleneckScore && count > 0) {
        highestBottleneckScore = bottleneckScore;
        topBottleneckSectionId = section.id;
      }

      return {
        sectionId: section.id,
        sectionName: section.name,
        sectionLengthKm: section.lengthKm,
        occupancyRate,
        activeTrainCount: count,
        capacity,
        speedLimitKmH: speedLimit,
        averageSpeedKmH: avgSpeed,
        speedUtilizationPercent,
        trainsEntered: entered,
        trainsExited: exited,
        sectionThroughput,
        averageDwellSeconds,
        averageDelayMinutes,
        congestionState,
        bottleneckScore,
        isBottleneck,
        densityScore: Math.min(1, Number((count / capacity).toFixed(2))),
      };
    });

    // 2. Average Delays, Maximum Delay & Travel Times
    const totalDelay = trains.reduce((acc, t) => acc + (t.delayMinutes || 0), 0);
    const averageDelay = trains.length > 0 ? Number((totalDelay / trains.length).toFixed(1)) : 0;
    const maximumDelay = trains.reduce((max, t) => Math.max(max, t.delayMinutes || 0), 0);

    const totalTravelTimeSec = trains.reduce(
      (acc, t) => acc + (t.totalTravelTimeSeconds || simulationTimeSeconds),
      0
    );
    const averageTravelTime =
      trains.length > 0
        ? Number((totalTravelTimeSec / trains.length / 60).toFixed(1))
        : 0;

    // 3. Length-weighted Corridor Utilization
    let weightedOccupancySum = 0;
    let totalCorridorLength = 0;

    for (const sec of sections) {
      const length = sec.lengthKm || 10;
      const secUtil = sectionUtilizations.find((u) => u.sectionId === sec.id);
      const occ = secUtil ? secUtil.occupancyRate : 0;
      weightedOccupancySum += occ * length;
      totalCorridorLength += length;
    }

    const corridorUtilization =
      totalCorridorLength > 0
        ? Math.round(weightedOccupancySum / totalCorridorLength)
        : 0;

    // 4. Corridor-wide Throughput KPI Calculation
    const sumSectionThroughput = sectionUtilizations.reduce(
      (acc, u) => acc + u.sectionThroughput,
      0
    );
    const corridorThroughput =
      sectionUtilizations.length > 0
        ? Number((sumSectionThroughput / sectionUtilizations.length).toFixed(2))
        : 0;

    // Baseline uncoordinated throughput: sum(0.70 * maxSpeed / length) * 0.85
    const baselineThroughput = Number(
      (
        sections.reduce((acc, sec) => {
          return acc + ((0.7 * sec.maximumSpeed) / sec.lengthKm) * 0.85;
        }, 0) / (sections.length || 1)
      ).toFixed(2)
    );

    const throughputImprovement =
      baselineThroughput > 0
        ? Number(
            (
              ((corridorThroughput - baselineThroughput) / baselineThroughput) *
              100
            ).toFixed(1)
          )
        : 0;

    const acceptanceRate =
      this.totalRecommendationsIssued > 0
        ? Math.round(
            (this.totalRecommendationsAccepted / this.totalRecommendationsIssued) * 100
          )
        : 0;

    const throughputMetrics: ThroughputMetrics = {
      trainsCompleted: this.completedRecords.length,
      trainsPerHour: corridorThroughput,
      corridorThroughput,
      baselineThroughput,
      throughputImprovement: Math.max(0, throughputImprovement),
      averageDelay,
      maximumDelay,
      averageTravelTime,
      corridorUtilization,
      bottleneckSection: topBottleneckSectionId,
      totalDistanceTraveledKm: Number(this.totalCumulativeDistanceKm.toFixed(1)),
      conflictFreeTimeSeconds: Math.round(this.conflictFreeTimeSeconds),
      recommendationsTotalCount: this.totalRecommendationsIssued,
      recommendationsAcceptedCount: this.totalRecommendationsAccepted,
      recommendationAcceptanceRate: acceptanceRate,
      estimatedDelaySavedMinutes: Number(this.totalDelaySavedMinutes.toFixed(1)),
      completedRecords: structuredClone(this.completedRecords),
    };

    // 5. Signal Aspect Summary
    const signalStatesCount: SignalStatusCount = {
      green: signals.filter((s) => s.aspect === "GREEN").length,
      yellow: signals.filter((s) => s.aspect === "YELLOW").length,
      doubleYellow: signals.filter((s) => s.aspect === "DOUBLE_YELLOW").length,
      red: signals.filter((s) => s.aspect === "RED").length,
    };

    const telemetry: CorridorTelemetry = {
      activeTrains: activeTrains.length,
      delayedTrains: delayedTrains.length,
      stoppedTrains: stoppedTrains.length,
      criticalTrains: criticalTrains.length,
      onTimeTrains: onTimeTrains.length,
      activeConflicts: activeConflicts.length,
      predictedConflicts: predictedConflicts.length,
      signalStatesCount,
      throughput: throughputMetrics,
      sectionUtilizations,
      timestamp: simulationTimeSeconds,
    };

    return {
      throughput: throughputMetrics,
      telemetry,
    };
  }
}

export const throughputEngine = new ThroughputEngine();
