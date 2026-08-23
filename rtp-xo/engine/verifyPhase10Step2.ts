/**
 * RTPXO - Phase 10 Step 2 Verification Suite
 * Verifies Disruption-Aware Predictive & Optimization Engine behaviors.
 */

import { Train, RailwaySection, Signal, Junction } from "@/types/railway";
import { ActiveIncident } from "@/types/incident";
import { trains as initialTrains } from "@/data/trains";
import { sections as defaultSections } from "@/data/sections";
import { signals as defaultSignals } from "@/data/signals";
import { junctions as defaultJunctions } from "@/data/junctions";
import { predictionEngine } from "./predictionEngine";
import { optimizationEngine } from "./optimizationEngine";
import { adaptiveDecisionEngine } from "./adaptiveDecisionEngine";
import { strategySynthesisEngine } from "./strategySynthesisEngine";

let passCount = 0;
let failCount = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  [PASS] ${testName}`);
    passCount++;
  } else {
    console.error(`  [FAIL] ${testName}${detail ? ` - ${detail}` : ""}`);
    failCount++;
  }
}

export function runPhase10Step2Tests(): boolean {
  console.log("\n=======================================================");
  console.log("  RTPXO PHASE 10 STEP 2: DISRUPTION-AWARE OPTIMIZATION");
  console.log("=======================================================\n");

  // ----------------------------------------------------
  // TEST 1: PredictionEngine Forward Lookahead TSR Speed Clamping
  // ----------------------------------------------------
  console.log("Test 1: Forward Prediction TSR Speed Clamping");
  const testTsrIncident: ActiveIncident = {
    id: "INC-TSR-01",
    type: "TEMPORARY_SPEED_RESTRICTION",
    severity: "SEVERE",
    status: "ACTIVE_MITIGATING",
    affectedSectionId: "ND-GZB-01",
    imposedSpeedLimitKmH: 45,
    isCompleteBlockage: false,
    reason: "Track maintenance TSR 45 km/h",
    startTimeSimulationSeconds: 10,
  };

  const tsrPrediction = predictionEngine.simulateForward(
    initialTrains,
    defaultSections,
    defaultSignals,
    defaultJunctions,
    300,
    [],
    [testTsrIncident]
  );

  const t001Predicted = tsrPrediction.predictedState.trains.find((t) => t.trainId === "T001");
  assert(
    t001Predicted !== undefined && t001Predicted.speedKmH <= 45,
    "Forward prediction clamps train speed in TSR section to imposed limit (<= 45 km/h)"
  );

  // ----------------------------------------------------
  // TEST 2: PredictionEngine Forward Lookahead Blockage Barrier
  // ----------------------------------------------------
  console.log("\nTest 2: Forward Prediction Blockage Boundary Barrier");
  const testBlockageIncident: ActiveIncident = {
    id: "INC-BLOCK-01",
    type: "TRACK_SECTION_BLOCKAGE",
    severity: "CRITICAL",
    status: "ACTIVE_MITIGATING",
    affectedSectionId: "GZB-MRT-01",
    isCompleteBlockage: true,
    reason: "Obstruction on track",
    startTimeSimulationSeconds: 10,
  };

  const blockPrediction = predictionEngine.simulateForward(
    initialTrains,
    defaultSections,
    defaultSignals,
    defaultJunctions,
    600,
    [],
    [testBlockageIncident]
  );

  const t001AtBarrier = blockPrediction.predictedState.trains.find((t) => t.trainId === "T001");
  assert(
    t001AtBarrier !== undefined && t001AtBarrier.currentSection !== "GZB-MRT-01",
    "Train approaching blocked section is safely held at upstream block boundary"
  );

  // ----------------------------------------------------
  // TEST 3: Timeline Checkpoint Signal Degradation
  // ----------------------------------------------------
  console.log("\nTest 3: Timeline Checkpoint Signal Degradation");
  const testSignalIncident: ActiveIncident = {
    id: "INC-SIG-01",
    type: "SIGNAL_ASPECT_FAILURE",
    severity: "CRITICAL",
    status: "ACTIVE_MITIGATING",
    affectedSignalId: "SIG-ND-01",
    affectedSectionId: "ND-GZB-01",
    isCompleteBlockage: false,
    reason: "Aspect failure degraded to RED",
    startTimeSimulationSeconds: 10,
  };

  const sigPrediction = predictionEngine.simulateForward(
    initialTrains,
    defaultSections,
    defaultSignals,
    defaultJunctions,
    300,
    [],
    [testSignalIncident]
  );

  const sigCheckpoint = sigPrediction.predictedState.timeline?.[0];
  const degradedSig = sigCheckpoint?.signals.find((s) => s.signalId === "SIG-ND-01");
  assert(
    degradedSig !== undefined && degradedSig.aspect === "RED",
    "Failed signal is projected to degrade deterministically to RED in timeline checkpoints"
  );

  // ----------------------------------------------------
  // TEST 4: OptimizationEngine Incident Mitigation Candidate Generation
  // ----------------------------------------------------
  console.log("\nTest 4: OptimizationEngine Incident Mitigation Candidate Generation");
  const optResult = optimizationEngine.optimizeNetwork(
    initialTrains,
    defaultSections,
    defaultSignals,
    defaultJunctions,
    [],
    [],
    {
      trainsCompleted: 0,
      trainsPerHour: 4.2,
      corridorThroughput: 85,
      baselineThroughput: 75,
      throughputImprovement: 13.3,
      averageDelay: 3.5,
      maximumDelay: 7,
      averageTravelTime: 45,
      corridorUtilization: 60,
      bottleneckSection: null,
      totalDistanceTraveledKm: 120,
      conflictFreeTimeSeconds: 300,
      recommendationsTotalCount: 5,
      recommendationsAcceptedCount: 4,
      recommendationAcceptanceRate: 80,
      estimatedDelaySavedMinutes: 12,
      completedRecords: [],
    },
    [],
    100,
    300,
    adaptiveDecisionEngine,
    1,
    [testTsrIncident]
  );

  const tsrRec = optResult.recommendations.find(
    (r) => r.affectedSectionId === "ND-GZB-01" && r.targetSpeed === 45
  );
  assert(
    tsrRec !== undefined,
    "OptimizationEngine generates proactive speed harmonization recommendation for active TSR"
  );

  // ----------------------------------------------------
  // TEST 5: Candidate Exceeding TSR Hard Safety Rejection (-Infinity)
  // ----------------------------------------------------
  console.log("\nTest 5: Candidate Exceeding TSR Hard Safety Rejection");
  const unsafeTsrPrediction = predictionEngine.simulateForward(
    initialTrains,
    defaultSections,
    defaultSignals,
    defaultJunctions,
    300,
    [
      {
        id: "CAND-UNSAFE-TSR",
        affectedTrainId: "T001",
        action: "INCREASE_SPEED",
        targetSpeed: 100,
        affectedSectionId: "ND-GZB-01",
        description: "Unsafe speed exceeding 45 km/h TSR",
      },
    ],
    [testTsrIncident]
  );

  assert(
    unsafeTsrPrediction.isSafe === false &&
      unsafeTsrPrediction.safetyViolationReason !== undefined &&
      unsafeTsrPrediction.safetyViolationReason.includes("TSR limit"),
    "Candidate action demanding speed exceeding active TSR receives hard safety violation rejection"
  );

  // ----------------------------------------------------
  // TEST 6: Candidate Entering Blocked Section Hard Safety Rejection
  // ----------------------------------------------------
  console.log("\nTest 6: Candidate Entering Blocked Section Hard Safety Rejection");
  const unsafeBlockPrediction = predictionEngine.simulateForward(
    initialTrains,
    defaultSections,
    defaultSignals,
    defaultJunctions,
    300,
    [
      {
        id: "CAND-UNSAFE-BLOCK",
        affectedTrainId: "T002",
        action: "INCREASE_SPEED",
        targetSpeed: 80,
        affectedSectionId: "GZB-MRT-01",
        description: "Unsafe entry into blocked section",
      },
    ],
    [testBlockageIncident]
  );

  assert(
    unsafeBlockPrediction.isSafe === false &&
      unsafeBlockPrediction.safetyViolationReason !== undefined &&
      unsafeBlockPrediction.safetyViolationReason.includes("blocked track section"),
    "Candidate action commanding acceleration into blocked section is rejected with hard safety violation"
  );

  // ----------------------------------------------------
  // TEST 7: Strategy Synthesis Excludes Incident-Unsafe Actions
  // ----------------------------------------------------
  console.log("\nTest 7: Strategy Synthesis Excludes Incident-Unsafe Actions");
  const strategiesWithTsr = strategySynthesisEngine.synthesizeStrategies(
    initialTrains,
    defaultSections,
    defaultSignals,
    defaultJunctions,
    [
      {
        id: "CAND-TSR-COMPLIANT",
        affectedTrainId: "T001",
        action: "REDUCE_SPEED",
        targetSpeed: 45,
        affectedSectionId: "ND-GZB-01",
        description: "Comply with TSR",
      },
      {
        id: "CAND-T002-HOLD",
        affectedTrainId: "T002",
        action: "HOLD_TRAIN",
        targetSpeed: 0,
        affectedSectionId: "GZB-MRT-01",
        description: "Hold train",
      },
    ],
    [
      {
        candidate: {
          id: "CAND-TSR-COMPLIANT",
          affectedTrainId: "T001",
          action: "REDUCE_SPEED",
          targetSpeed: 45,
          affectedSectionId: "ND-GZB-01",
          description: "Comply with TSR",
        },
        isSafe: true,
        predictedState: tsrPrediction.predictedState,
        objectiveScore: 80,
        scoreBreakdown: { throughputGainScore: 80, delayRecoveryScore: 80, bottleneckReliefScore: 80, priorityScore: 80, brakingLossScore: 5, junctionWaitScore: 5, totalScore: 80 },
        expectedMetrics: { sectionThroughputDeltaPercent: 5, delayReductionMinutes: 1, bottleneckReliefPercent: 10 },
      },
      {
        candidate: {
          id: "CAND-T002-HOLD",
          affectedTrainId: "T002",
          action: "HOLD_TRAIN",
          targetSpeed: 0,
          affectedSectionId: "GZB-MRT-01",
          description: "Hold train",
        },
        isSafe: true,
        predictedState: tsrPrediction.predictedState,
        objectiveScore: 75,
        scoreBreakdown: { throughputGainScore: 75, delayRecoveryScore: 75, bottleneckReliefScore: 75, priorityScore: 75, brakingLossScore: 5, junctionWaitScore: 5, totalScore: 75 },
        expectedMetrics: { sectionThroughputDeltaPercent: 4, delayReductionMinutes: 0.5, bottleneckReliefPercent: 8 },
      },
    ],
    tsrPrediction.predictedState,
    100,
    1,
    300,
    [testTsrIncident]
  );

  assert(
    strategiesWithTsr.every((s) => s.safetyStatus === "VERIFIED_SAFE"),
    "Synthesized strategies in incident conditions strictly maintain verified safety"
  );

  console.log("\n-------------------------------------------------------");
  console.log(`  Phase 10 Step 2 Test Summary: ${passCount} Passed, ${failCount} Failed`);
  console.log("-------------------------------------------------------\n");

  return failCount === 0;
}

if (require.main === module || !process.env.TEST_IMPORT) {
  runPhase10Step2Tests();
}

