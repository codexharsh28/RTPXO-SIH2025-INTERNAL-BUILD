/**
 * RTPXO - Multi-Line Interconnected Railway Network Topology (Phase 11.5)
 *
 * Authoritative frontend network topology data layer representing:
 * - LINE A (Amber): New Delhi (NDLS) → Hazrat Nizamuddin (NZM) → Ghaziabad (GZB) → Meerut (MRT) → Moradabad (MB) → Bareilly (BE) → Saharanpur (SNP)
 * - LINE B (Cyan): Ghaziabad (GZB) → Aligarh (ALJN) → Tundla (TDL) → Kanpur (CNB) → Lucknow (LKO)
 * - LINE C (Green): Dadri (DBR) → Pilkhua (PKA) → Hapur (HPU) → Modinagar (MNR) → Muradnagar (MRD) → Ghaziabad (GZB)
 * - LINE D (Purple): Aligarh (ALJN) → Meerut (MRT) → Moradabad (MB) → Saharanpur (SNP)
 * - LINE E (Magenta): Dadri (DBR) → New Delhi (NDLS) → Ghaziabad (GZB) → Kanpur (CNB) → Lucknow (LKO)
 */

import {
  MultiLineRailwayNetwork,
  RailwayLineDefinition,
  StationTopologyNode,
  SectionTopologyEdge,
  JunctionTopologyNode,
  SignalTopologyNode,
  SwitchTopologyNode,
  InterlockingZoneNode,
  TrackBlock,
} from "@/types/topology";
import { Train, SectionStatus, SignalAspect } from "@/types/railway";

// ---------------------------------------------------------------------------
// 1. 16 DETAILED RAILWAY STATIONS DEFINITION
// ---------------------------------------------------------------------------

