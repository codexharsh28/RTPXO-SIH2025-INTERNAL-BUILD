import { stations } from "./stations";
import { sections } from "./sections";
import { NetworkTopology, SectionRange, StationMilestone, SectionTopologyEdge } from "@/types/topology";
import { Train } from "@/types/railway";
import { multiLineSections } from "./multiLineTopology";

/**
 * Builds the canonical corridor topology dynamically from station and section definitions.
 * This guarantees that station positions, section lengths, and train coordinates
 * are derived from real topology data rather than hardcoded visual percentages.
 */
export function buildCorridorTopology(): NetworkTopology {
  // Compute ordered section progression starting from origin (ND)
  let currentKm = 0;
  const computedSections: SectionRange[] = [];
  const sectionMap: Record<string, SectionRange> = {};

  for (const sec of sections) {
    const startKm = currentKm;
    const endKm = currentKm + sec.lengthKm;
    currentKm = endKm;

    const range: SectionRange = {
      id: sec.id,
      name: sec.name,
      startStationId: sec.startStation,
      endStationId: sec.endStation,
      startKm,
      endKm,
      lengthKm: sec.lengthKm,
      startPercent: 0, // Computed after total length is known
      endPercent: 0,   // Computed after total length is known
      maximumSpeed: sec.maximumSpeed,
    };

    computedSections.push(range);
    sectionMap[sec.id] = range;
  }

  const totalLengthKm = currentKm > 0 ? currentKm : 1;

  // Calculate normalized percentages (0 to 100%) for each section
  for (const range of computedSections) {
    range.startPercent = Number(((range.startKm / totalLengthKm) * 100).toFixed(2));
    range.endPercent = Number(((range.endKm / totalLengthKm) * 100).toFixed(2));
  }

  // Calculate station milestones along the corridor
  const computedStations: StationMilestone[] = [];
  const stationMap: Record<string, StationMilestone> = {};

  for (const st of stations) {
    // Find matching section start or end to determine cumulativeKm
    let stationKm = 0;
    const outboundSection = computedSections.find((s) => s.startStationId === st.id);
    const inboundSection = computedSections.find((s) => s.endStationId === st.id);

    if (outboundSection) {
      stationKm = outboundSection.startKm;
    } else if (inboundSection) {
      stationKm = inboundSection.endKm;
    }

    const corridorPercent = Number(((stationKm / totalLengthKm) * 100).toFixed(2));

    const milestone: StationMilestone = {
      id: st.id,
      name: st.name,
      platforms: st.platforms,
      cumulativeKm: stationKm,
      corridorPercent,
      connectedSections: st.connectedSections,
    };

    computedStations.push(milestone);
    stationMap[st.id] = milestone;
  }

  return {
    corridorId: "NDLS-SRE-CORRIDOR-01",
    corridorName: "Northern Railway - Delhi to Saharanpur Main Line",
    totalLengthKm,
    stations: computedStations,
    sections: computedSections,
    sectionMap,
    stationMap,
  };
}

/**
 * Singleton precomputed topology for fast lookups.
 */
export const corridorTopology: NetworkTopology = buildCorridorTopology();

/**
 * Converts a section-relative position (0-100%) to its exact
 * corridor-wide position (in cumulative km and 0-100% corridor percentage).
 */
export function getSectionPositionCoordinates(
  sectionId: string,
  positionPercent: number
): {
  cumulativeKm: number;
  corridorPercent: number;
} {
  const sectionRange = corridorTopology.sectionMap[sectionId];
  const multiEdge = multiLineSections[sectionId];

  if (!sectionRange && !multiEdge) {
    return { cumulativeKm: 0, corridorPercent: 0 };
  }

  const boundedPosition = Math.max(0, Math.min(Number(positionPercent) || 0, 100));
  const startKm = sectionRange?.startKm ?? multiEdge?.startKm ?? 0;
  const lengthKm = sectionRange?.lengthKm ?? multiEdge?.lengthKm ?? 25;
  const distanceInsideSectionKm = (boundedPosition / 100) * lengthKm;
  const cumulativeKm = startKm + distanceInsideSectionKm;
  const totalLengthKm = corridorTopology.totalLengthKm || 175;
  const corridorPercent = Number(
    ((cumulativeKm / totalLengthKm) * 100).toFixed(2)
  );

  return {
    cumulativeKm: Number(cumulativeKm.toFixed(1)),
    corridorPercent: Math.max(0, Math.min(corridorPercent, 100)),
  };
}

/**
 * Converts a train's section-relative position (0-100%) to its exact
 * corridor-wide position (in cumulative km and 0-100% corridor percentage).
 */
export function getTrainCorridorCoordinates(train: Train): {
  cumulativeKm: number;
  corridorPercent: number;
} {
  return getSectionPositionCoordinates(train.currentSection, train.position);
}

