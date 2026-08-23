/**
 * RTPXO - Metrics and Telemetry Domain Models
 * Defines performance tracking, section-level throughput, corridor capacity,
 * and operational telemetry.
 */

export type CongestionState =
  | "FREE_FLOW"
  | "MODERATE"
  | "CONGESTED"
  | "SATURATED";

export interface CompletedTrainRecord {
  trainId: string;
  trainName: string;
  completedAt: number; // Simulation timestamp in seconds
  totalTravelTimeSeconds: number;
  finalDelayMinutes: number;
  origin: string;
  destination: string;
  averageSpeedKmH: number;
}

export interface SectionUtilization {
  sectionId: string;
  sectionName: string;
  sectionLengthKm: number;
  occupancyRate: number; // 0 to 100%
  activeTrainCount: number;
  capacity: number;
  speedLimitKmH: number;
  averageSpeedKmH: number;
  speedUtilizationPercent: number; // (avgSpeed / speedLimit) * 100
  trainsEntered: number;
  trainsExited: number;
  sectionThroughput: number; // Trains processed per hour through this section
  averageDwellSeconds: number;
  averageDelayMinutes: number;
  congestionState: CongestionState;
  bottleneckScore: number; // 0 to 100
  isBottleneck: boolean;
  densityScore: number; // 0.0 to 1.0
}

export interface ThroughputMetrics {
  trainsCompleted: number;
  trainsPerHour: number;
  corridorThroughput: number; // Average section throughput across the corridor
  baselineThroughput: number; // Baseline unoptimized throughput
  throughputImprovement: number; // Measurable percentage improvement vs baseline
  averageDelay: number; // Average delay across all active trains in minutes
  maximumDelay: number; // Maximum delay among active trains in minutes
  averageTravelTime: number; // Average corridor travel time in minutes
  corridorUtilization: number; // Length-weighted corridor capacity utilization %
  bottleneckSection: string | null;
  totalDistanceTraveledKm: number;
  conflictFreeTimeSeconds: number; // Cumulative seconds without active conflicts
  recommendationsTotalCount: number;
  recommendationsAcceptedCount: number;
  recommendationAcceptanceRate: number; // % of recommendations accepted
  estimatedDelaySavedMinutes: number;
  completedRecords: CompletedTrainRecord[];
}

export interface SignalStatusCount {
  green: number;
  yellow: number;
  doubleYellow: number;
  red: number;
}

export interface CorridorTelemetry {
  activeTrains: number;
  delayedTrains: number;
  stoppedTrains: number;
  criticalTrains: number;
  onTimeTrains: number;
  activeConflicts: number;
  predictedConflicts: number;
  signalStatesCount: SignalStatusCount;
  throughput: ThroughputMetrics;
  sectionUtilizations: SectionUtilization[];
  timestamp: number;
}