export const multiLineStations: Record<string, StationTopologyNode> = {
  ND: {
    id: "ND",
    name: "New Delhi",
    code: "NDLS",
    kmPosition: 0,
    platforms: 16,
    platformDetails: [
      { platformNumber: 1, lengthMeters: 650, isOccupied: false, occupiedTrainId: null },
      { platformNumber: 2, lengthMeters: 650, isOccupied: false, occupiedTrainId: null },
      { platformNumber: 3, lengthMeters: 600, isOccupied: false, occupiedTrainId: null },
      { platformNumber: 4, lengthMeters: 600, isOccupied: false, occupiedTrainId: null },
    ],
    isJunction: true,
    junctionStatus: true,
    junctionId: "J-ND-01",
    connectedLineIds: ["LINE-A", "LINE-E"],
    lineMembership: ["LINE-A", "LINE-E"],
    connectedSectionIds: ["ND-GZB-01", "DBR-ND-01"],
    gridPosition: { x: 7, y: 38 },
    coordinates: { x: 7, y: 38 },
  },

  NZM: {
    id: "NZM",
    name: "Hazrat Nizamuddin",
    code: "NZM",
    kmPosition: 8,
    platforms: 6,
    platformDetails: [
      { platformNumber: 1, lengthMeters: 600, isOccupied: false, occupiedTrainId: null },
      { platformNumber: 2, lengthMeters: 600, isOccupied: false, occupiedTrainId: null },
    ],
    isJunction: false,
    junctionStatus: false,
    connectedLineIds: ["LINE-A"],
    lineMembership: ["LINE-A"],
    connectedSectionIds: ["ND-GZB-01"],
    gridPosition: { x: 17, y: 38 },
    coordinates: { x: 17, y: 38 },
  },

  GZB: {
    id: "GZB",
    name: "Ghaziabad",
    code: "GZB",
    kmPosition: 25,
    platforms: 6,
    platformDetails: [
      { platformNumber: 1, lengthMeters: 620, isOccupied: false, occupiedTrainId: null },
      { platformNumber: 2, lengthMeters: 620, isOccupied: false, occupiedTrainId: null },
      { platformNumber: 3, lengthMeters: 580, isOccupied: false, occupiedTrainId: null },
    ],
    isJunction: true,
    junctionStatus: true,
    junctionId: "J-GZB-01",
    connectedLineIds: ["LINE-A", "LINE-B", "LINE-C", "LINE-E"],
    lineMembership: ["LINE-A", "LINE-B", "LINE-C", "LINE-E"],
    connectedSectionIds: ["ND-GZB-01", "GZB-MRT-01", "GZB-ALJN-01", "MRD-GZB-01"],
    gridPosition: { x: 28, y: 38 },
    coordinates: { x: 28, y: 38 },
  },

  MRT: {
    id: "MRT",
    name: "Meerut",
    code: "MRT",
    kmPosition: 71,
    platforms: 5,
    platformDetails: [
      { platformNumber: 1, lengthMeters: 550, isOccupied: false, occupiedTrainId: null },
      { platformNumber: 2, lengthMeters: 550, isOccupied: false, occupiedTrainId: null },
    ],
    isJunction: true,
    junctionStatus: true,
    junctionId: "J-MRT-01",
    connectedLineIds: ["LINE-A", "LINE-D"],
    lineMembership: ["LINE-A", "LINE-D"],
    connectedSectionIds: ["GZB-MRT-01", "MRT-SNP-01", "ALJN-MRT-01"],
    gridPosition: { x: 44, y: 30 },
    coordinates: { x: 44, y: 30 },
  },

  MB: {
    id: "MB",
    name: "Moradabad",
    code: "MB",
    kmPosition: 120,
    platforms: 5,
    platformDetails: [
      { platformNumber: 1, lengthMeters: 600, isOccupied: false, occupiedTrainId: null },
      { platformNumber: 2, lengthMeters: 600, isOccupied: false, occupiedTrainId: null },
    ],
    isJunction: true,
    junctionStatus: true,
    junctionId: "J-MB-01",
    connectedLineIds: ["LINE-A", "LINE-D"],
    lineMembership: ["LINE-A", "LINE-D"],
    connectedSectionIds: ["MRT-SNP-01"],
    gridPosition: { x: 64, y: 30 },
    coordinates: { x: 64, y: 30 },
  },

  BE: {
    id: "BE",
    name: "Bareilly",
    code: "BE",
    kmPosition: 150,
    platforms: 5,
    platformDetails: [
      { platformNumber: 1, lengthMeters: 620, isOccupied: false, occupiedTrainId: null },
      { platformNumber: 2, lengthMeters: 620, isOccupied: false, occupiedTrainId: null },
    ],
    isJunction: false,
    junctionStatus: false,
    connectedLineIds: ["LINE-A", "LINE-E"],
    lineMembership: ["LINE-A", "LINE-E"],
    connectedSectionIds: ["MRT-SNP-01", "ALJN-KNP-01"],
    gridPosition: { x: 78, y: 30 },
    coordinates: { x: 78, y: 30 },
  },

  SNP: {
    id: "SNP",
    name: "Saharanpur",
    code: "SNP",
    kmPosition: 186,
    platforms: 7,
    platformDetails: [
      { platformNumber: 1, lengthMeters: 600, isOccupied: false, occupiedTrainId: null },
      { platformNumber: 2, lengthMeters: 600, isOccupied: false, occupiedTrainId: null },
    ],
    isJunction: true,
    junctionStatus: true,
    junctionId: "J-SNP-01",
    connectedLineIds: ["LINE-A", "LINE-D"],
    lineMembership: ["LINE-A", "LINE-D"],
    connectedSectionIds: ["MRT-SNP-01"],
    gridPosition: { x: 95, y: 30 },
    coordinates: { x: 95, y: 30 },
  },

  ALJN: {
    id: "ALJN",
    name: "Aligarh",
    code: "ALJN",
    kmPosition: 80,
    platforms: 6,
    platformDetails: [
      { platformNumber: 1, lengthMeters: 600, isOccupied: false, occupiedTrainId: null },
      { platformNumber: 2, lengthMeters: 600, isOccupied: false, occupiedTrainId: null },
    ],
    isJunction: true,
    junctionStatus: true,
    junctionId: "J-ALJN-01",
    connectedLineIds: ["LINE-B", "LINE-D", "LINE-E"],
    lineMembership: ["LINE-B", "LINE-D", "LINE-E"],
    connectedSectionIds: ["GZB-ALJN-01", "ALJN-AGC-01", "ALJN-MRT-01", "ALJN-KNP-01"],
    gridPosition: { x: 28, y: 56 },
    coordinates: { x: 28, y: 56 },
  },

  TDL: {
    id: "TDL",
    name: "Tundla",
    code: "TDL",
    kmPosition: 92,
    platforms: 6,
    platformDetails: [
      { platformNumber: 1, lengthMeters: 600, isOccupied: false, occupiedTrainId: null },
      { platformNumber: 2, lengthMeters: 600, isOccupied: false, occupiedTrainId: null },
    ],
    isJunction: true,
    junctionStatus: true,
    junctionId: "J-TDL-01",
    connectedLineIds: ["LINE-B"],
    lineMembership: ["LINE-B"],
    connectedSectionIds: ["ALJN-AGC-01"],
    gridPosition: { x: 44, y: 56 },
    coordinates: { x: 44, y: 56 },
  },

  CNB: {
    id: "CNB",
    name: "Kanpur Central",
    code: "CNB",
    kmPosition: 131,
    platforms: 8,
    platformDetails: [
      { platformNumber: 1, lengthMeters: 700, isOccupied: false, occupiedTrainId: null },
      { platformNumber: 2, lengthMeters: 700, isOccupied: false, occupiedTrainId: null },
    ],
    isJunction: true,
    junctionStatus: true,
    junctionId: "J-CNB-01",
    connectedLineIds: ["LINE-B", "LINE-E"],
    lineMembership: ["LINE-B", "LINE-E"],
    connectedSectionIds: ["ALJN-KNP-01"],
    gridPosition: { x: 68, y: 56 },
    coordinates: { x: 68, y: 56 },
  },

  LKO: {
    id: "LKO",
    name: "Lucknow",
    code: "LKO",
    kmPosition: 175,
    platforms: 8,
    platformDetails: [
      { platformNumber: 1, lengthMeters: 700, isOccupied: false, occupiedTrainId: null },
      { platformNumber: 2, lengthMeters: 700, isOccupied: false, occupiedTrainId: null },
    ],
    isJunction: false,
    junctionStatus: false,
    connectedLineIds: ["LINE-B", "LINE-E"],
    lineMembership: ["LINE-B", "LINE-E"],
    connectedSectionIds: ["ALJN-KNP-01"],
    gridPosition: { x: 94, y: 56 },
    coordinates: { x: 94, y: 56 },
  },

  DBR: {
    id: "DBR",
    name: "Dadri",
    code: "DBR",
    kmPosition: 15,
    platforms: 4,
    platformDetails: [
      { platformNumber: 1, lengthMeters: 550, isOccupied: false, occupiedTrainId: null },
      { platformNumber: 2, lengthMeters: 550, isOccupied: false, occupiedTrainId: null },
    ],
    isJunction: true,
    junctionStatus: true,
    junctionId: "J-DBR-01",
    connectedLineIds: ["LINE-C", "LINE-E"],
    lineMembership: ["LINE-C", "LINE-E"],
    connectedSectionIds: ["DBR-ND-01"],
    gridPosition: { x: 12, y: 80 },
    coordinates: { x: 12, y: 80 },
  },

  PKA: {
    id: "PKA",
    name: "Pilkhua",
    code: "PKA",
    kmPosition: 22,
    platforms: 4,
    platformDetails: [
      { platformNumber: 1, lengthMeters: 500, isOccupied: false, occupiedTrainId: null },
    ],
    isJunction: false,
    junctionStatus: false,
    connectedLineIds: ["LINE-C"],
    lineMembership: ["LINE-C"],
    connectedSectionIds: ["DBR-ND-01"],
    gridPosition: { x: 22, y: 80 },
    coordinates: { x: 22, y: 80 },
  },

  HPU: {
    id: "HPU",
    name: "Hapur",
    code: "HPU",
    kmPosition: 35,
    platforms: 4,
    platformDetails: [
      { platformNumber: 1, lengthMeters: 500, isOccupied: false, occupiedTrainId: null },
    ],
    isJunction: false,
    junctionStatus: false,
    connectedLineIds: ["LINE-C"],
    lineMembership: ["LINE-C"],
    connectedSectionIds: ["DBR-ND-01"],
    gridPosition: { x: 32, y: 80 },
    coordinates: { x: 32, y: 80 },
  },

  MNR: {
    id: "MNR",
    name: "Modinagar",
    code: "MNR",
    kmPosition: 45,
    platforms: 4,
    platformDetails: [
      { platformNumber: 1, lengthMeters: 500, isOccupied: false, occupiedTrainId: null },
    ],
    isJunction: false,
    junctionStatus: false,
    connectedLineIds: ["LINE-C"],
    lineMembership: ["LINE-C"],
    connectedSectionIds: ["DBR-ND-01"],
    gridPosition: { x: 42, y: 80 },
    coordinates: { x: 42, y: 80 },
  },

  MRD: {
    id: "MRD",
    name: "Muradnagar",
    code: "MRD",
    kmPosition: 52,
    platforms: 4,
    platformDetails: [
      { platformNumber: 1, lengthMeters: 500, isOccupied: false, occupiedTrainId: null },
    ],
    isJunction: false,
    junctionStatus: false,
    connectedLineIds: ["LINE-C"],
    lineMembership: ["LINE-C"],
    connectedSectionIds: ["DBR-ND-01"],
    gridPosition: { x: 52, y: 80 },
    coordinates: { x: 52, y: 80 },
  },

  // Retain backward-compatible keys
  ANVT: {
    id: "ANVT",
    name: "Anand Vihar",
    code: "ANVT",
    kmPosition: 14,
    platforms: 7,
    platformDetails: [
      { platformNumber: 1, lengthMeters: 600, isOccupied: false, occupiedTrainId: null },
    ],
    isJunction: false,
    junctionStatus: false,
    connectedLineIds: ["LINE-C"],
    lineMembership: ["LINE-C"],
    connectedSectionIds: ["ND-ANVT-01", "ANVT-GZB-01"],
    gridPosition: { x: 22, y: 24 },
    coordinates: { x: 22, y: 24 },
  },

  AGC: {
    id: "AGC",
    name: "Agra Cantt",
    code: "AGC",
    kmPosition: 222,
    platforms: 6,
    platformDetails: [
      { platformNumber: 1, lengthMeters: 620, isOccupied: false, occupiedTrainId: null },
    ],
    isJunction: false,
    junctionStatus: false,
    connectedLineIds: ["LINE-B"],
    lineMembership: ["LINE-B"],
    connectedSectionIds: ["ALJN-AGC-01"],
    gridPosition: { x: 94, y: 78 },
    coordinates: { x: 94, y: 78 },
  },

  KNP: {
    id: "KNP",
    name: "Kanpur Central",
    code: "CNB",
    kmPosition: 419,
    platforms: 10,
    platformDetails: [
      { platformNumber: 1, lengthMeters: 700, isOccupied: false, occupiedTrainId: null },
    ],
    isJunction: false,
    junctionStatus: false,
    connectedLineIds: ["LINE-E"],
    lineMembership: ["LINE-E"],
    connectedSectionIds: ["ALJN-KNP-01"],
    gridPosition: { x: 68, y: 56 },
    coordinates: { x: 68, y: 56 },
  },
};