/**
 * Dynamically resolves the next section on the railway route.
 */
export function resolveNextSection(currentSectionId: string): string | null {
  const currentCorridor = corridorTopology.sectionMap[currentSectionId];
  const currentMulti = multiLineSections[currentSectionId];

  const toStation =
    currentCorridor?.endStationId ||
    currentMulti?.endStationId ||
    currentMulti?.toStation;

  if (!toStation) return null;

  // 1. Look in main corridor
  const nextCorridor = corridorTopology.sections.find(
    (sec) => sec.startStationId === toStation
  );
  if (nextCorridor) return nextCorridor.id;

  // 2. Look in multi-line network topology
  const multiValues: SectionTopologyEdge[] = Object.values(multiLineSections);
  const nextMulti = multiValues.find(
    (sec) =>
      (sec.startStationId === toStation || sec.fromStation === toStation) &&
      sec.id !== currentSectionId
  );

  return nextMulti ? nextMulti.id : null;
}

import { TrackBlock } from "@/types/topology";
import { TrainConflict, TrainStatus } from "@/types/railway";
import { ActiveIncident } from "@/types/incident";
import { getTrainJunctionApproach } from "./multiLineTopology";

/**
 * Precomputed canonical list of all blocks in the railway network.
 */
export function getAllNetworkBlocks(): TrackBlock[] {
  const blocks: TrackBlock[] = [];
  for (const [secId, edge] of Object.entries(multiLineSections)) {
    if (edge.blocks && edge.blocks.length > 0) {
      for (const blk of edge.blocks) {
        blocks.push({
          ...blk,
          sectionId: secId,
        });
      }
    }
  }
  return blocks;
}

export const canonicalNetworkBlocks: TrackBlock[] = getAllNetworkBlocks();

/**
 * Calculates the exact current block for a train given its currentSection and position percentage (0-100%).
 */
export function calculateCurrentBlock(
  sectionId: string,
  positionPercent: number
): { blockId: string; blockIndex: number; block: TrackBlock } {
  const edge = multiLineSections[sectionId] || (corridorTopology.sectionMap[sectionId] as any);
  const blocks: TrackBlock[] = edge?.blocks || [];

  if (blocks.length === 0) {
    const fallbackId = `${sectionId}-BLK-01`;
    return {
      blockId: fallbackId,
      blockIndex: 1,
      block: {
        id: fallbackId,
        sectionId,
        blockIndex: 1,
        startKm: 0,
        endKm: edge?.lengthKm || 25,
        lengthKm: edge?.lengthKm || 25,
        status: "AVAILABLE",
        occupiedBy: null,
      },
    };
  }

  const boundedPos = Math.max(0, Math.min(Number(positionPercent) || 0, 99.99));
  const blockIndex = Math.min(blocks.length - 1, Math.floor((boundedPos / 100) * blocks.length));
  const selectedBlock = blocks[blockIndex];

  return {
    blockId: selectedBlock.id,
    blockIndex: selectedBlock.blockIndex,
    block: selectedBlock,
  };
}

/**
 * Single authoritative train status derivation function across the entire application.
 * Guarantees that Map, Fleet, Table, Drawer, and Advisor display 100% identical status.
 */
export function calculateTrainStatus(
  train: Train,
  allTrains: Train[] = [],
  conflicts: TrainConflict[] = [],
  activeIncidents: ActiveIncident[] = []
): TrainStatus {
  if (train.completed || train.status === "COMPLETED") {
    return "COMPLETED";
  }

  // 1. Check for Active Severe Conflict (Must be directly in an active conflict pair)
  const hasActiveConflict = conflicts.some(
    (c) =>
      (c.trainA === train.id || c.trainB === train.id) &&
      (c.severity === "CRITICAL" || c.severity === "HIGH")
  );
  if (hasActiveConflict || (train.status === "CRITICAL" && conflicts.length > 0)) {
    return "CONFLICT";
  }

  // 2. Check for Holding State (Speed 0 commanded/held)
  if (train.speed === 0 && (train.status === "HELD" || train.status === "HOLDING")) {
    return "HELD";
  }

  // 3. Check for Stopped State (Physical Speed 0)
  if (train.speed === 0) {
    return "STOPPED";
  }

  // 4. Check for Approaching Junction
  const approach = getTrainJunctionApproach(train);
  if (approach.isApproaching) {
    return "APPROACHING_JUNCTION";
  }

  // 5. Check for Delay
  if (train.delayMinutes > 0 || (train.delay && train.delay > 0) || train.status === "DELAYED") {
    return "DELAYED";
  }

  // 6. Nominal On-Time
  return "ON_TIME";
}

// Re-export extended Multi-Line Interconnected Network Topology (Step 2)
export * from "./multiLineTopology";

