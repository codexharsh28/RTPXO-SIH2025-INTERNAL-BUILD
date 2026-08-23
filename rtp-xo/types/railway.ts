/**
 * RTPXO - Railway Core Domain Models
 * Defines foundational data structures for trains, stations, railway sections,
 * dynamic signals, and junctions.
 */

export type TrainStatus =
  | "ON_TIME"
  | "DELAYED"
  | "CRITICAL"
  | "HELD"
  | "HOLDING"
  | "COMPLETED"
  | "STOPPED"
  | "CONFLICT"
  | "APPROACHING_JUNCTION";

export type TrainType =
  | "EXPRESS"
  | "SUPERFAST"
  | "PASSENGER"
  | "FREIGHT";

export type SignalAspect =
  | "RED"
  | "YELLOW"
  | "DOUBLE_YELLOW"
  | "GREEN";

export type SectionStatus =
  | "AVAILABLE"
  | "OCCUPIED"
  | "BLOCKED"
  | "RESTRICTED";

export type TravelDirection = "UP" | "DOWN";

export interface Train {
  id: string;
  name: string;
  type: TrainType;
  priority: number; // 1 (lowest) to 10 (highest, e.g. Rajdhani)

  currentSection: string;
  currentBlock?: string; // Authoritative track block ID (e.g. "ND-GZB-01-BLK-01")
  position: number; // Percentage (0-100) inside currentSection
  progress?: number; // Percentage (0-100), alias for position
  speed: number; // Current authoritative speed in km/h
  maxSpeed?: number; // Maximum physical design/authorized speed in km/h

  status: TrainStatus;
  delay?: number; // Authoritative delay in minutes, alias for delayMinutes
  delayMinutes: number;

  origin: string;
  destination: string;

  scheduledArrival: string;
  expectedArrival: string;

  route?: string[]; // Planned sequence of section IDs
  routeIndex?: number; // Current active index in route sequence

  // Extended architectural attributes
  targetSpeed?: number; // Target advisory/commanded speed in km/h
  routeSections?: string[]; // Planned sequence of section IDs
  direction?: TravelDirection; // UP = Northbound/Outbound, DOWN = Southbound/Inbound
  lengthMeters?: number; // Train length (default: 500m)
  enteredSectionAt?: number; // Simulation timestamp (seconds) when train entered current section
  totalTravelTimeSeconds?: number; // Cumulative transit duration in corridor
  completed?: boolean; // Set to true when destination reached
}

export interface Station {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  platforms: number;
  connectedSections: string[];
  code?: string; // Standard railway station code (e.g. "NDLS", "GZB")
  corridorKm?: number; // Cumulative kilometer offset from corridor start
}

export interface RailwaySection {
  id: string;
  name: string;
  startStation: string;
  endStation: string;
  lengthKm: number;
  maximumSpeed: number; // Speed limit in km/h
  effectiveSpeedLimit?: number; // Operational speed limit in km/h factoring in active TSRs
  status: SectionStatus;
  occupiedBy: string | null; // Primary occupying train ID (or null)

  // Extended topology attributes
  capacity?: number; // Max train capacity (default: 1 for absolute block signaling)
  occupiedTrains?: string[]; // List of all train IDs currently within section bounds
  connectedSections?: string[]; // Connected section IDs
  tracks?: number; // Number of parallel lines (1 = Single, 2 = Double)
  startKm?: number; // Corridor offset in km
  endKm?: number; // Corridor offset in km
}

export interface Signal {
  id: string;
  name: string;
  stationId: string;
  sectionId: string;
  aspect: SignalAspect;

  // Extended signal attributes for dynamic control
  distanceKm?: number; // Distance position relative to station or section start
  reason?: string; // Reason for current aspect (e.g. "Block occupied by T001")
  controlledBy?: "AUTOMATIC" | "ADVISOR" | "OPERATOR";
  targetAspect?: SignalAspect; // Recommended aspect from AI Advisor
}

export interface JunctionRoute {
  id: string;
  fromSection: string;
  toSection: string;
  conflictingRouteIds: string[];
  active: boolean;
}

export interface Junction {
  id: string;
  name: string;
  stationId: string;
  connectedSections: string[];
  activeRoute: string | null;
  conflictRoutes: string[];
  possibleRoutes?: JunctionRoute[];
}

export interface TrainConflict {
  id?: string;
  type?: "HEADWAY_VIOLATION" | "JUNCTION_CONVERGENCE" | "SPEED_DIFFERENTIAL";
  trainA: string;
  trainB: string;
  junctionId: string;
  sectionA: string;
  sectionB: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  reason: string;
}