// ---------------------------------------------------------------------------
// 2. TRACK BLOCKS GENERATOR
// ---------------------------------------------------------------------------

function generateBlocks(sectionId: string, totalKm: number, blockLengthKm: number = 8): TrackBlock[] {
  const blocks: TrackBlock[] = [];
  const numBlocks = Math.max(1, Math.ceil(totalKm / blockLengthKm));
  let currentKm = 0;

  for (let i = 1; i <= numBlocks; i++) {
    const startKm = currentKm;
    const endKm = Math.min(totalKm, currentKm + blockLengthKm);
    const lengthKm = Number((endKm - startKm).toFixed(1));
    currentKm = endKm;

    blocks.push({
      id: `${sectionId}-BLK-${String(i).padStart(2, "0")}`,
      sectionId,
      blockIndex: i,
      startKm,
      endKm,
      lengthKm,
      status: "AVAILABLE",
      occupiedBy: null,
      signalId: `SIG-${sectionId}-${String(i).padStart(2, "0")}`,
    });
  }

  return blocks;
}

// ---------------------------------------------------------------------------
// 3. TRACK SECTIONS & BLOCK TOPOLOGY
// ---------------------------------------------------------------------------

export const multiLineSections: Record<string, SectionTopologyEdge> = {
  "ND-GZB-01": {
    id: "ND-GZB-01",
    lineId: "LINE-A",
    line: "LINE-A",
    name: "New Delhi – Ghaziabad Main",
    startStationId: "ND",
    fromStation: "ND",
    endStationId: "GZB",
    toStation: "GZB",
    lengthKm: 25,
    distance: 25,
    maximumSpeed: 130,
    tracks: 2,
    status: "AVAILABLE",
    occupancyState: "AVAILABLE",
    blockState: "CLEAR",
    signalState: "PROCEED_GREEN",
    interlockingZone: "IXL-ZONE 1",
    occupiedBy: null,
    blocks: generateBlocks("ND-GZB-01", 25, 8.3),
    signals: ["SIG-ND-01", "SIG-ND-02", "SIG-GZB-01"],
    startKm: 0,
    endKm: 25,
    direction: "BIDIRECTIONAL",
  },

  "GZB-MRT-01": {
    id: "GZB-MRT-01",
    lineId: "LINE-A",
    line: "LINE-A",
    name: "Ghaziabad – Meerut City",
    startStationId: "GZB",
    fromStation: "GZB",
    endStationId: "MRT",
    toStation: "MRT",
    lengthKm: 46,
    distance: 46,
    maximumSpeed: 120,
    tracks: 2,
    status: "AVAILABLE",
    occupancyState: "AVAILABLE",
    blockState: "CLEAR",
    signalState: "PROCEED_GREEN",
    interlockingZone: "IXL-ZONE 2",
    occupiedBy: null,
    blocks: generateBlocks("GZB-MRT-01", 46, 11.5),
    signals: ["SIG-GZB-02", "SIG-MRT-01"],
    startKm: 25,
    endKm: 71,
    direction: "BIDIRECTIONAL",
  },

  "MRT-SNP-01": {
    id: "MRT-SNP-01",
    lineId: "LINE-A",
    line: "LINE-A",
    name: "Meerut City – Saharanpur",
    startStationId: "MRT",
    fromStation: "MRT",
    endStationId: "SNP",
    toStation: "SNP",
    lengthKm: 115,
    distance: 115,
    maximumSpeed: 110,
    tracks: 2,
    status: "AVAILABLE",
    occupancyState: "AVAILABLE",
    blockState: "CLEAR",
    signalState: "PROCEED_GREEN",
    interlockingZone: "IXL-ZONE 3",
    occupiedBy: null,
    blocks: generateBlocks("MRT-SNP-01", 115, 14.3),
    signals: ["SIG-MRT-02", "SIG-SNP-01"],
    startKm: 71,
    endKm: 186,
    direction: "BIDIRECTIONAL",
  },

  "GZB-ALJN-01": {
    id: "GZB-ALJN-01",
    lineId: "LINE-B",
    line: "LINE-B",
    name: "Ghaziabad – Aligarh Junction",
    startStationId: "GZB",
    fromStation: "GZB",
    endStationId: "ALJN",
    toStation: "ALJN",
    lengthKm: 106,
    distance: 106,
    maximumSpeed: 130,
    tracks: 2,
    status: "AVAILABLE",
    occupancyState: "AVAILABLE",
    blockState: "CLEAR",
    signalState: "PROCEED_GREEN",
    interlockingZone: "IXL-ZONE 2",
    occupiedBy: null,
    blocks: generateBlocks("GZB-ALJN-01", 106, 15.0),
    signals: ["SIG-GZB-03", "SIG-ALJN-01"],
    startKm: 0,
    endKm: 106,
    direction: "BIDIRECTIONAL",
  },

  "ALJN-AGC-01": {
    id: "ALJN-AGC-01",
    lineId: "LINE-B",
    line: "LINE-B",
    name: "Aligarh – Agra Cantt / Tundla",
    startStationId: "ALJN",
    fromStation: "ALJN",
    endStationId: "AGC",
    toStation: "AGC",
    lengthKm: 83,
    distance: 83,
    maximumSpeed: 130,
    tracks: 2,
    status: "AVAILABLE",
    occupancyState: "AVAILABLE",
    blockState: "CLEAR",
    signalState: "PROCEED_GREEN",
    interlockingZone: "IXL-ZONE 4",
    occupiedBy: null,
    blocks: generateBlocks("ALJN-AGC-01", 83, 14.0),
    signals: ["SIG-ALJN-02", "SIG-AGC-01"],
    startKm: 106,
    endKm: 189,
    direction: "BIDIRECTIONAL",
  },

  "ND-ANVT-01": {
    id: "ND-ANVT-01",
    lineId: "LINE-C",
    line: "LINE-C",
    name: "New Delhi – Anand Vihar Radial",
    startStationId: "ND",
    fromStation: "ND",
    endStationId: "ANVT",
    toStation: "ANVT",
    lengthKm: 14,
    distance: 14,
    maximumSpeed: 100,
    tracks: 2,
    status: "AVAILABLE",
    occupancyState: "AVAILABLE",
    blockState: "CLEAR",
    signalState: "PROCEED_GREEN",
    interlockingZone: "IXL-ZONE 1",
    occupiedBy: null,
    blocks: generateBlocks("ND-ANVT-01", 14, 7.0),
    signals: ["SIG-ND-03", "SIG-ANVT-01"],
    startKm: 0,
    endKm: 14,
    direction: "BIDIRECTIONAL",
  },

  "ANVT-GZB-01": {
    id: "ANVT-GZB-01",
    lineId: "LINE-C",
    line: "LINE-C",
    name: "Anand Vihar – Ghaziabad Bypass",
    startStationId: "ANVT",
    fromStation: "ANVT",
    endStationId: "GZB",
    toStation: "GZB",
    lengthKm: 12,
    distance: 12,
    maximumSpeed: 100,
    tracks: 2,
    status: "AVAILABLE",
    occupancyState: "AVAILABLE",
    blockState: "CLEAR",
    signalState: "PROCEED_GREEN",
    interlockingZone: "IXL-ZONE 2",
    occupiedBy: null,
    blocks: generateBlocks("ANVT-GZB-01", 12, 6.0),
    signals: ["SIG-ANVT-02", "SIG-GZB-04"],
    startKm: 14,
    endKm: 26,
    direction: "BIDIRECTIONAL",
  },

  "ALJN-MRT-01": {
    id: "ALJN-MRT-01",
    lineId: "LINE-D",
    line: "LINE-D",
    name: "Aligarh – Meerut Cross-Link",
    startStationId: "ALJN",
    fromStation: "ALJN",
    endStationId: "MRT",
    toStation: "MRT",
    lengthKm: 98,
    distance: 98,
    maximumSpeed: 110,
    tracks: 2,
    status: "AVAILABLE",
    occupancyState: "AVAILABLE",
    blockState: "CLEAR",
    signalState: "PROCEED_GREEN",
    interlockingZone: "IXL-ZONE 4",
    occupiedBy: null,
    blocks: generateBlocks("ALJN-MRT-01", 98, 14.0),
    signals: ["SIG-ALJN-03", "SIG-MRT-03"],
    startKm: 0,
    endKm: 98,
    direction: "BIDIRECTIONAL",
  },

  "DBR-ND-01": {
    id: "DBR-ND-01",
    lineId: "LINE-E",
    line: "LINE-E",
    name: "Dadri / Dayabasti – New Delhi Radial",
    startStationId: "DBR",
    fromStation: "DBR",
    endStationId: "ND",
    toStation: "ND",
    lengthKm: 22,
    distance: 22,
    maximumSpeed: 110,
    tracks: 2,
    status: "AVAILABLE",
    occupancyState: "AVAILABLE",
    blockState: "CLEAR",
    signalState: "PROCEED_GREEN",
    interlockingZone: "IXL-ZONE 1",
    occupiedBy: null,
    blocks: generateBlocks("DBR-ND-01", 22, 7.3),
    signals: ["SIG-DBR-01", "SIG-ND-04"],
    startKm: 0,
    endKm: 22,
    direction: "BIDIRECTIONAL",
  },

  "ALJN-KNP-01": {
    id: "ALJN-KNP-01",
    lineId: "LINE-E",
    line: "LINE-E",
    name: "Aligarh – Kanpur Central / Lucknow Trunk",
    startStationId: "ALJN",
    fromStation: "ALJN",
    endStationId: "KNP",
    toStation: "KNP",
    lengthKm: 280,
    distance: 280,
    maximumSpeed: 130,
    tracks: 2,
    status: "AVAILABLE",
    occupancyState: "AVAILABLE",
    blockState: "CLEAR",
    signalState: "PROCEED_GREEN",
    interlockingZone: "IXL-ZONE 6",
    occupiedBy: null,
    blocks: generateBlocks("ALJN-KNP-01", 280, 20.0),
    signals: ["SIG-ALJN-04", "SIG-CNB-01"],
    startKm: 139,
    endKm: 419,
    direction: "BIDIRECTIONAL",
  },
};

