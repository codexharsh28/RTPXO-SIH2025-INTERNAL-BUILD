/**
 * RTPXO - Junction Optimizer (Phase 6 Junction Sequencing)
 * Evaluates junction convergence permutations, calculates ETAs, switch clearance delays,
 * and priority satisfaction to select optimal train sequencing at convergence points.
 */

import { Train, Junction, RailwaySection } from "@/types/railway";
import { CandidateAction } from "@/types/optimization";
import { corridorTopology } from "@/data/topology";

export interface JunctionSequenceOption {
  sequence: string[]; // Ordered list of train IDs
  junctionId: string;
  junctionName: string;
  leadTrainId: string;
  trailTrainId: string;
  leadEtaSeconds: number;
  trailEtaSeconds: number;
  clearanceMarginSeconds: number;
  totalDelayPenaltyMinutes: number;
  priorityScore: number;
  candidateAction: CandidateAction;
}

export class JunctionOptimizer {
  /**
   * Evaluates junction convergence and recommends optimal traversal sequencing.
   */
  public evaluateJunctionSequences(
    trains: Train[],
    sections: RailwaySection[],
    junctions: Junction[]
  ): JunctionSequenceOption[] {
    const options: JunctionSequenceOption[] = [];
    const activeTrains = trains.filter((t) => !t.completed && t.status !== "COMPLETED");

    for (const junction of junctions) {
      const approachingTrains: { train: Train; etaSeconds: number; distKm: number }[] = [];

      for (const train of activeTrains) {
        if (!junction.connectedSections.includes(train.currentSection)) continue;

        const secDef = sections.find((s) => s.id === train.currentSection);
        const sectionRange = corridorTopology.sectionMap[train.currentSection];
        const lengthKm = sectionRange ? sectionRange.lengthKm : 25;

        const distToJunc =
          secDef?.endStation === junction.stationId
            ? ((100 - train.position) / 100) * lengthKm
            : (train.position / 100) * lengthKm;

        const speed = Math.max(train.speed, 10);
        const etaSeconds = Math.round((distToJunc / speed) * 3600);

        if (etaSeconds <= 300) {
          approachingTrains.push({ train, etaSeconds, distKm: distToJunc });
        }
      }

      if (approachingTrains.length >= 2) {
        const tA = approachingTrains[0];
        const tB = approachingTrains[1];

        // Evaluate Option 1: Train A first, Train B yields
        const option1PriorityScore = tA.train.priority * 15 - tB.train.priority * 5;
        const option1WaitingDelay = 1.2; // minutes

        // Evaluate Option 2: Train B first, Train A yields
        const option2PriorityScore = tB.train.priority * 15 - tA.train.priority * 5;
        const option2WaitingDelay = 1.2; // minutes

        const preferA = option1PriorityScore >= option2PriorityScore || tA.etaSeconds < tB.etaSeconds - 30;

        const lead = preferA ? tA : tB;
        const trail = preferA ? tB : tA;

        const candidateAction: CandidateAction = {
          id: `CAND-JUNC-${junction.id}-${trail.train.id}-HOLD`,
          affectedTrainId: trail.train.id,
          action: "HOLD_TRAIN",
          holdDurationSeconds: 45,
          affectedSectionId: trail.train.currentSection,
          junctionSequence: [lead.train.id, trail.train.id],
          description: `Sequence ${lead.train.name} (Priority ${lead.train.priority}, ETA ${lead.etaSeconds}s) before ${trail.train.name} (Priority ${trail.train.priority}, ETA ${trail.etaSeconds}s) at ${junction.name}`,
        };

        options.push({
          sequence: [lead.train.id, trail.train.id],
          junctionId: junction.id,
          junctionName: junction.name,
          leadTrainId: lead.train.id,
          trailTrainId: trail.train.id,
          leadEtaSeconds: lead.etaSeconds,
          trailEtaSeconds: trail.etaSeconds,
          clearanceMarginSeconds: Math.abs(lead.etaSeconds - trail.etaSeconds),
          totalDelayPenaltyMinutes: 1.2,
          priorityScore: Math.max(option1PriorityScore, option2PriorityScore),
          candidateAction,
        });
      }
    }

    return options;
  }
}

export const junctionOptimizer = new JunctionOptimizer();
