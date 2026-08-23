/**
 * RTPXO - Railway Network Topology Domain Models
 * Provides contracts for multi-line interconnected railway networks, stations,
 * track sections, block signaling, platform allocation, junctions, and route graph connectivity.
 */

import { Train, SectionStatus, SignalAspect } from "./railway";

export interface StationMilestone {
  id: string;
  name: string;
  code?: string;
  platforms: number;
  cumulativeKm: number;
  corridorPercent: number; // 0 to 100% along the corridor
  connectedSections: string[];
}

export interface SectionRange {
  id: string;
  name: string;
  startStationId: string;
  endStationId: string;
  startKm: number;
  endKm: number;
  lengthKm: number;
  startPercent: number;
  endPercent: number;
  maximumSpeed: number;
}

export interface NetworkTopology {
  corridorId: string;
  corridorName: string;
  totalLengthKm: number;
  stations: StationMilestone[];
  sections: SectionRange[];
  sectionMap: Record<string, SectionRange>;
  stationMap: Record<string, StationMilestone>;
}

// ---------------------------------------------------------------------------
// EXTENDED MULTI-LINE INTERCONNECTED NETWORK ARCHITECTURE (STEP 11.1)
// ---------------------------------------------------------------------------

export type LineId =
  | "LINE-A"
  | "LINE-B"
  | "LINE-C"
  | "LINE-D"
  | "LINE-E"
  | string;

export interface PlatformDefinition {
  platformNumber: number;
  lengthMeters: number;
  isOccupied: boolean;
  occupiedTrainId: string | null;
}

export interface TrackBlock {
  id: string;
  sectionId: string;
  blockIndex: number;
  startKm: number;
  endKm: number;
  lengthKm: number;
  status: SectionStatus;
  occupiedBy: string | null;
  signalId?: string;
}

export interface RailwayLineDefinition {
  id: LineId;
  name: string;
  shortName: string;
  code: string;
  color: string; // Hex or CSS color token (e.g. #0284c7)
  startStationId: string;
  endStationId: string;
  stationIds: string[];
  sectionIds: string[];
  totalLengthKm: number;
  junctionStationIds: string[];
}

export interface StationTopologyNode {
  id: string; // Stable ID (e.g. "ND", "GZB", "MRT", "SNP", "ALJN", "AGC", "ANVT", "DBR", "KNP")
  name: string;
  code: string;
  kmPosition?: number; // Distance position in km
  platforms: number;
  platformDetails?: PlatformDefinition[];
  isJunction: boolean;
  junctionStatus?: boolean; // alias for isJunction
  junctionId?: string;
  connectedLineIds: LineId[];
  lineMembership?: LineId[]; // alias for connectedLineIds
  connectedSectionIds: string[];
  // Normalized 2D layout coordinates (0-100%) for multi-line schematic layout
  gridPosition: {
    x: number; // 0 to 100% horizontal
    y: number; // 0 to 100% vertical
  };
  coordinates?: {
    x: number;
    y: number;
  };
}

export interface SectionTopologyEdge {
  id: string; // Stable ID (e.g. "ND-GZB-01", "GZB-ALJN-01", "ND-ANVT-01", "ALJN-MRT-01", "DBR-ND-01")
  lineId: LineId;
  line?: LineId; // alias for lineId
  name: string;
  startStationId: string; // Origin
  fromStation?: string; // alias for startStationId
  endStationId: string; // Destination
  toStation?: string; // alias for endStationId
  lengthKm: number;
  distance?: number; // alias for lengthKm
  maximumSpeed: number;
  tracks: number; // 1 = Single track, 2 = Double track
  status: SectionStatus;
  occupancyState?: SectionStatus; // alias for status
  blockState?: string;
  signalState?: string;
  interlockingZone?: string;
  occupiedBy: string | null;
  occupiedTrains?: string[];
  blocks: TrackBlock[];
  signals: string[];
  startKm: number;
  endKm: number;
  direction: "BIDIRECTIONAL" | "UP" | "DOWN";
}

export interface JunctionAvailableRoute {
  id: string;
  fromSection: string;
  toSection: string;
  diverging: boolean;
  speedLimitKmH: number;
  isAligned: boolean;
  conflictingRouteIds: string[];
}

export interface JunctionConflictRelationship {
  routeA: string;
  routeB: string;
  conflictType: "CROSSING" | "CONVERGENCE" | "HEAD_ON";
  description: string;
}

export interface JunctionTopologyNode {
  id: string; // Stable ID (e.g. "J-GZB-01", "J-ND-01", "J-MRT-01", "J-ALJN-01", "J-DBR-01", "J-SNP-01")
  junctionId?: string; // alias for id
  name: string;
  stationId: string;
  connectedLines: LineId[];
  connectedSections: string[];
  switchState?: "NORMAL" | "REVERSE" | "ALIGNED" | "LOCKED" | string;
  activeRoute: string | null;
  visualPosition?: {
    x: number;
    y: number;
  };
  availableRoutes: JunctionAvailableRoute[];
  conflictRelationships: JunctionConflictRelationship[];
}

export interface SignalTopologyNode {
  id: string;
  signalId?: string;
  name?: string;
  sectionId: string;
  section?: string;
  aspect: SignalAspect;
  state?: SignalAspect;
  direction: "UP" | "DOWN" | "BIDIRECTIONAL";
  positionPercent: number; // 0 to 100% within section
  position?: number;
  coordinates?: { x: number; y: number };
}

export interface SwitchTopologyNode {
  id: string;
  name: string;
  stationId: string;
  fromTrack: string;
  toTrack: string;
  switchPosition: "NORMAL" | "REVERSE";
  state: "NORMAL" | "REVERSE" | "LOCKED" | "TRANSIT";
  coordinates: { x: number; y: number };
}

export interface InterlockingZoneNode {
  id: string;
  name: string;
  stationId: string;
  silLevel: string;
  status: "NOMINAL" | "RESTRICTED" | "DEGRADED";
  bounds: { x: number; y: number; width: number; height: number };
  activeSwitches: string[];
  activeRoutes: string[];
}

export interface MultiLineRailwayNetwork {
  networkId: string;
  networkName: string;
  lines: RailwayLineDefinition[];
  stations: Record<string, StationTopologyNode>;
  sections: Record<string, SectionTopologyEdge>;
  junctions: Record<string, JunctionTopologyNode>;
  switches?: Record<string, SwitchTopologyNode>;
  interlockingZones?: Record<string, InterlockingZoneNode>;
  signals?: Record<string, SignalTopologyNode>;
  allStationIds: string[];
  allSectionIds: string[];
  allJunctionIds: string[];
}