// ---------------------------------------------------------------------------
// 4. INTERLOCKING JUNCTIONS
// ---------------------------------------------------------------------------

export const multiLineJunctions: Record<string, JunctionTopologyNode> = {
  "J-ND-01": {
    id: "J-ND-01",
    name: "New Delhi Interlocking Diamond",
    stationId: "ND",
    connectedLines: ["LINE-A", "LINE-C", "LINE-E"],
    connectedSections: ["ND-GZB-01", "DBR-ND-01", "ND-ANVT-01"],
    switchState: "ALIGNED",
    activeRoute: "LINE-A_THROUGH",
    visualPosition: { x: 7, y: 38 },
    availableRoutes: [
      { id: "R-ND-MAIN", fromSection: "DBR-ND-01", toSection: "ND-GZB-01", diverging: false, speedLimitKmH: 130, isAligned: true, conflictingRouteIds: ["R-ND-BYPASS"] },
      { id: "R-ND-BYPASS", fromSection: "ND-GZB-01", toSection: "ND-ANVT-01", diverging: true, speedLimitKmH: 90, isAligned: false, conflictingRouteIds: ["R-ND-MAIN"] },
    ],
    conflictRelationships: [
      { routeA: "R-ND-MAIN", routeB: "R-ND-BYPASS", conflictType: "CROSSING", description: "Mainline through route crosses Anand Vihar radial diverging route" },
    ],
  },

  "J-GZB-01": {
    id: "J-GZB-01",
    name: "Ghaziabad Central Junction Switch",
    stationId: "GZB",
    connectedLines: ["LINE-A", "LINE-B", "LINE-C", "LINE-E"],
    connectedSections: ["ND-GZB-01", "GZB-MRT-01", "GZB-ALJN-01", "ANVT-GZB-01"],
    switchState: "ALIGNED",
    activeRoute: "LINE-A_NORTH",
    visualPosition: { x: 28, y: 38 },
    availableRoutes: [
      { id: "R-GZB-MAIN", fromSection: "ND-GZB-01", toSection: "GZB-MRT-01", diverging: false, speedLimitKmH: 120, isAligned: true, conflictingRouteIds: ["R-GZB-BRANCH"] },
      { id: "R-GZB-BRANCH", fromSection: "ND-GZB-01", toSection: "GZB-ALJN-01", diverging: true, speedLimitKmH: 80, isAligned: false, conflictingRouteIds: ["R-GZB-MAIN"] },
    ],
    conflictRelationships: [
      { routeA: "R-GZB-MAIN", routeB: "R-GZB-BRANCH", conflictType: "CONVERGENCE", description: "Main northern corridor diverges into eastern trunk line B" },
    ],
  },

  "J-MRT-01": {
    id: "J-MRT-01",
    name: "Meerut City Cross-Link Junction",
    stationId: "MRT",
    connectedLines: ["LINE-A", "LINE-D"],
    connectedSections: ["GZB-MRT-01", "MRT-SNP-01", "ALJN-MRT-01"],
    switchState: "ALIGNED",
    activeRoute: "LINE-A_SNP",
    visualPosition: { x: 44, y: 30 },
    availableRoutes: [
      { id: "R-MRT-NORTH", fromSection: "GZB-MRT-01", toSection: "MRT-SNP-01", diverging: false, speedLimitKmH: 110, isAligned: true, conflictingRouteIds: ["R-MRT-CROSS"] },
      { id: "R-MRT-CROSS", fromSection: "ALJN-MRT-01", toSection: "MRT-SNP-01", diverging: true, speedLimitKmH: 75, isAligned: false, conflictingRouteIds: ["R-MRT-NORTH"] },
    ],
    conflictRelationships: [
      { routeA: "R-MRT-NORTH", routeB: "R-MRT-CROSS", conflictType: "CONVERGENCE", description: "Line D cross-corridor merges into mainline northern route to Saharanpur" },
    ],
  },

  "J-ALJN-01": {
    id: "J-ALJN-01",
    name: "Aligarh Southeast Hub Junction",
    stationId: "ALJN",
    connectedLines: ["LINE-B", "LINE-D", "LINE-E"],
    connectedSections: ["GZB-ALJN-01", "ALJN-AGC-01", "ALJN-MRT-01", "ALJN-KNP-01"],
    switchState: "ALIGNED",
    activeRoute: "LINE-E_EAST",
    visualPosition: { x: 28, y: 56 },
    availableRoutes: [
      { id: "R-ALJN-EAST", fromSection: "GZB-ALJN-01", toSection: "ALJN-KNP-01", diverging: false, speedLimitKmH: 130, isAligned: true, conflictingRouteIds: ["R-ALJN-SOUTH", "R-ALJN-CROSS"] },
      { id: "R-ALJN-SOUTH", fromSection: "GZB-ALJN-01", toSection: "ALJN-AGC-01", diverging: true, speedLimitKmH: 90, isAligned: false, conflictingRouteIds: ["R-ALJN-EAST"] },
      { id: "R-ALJN-CROSS", fromSection: "GZB-ALJN-01", toSection: "ALJN-MRT-01", diverging: true, speedLimitKmH: 80, isAligned: false, conflictingRouteIds: ["R-ALJN-EAST"] },
    ],
    conflictRelationships: [
      { routeA: "R-ALJN-EAST", routeB: "R-ALJN-SOUTH", conflictType: "CONVERGENCE", description: "Eastern mega trunk diverges to Agra Cantt" },
    ],
  },

  "J-SNP-01": {
    id: "J-SNP-01",
    name: "Saharanpur Northern Terminus Yard",
    stationId: "SNP",
    connectedLines: ["LINE-A", "LINE-D"],
    connectedSections: ["MRT-SNP-01"],
    switchState: "ALIGNED",
    activeRoute: "LINE-A_TERMINUS",
    visualPosition: { x: 95, y: 30 },
    availableRoutes: [
      { id: "R-SNP-PLATFORM", fromSection: "MRT-SNP-01", toSection: "MRT-SNP-01", diverging: false, speedLimitKmH: 60, isAligned: true, conflictingRouteIds: [] },
    ],
    conflictRelationships: [],
  },

  "J-CNB-01": {
    id: "J-CNB-01",
    name: "Kanpur Central Eastern Terminus",
    stationId: "CNB",
    connectedLines: ["LINE-B", "LINE-E"],
    connectedSections: ["ALJN-KNP-01"],
    switchState: "ALIGNED",
    activeRoute: "LINE-E_TERMINUS",
    visualPosition: { x: 68, y: 56 },
    availableRoutes: [
      { id: "R-CNB-MAIN", fromSection: "ALJN-KNP-01", toSection: "ALJN-KNP-01", diverging: false, speedLimitKmH: 70, isAligned: true, conflictingRouteIds: [] },
    ],
    conflictRelationships: [],
  },
};

// ---------------------------------------------------------------------------
// 5. RAILWAY LINES SPECIFICATION
// ---------------------------------------------------------------------------

export const multiLineDefinitions: RailwayLineDefinition[] = [
  {
    id: "LINE-A",
    name: "Line A (NDLS-SRE)",
    shortName: "Line A (NDLS-SRE)",
    code: "A",
    color: "#f59e0b", // Amber / Orange
    startStationId: "ND",
    endStationId: "SNP",
    stationIds: ["ND", "NZM", "GZB", "MRT", "MB", "BE", "SNP"],
    sectionIds: ["ND-GZB-01", "GZB-MRT-01", "MRT-SNP-01"],
    totalLengthKm: 186,
    junctionStationIds: ["ND", "GZB", "MRT", "MB", "SNP"],
  },
  {
    id: "LINE-B",
    name: "Line B (GZB-AGC)",
    shortName: "Line B (GZB-AGC)",
    code: "B",
    color: "#0284c7", // Cyan / Blue
    startStationId: "GZB",
    endStationId: "LKO",
    stationIds: ["GZB", "ALJN", "TDL", "CNB", "LKO"],
    sectionIds: ["GZB-ALJN-01", "ALJN-AGC-01", "ALJN-KNP-01"],
    totalLengthKm: 189,
    junctionStationIds: ["GZB", "ALJN", "TDL", "CNB"],
  },
  {
    id: "LINE-C",
    name: "Line C (NCR Radial)",
    shortName: "Line C (NCR Radial)",
    code: "C",
    color: "#10b981", // Green
    startStationId: "DBR",
    endStationId: "GZB",
    stationIds: ["DBR", "PKA", "HPU", "MNR", "MRD", "GZB", "ANVT"],
    sectionIds: ["DBR-ND-01", "ND-ANVT-01", "ANVT-GZB-01"],
    totalLengthKm: 52,
    junctionStationIds: ["DBR", "GZB"],
  },
  {
    id: "LINE-D",
    name: "Line D (ALJN-SNP)",
    shortName: "Line D (ALJN-SNP)",
    code: "D",
    color: "#8b5cf6", // Purple / Violet
    startStationId: "ALJN",
    endStationId: "SNP",
    stationIds: ["ALJN", "MRT", "MB", "SNP"],
    sectionIds: ["ALJN-MRT-01", "MRT-SNP-01"],
    totalLengthKm: 213,
    junctionStationIds: ["ALJN", "MRT", "MB", "SNP"],
  },
  {
    id: "LINE-E",
    name: "Line E (DBR-KNP)",
    shortName: "Line E (DBR-KNP)",
    code: "E",
    color: "#ec4899", // Magenta / Pink
    startStationId: "DBR",
    endStationId: "LKO",
    stationIds: ["DBR", "ND", "GZB", "ALJN", "CNB", "LKO"],
    sectionIds: ["DBR-ND-01", "ND-GZB-01", "GZB-ALJN-01", "ALJN-KNP-01"],
    totalLengthKm: 419,
    junctionStationIds: ["DBR", "ND", "GZB", "ALJN", "CNB"],
  },
];

// ---------------------------------------------------------------------------
// 6. DETAILED SWITCHES & TURNOUTS
// ---------------------------------------------------------------------------

export const multiLineSwitches: Record<string, SwitchTopologyNode> = {
  "SW-GZB-01": { id: "SW-GZB-01", name: "GZB North Switch", stationId: "GZB", fromTrack: "T1", toTrack: "T3", switchPosition: "NORMAL", state: "NORMAL", coordinates: { x: 280, y: 100 } },
  "SW-GZB-02": { id: "SW-GZB-02", name: "GZB Branch Divergence", stationId: "GZB", fromTrack: "T1", toTrack: "LINE-B", switchPosition: "NORMAL", state: "NORMAL", coordinates: { x: 320, y: 85 } },
  "SW-GZB-03": { id: "SW-GZB-03", name: "GZB Loop Switch", stationId: "GZB", fromTrack: "T3", toTrack: "T4", switchPosition: "NORMAL", state: "NORMAL", coordinates: { x: 320, y: 115 } },
  "SW-MRT-01": { id: "SW-MRT-01", name: "MRT Cross-Over South", stationId: "MRT", fromTrack: "T1", toTrack: "T2", switchPosition: "NORMAL", state: "NORMAL", coordinates: { x: 440, y: 85 } },
  "SW-MRT-02": { id: "SW-MRT-02", name: "MRT Mid Crossover", stationId: "MRT", fromTrack: "T2", toTrack: "T3", switchPosition: "NORMAL", state: "NORMAL", coordinates: { x: 500, y: 100 } },
  "SW-MB-01":  { id: "SW-MB-01",  name: "MB Yard Entrance", stationId: "MB", fromTrack: "T1", toTrack: "T3", switchPosition: "NORMAL", state: "NORMAL", coordinates: { x: 650, y: 85 } },
  "SW-MB-02":  { id: "SW-MB-02",  name: "MB Yard Exit", stationId: "MB", fromTrack: "T3", toTrack: "T1", switchPosition: "NORMAL", state: "NORMAL", coordinates: { x: 710, y: 100 } },
  "SW-BE-01":  { id: "SW-BE-01",  name: "BE Loop Diverge", stationId: "BE", fromTrack: "T1", toTrack: "T2", switchPosition: "NORMAL", state: "NORMAL", coordinates: { x: 820, y: 85 } },
  "SW-BE-02":  { id: "SW-BE-02",  name: "BE Loop Merge", stationId: "BE", fromTrack: "T2", toTrack: "T1", switchPosition: "NORMAL", state: "NORMAL", coordinates: { x: 880, y: 100 } },
  "SW-ALJN-01": { id: "SW-ALJN-01", name: "ALJN Main Switch", stationId: "ALJN", fromTrack: "LINE-B", toTrack: "LINE-D", switchPosition: "NORMAL", state: "NORMAL", coordinates: { x: 280, y: 200 } },
  "SW-ALJN-02": { id: "SW-ALJN-02", name: "ALJN South Switch", stationId: "ALJN", fromTrack: "LINE-B", toTrack: "LINE-E", switchPosition: "NORMAL", state: "NORMAL", coordinates: { x: 350, y: 200 } },
  "SW-TDL-01":  { id: "SW-TDL-01",  name: "TDL Cross-Over", stationId: "TDL", fromTrack: "LINE-B", toTrack: "LINE-A", switchPosition: "NORMAL", state: "NORMAL", coordinates: { x: 530, y: 200 } },
  "SW-CNB-01":  { id: "SW-CNB-01",  name: "CNB Yard Throat", stationId: "CNB", fromTrack: "LINE-B", toTrack: "LINE-E", switchPosition: "NORMAL", state: "NORMAL", coordinates: { x: 740, y: 200 } },
  "SW-MRD-01":  { id: "SW-MRD-01",  name: "MRD Radial Loop", stationId: "MRD", fromTrack: "LINE-C", toTrack: "LINE-B", switchPosition: "NORMAL", state: "NORMAL", coordinates: { x: 550, y: 285 } },
};

// ---------------------------------------------------------------------------
// 7. INTERLOCKING ZONES
// ---------------------------------------------------------------------------

export const multiLineInterlockingZones: Record<string, InterlockingZoneNode> = {
  "GZB-IXL": { id: "GZB-IXL", name: "Ghaziabad Interlocking Zone", stationId: "GZB", silLevel: "SIL-4", status: "NOMINAL", bounds: { x: 230, y: 55, width: 130, height: 170 }, activeSwitches: ["SW-GZB-01", "SW-GZB-02", "SW-GZB-03"], activeRoutes: ["R-GZB-MAIN", "R-GZB-BRANCH"] },
  "MRT-IXL": { id: "MRT-IXL", name: "Meerut City Interlocking Zone", stationId: "MRT", silLevel: "SIL-4", status: "NOMINAL", bounds: { x: 400, y: 55, width: 110, height: 85 }, activeSwitches: ["SW-MRT-01", "SW-MRT-02"], activeRoutes: ["R-MRT-NORTH", "R-MRT-CROSS"] },
  "ALJN-IXL": { id: "ALJN-IXL", name: "Aligarh Junction Interlocking Zone", stationId: "ALJN", silLevel: "SIL-4", status: "NOMINAL", bounds: { x: 250, y: 170, width: 130, height: 60 }, activeSwitches: ["SW-ALJN-01", "SW-ALJN-02"], activeRoutes: ["R-ALJN-EAST", "R-ALJN-SOUTH"] },
  "CNB-IXL": { id: "CNB-IXL", name: "Kanpur Central Interlocking Zone", stationId: "CNB", silLevel: "SIL-4", status: "NOMINAL", bounds: { x: 700, y: 165, width: 120, height: 75 }, activeSwitches: ["SW-CNB-01"], activeRoutes: ["R-CNB-MAIN"] },
  "SNP-IXL": { id: "SNP-IXL", name: "Saharanpur Terminus Interlocking Zone", stationId: "SNP", silLevel: "SIL-4", status: "NOMINAL", bounds: { x: 1080, y: 55, width: 90, height: 85 }, activeSwitches: [], activeRoutes: ["R-SNP-PLATFORM"] },
};

// ---------------------------------------------------------------------------
// 8. MASTER MULTI-LINE NETWORK GRAPH INSTANCE
// ---------------------------------------------------------------------------

export const multiLineNetworkGraph: MultiLineRailwayNetwork = {
  networkId: "NCR-NORTHERN-NETWORK-01",
  networkName: "Northern Railway Interconnected Command Network",
  lines: multiLineDefinitions,
  stations: multiLineStations,
  sections: multiLineSections,
  junctions: multiLineJunctions,
  switches: multiLineSwitches,
  interlockingZones: multiLineInterlockingZones,
  signals: {},
  allStationIds: Object.keys(multiLineStations),
  allSectionIds: Object.keys(multiLineSections),
  allJunctionIds: Object.keys(multiLineJunctions),
};

// ---------------------------------------------------------------------------
// 7. SCHEMATIC COORDINATE PROJECTION HELPERS
// ---------------------------------------------------------------------------

export interface Schematic2DPoint {
  x: number; // 0 to 100%
  y: number; // 0 to 100%
  lineId: string;
  cumulativeKm: number;
  isJunction: boolean;
}

/**
 * Resolves 2D schematic coordinates for any train anywhere across the network.
 * Consumes authoritative train section and position (0-100%) from SimulationEngine.
 */
export function getTrainSchematic2DPosition(train: Train): Schematic2DPoint {
  const section = multiLineSections[train.currentSection];

  if (!section) {
    return { x: 10, y: 38, lineId: "LINE-A", cumulativeKm: 0, isJunction: false };
  }

  const startStation = multiLineStations[section.startStationId];
  const endStation = multiLineStations[section.endStationId];

  if (!startStation || !endStation) {
    return { x: 10, y: 38, lineId: section.lineId, cumulativeKm: 0, isJunction: false };
  }

  const positionFraction = Math.max(0, Math.min((Number(train.position) || 0) / 100, 1));

  // Linear interpolation between stations in 2D layout grid
  const x = Number((startStation.gridPosition.x + (endStation.gridPosition.x - startStation.gridPosition.x) * positionFraction).toFixed(2));
  const y = Number((startStation.gridPosition.y + (endStation.gridPosition.y - startStation.gridPosition.y) * positionFraction).toFixed(2));
  const cumulativeKm = Number((section.startKm + positionFraction * section.lengthKm).toFixed(1));

  const isNearJunction = positionFraction > 0.85 && endStation.isJunction;

  return {
    x,
    y,
    lineId: section.lineId,
    cumulativeKm,
    isJunction: isNearJunction,
  };
}

/**
 * Checks whether a train is currently approaching an interconnected junction.
 */
export function getTrainJunctionApproach(train: Train): {
  isApproaching: boolean;
  junctionId?: string;
  junctionName?: string;
  distanceToJunctionKm?: number;
} {
  const section = multiLineSections[train.currentSection];
  if (!section) return { isApproaching: false };

  const endStation = multiLineStations[section.endStationId];
  if (!endStation?.isJunction) return { isApproaching: false };

  const remainingFraction = 1 - Math.max(0, Math.min((Number(train.position) || 0) / 100, 1));
  const distanceKm = Number((remainingFraction * section.lengthKm).toFixed(2));

  if (distanceKm <= 15) {
    return {
      isApproaching: true,
      junctionId: endStation.junctionId,
      junctionName: endStation.name,
      distanceToJunctionKm: distanceKm,
    };
  }

  return { isApproaching: false };
}
