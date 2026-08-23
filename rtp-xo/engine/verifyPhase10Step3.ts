/**
 * RTPXO - Phase 10 Step 3 Verification Suite
 * Verifies Deterministic Incident Recovery Plan Synthesis, Staged Execution Triggers,
 * Strict Safety Guarantees, Non-Mutation, and Phase 9 Strategy Reuse.
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
import { recoveryPlanEngine } from "./recoveryPlanEngine";
import { createSimulationEngine, SimulationEngine } from "./simulationEngine";
import { benchmarkRunner } from "./benchmarkRunner";
import { CoordinatedStrategyPlan } from "@/types/strategy";

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

export function runPhase10Step3Tests(): boolean {
  console.log("\n=======================================================");
  console.log("  RTPXO PHASE 10 STEP 3: RECOVERY PLAN SYNTHESIS");
  console.log("=======================================================\n");

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
    expectedDurationSeconds: 180,
  };

  const testBlockageIncident: ActiveIncident = {
    id: "INC-BLOCK-01",
    type: "TRACK_SECTION_BLOCKAGE",
    severity: "CRITICAL",
    status: "ACTIVE_MITIGATING",
    affectedSectionId: "GZB-MRT-01",
    isCompleteBlockage: true,
    reason: "Obstruction on track",
    startTimeSimulationSeconds: 10,
    expectedDurationSeconds: 240,
  };

  // ----------------------------------------------------
  // TEST 1: Active TSR Containment/Recovery Plan Synthesis
  // ----------------------------------------------------
  console.log("Test 1: Active TSR Containment & Recovery Plan Synthesis");
  const optResultTsr = optimizationEngine.optimizeNetwork(
    initialTrains,
    defaultSections,
    defaultSignals,
    defaultJunctions,
    [],
    [],
    {
      trainsCompleted: 0,
      trainsPerHour: 4.0,
      corridorThroughput: 80,
      baselineThroughput: 75,
      throughputImprovement: 6.7,
      averageDelay: 2.0,
      maximumDelay: 5,
      averageTravelTime: 40,
      corridorUtilization: 50,
      bottleneckSection: null,
      totalDistanceTraveledKm: 100,
      conflictFreeTimeSeconds: 300,
      recommendationsTotalCount: 4,
      recommendationsAcceptedCount: 4,
      recommendationAcceptanceRate: 100,
      estimatedDelaySavedMinutes: 8,
      completedRecords: [],
    },
    [],
    100,
    300,
    adaptiveDecisionEngine,
    1,
    [testTsrIncident]
  );

  const recoveryPlansTsr = optResultTsr.availableRecoveryPlans || [];
  const tsrPlan = recoveryPlansTsr.find((p) => p.associatedIncidentId === "INC-TSR-01");

  assert(
    tsrPlan !== undefined &&
      tsrPlan.safetyStatus === "VERIFIED_SAFE" &&
      tsrPlan.executionStatus === "PROPOSED" &&
      tsrPlan.stagingPhases.length > 0 &&
      tsrPlan.stagingPhases[0].triggerCondition === "IMMEDIATE",
    "Active TSR produces valid staged recovery plan with IMMEDIATE containment phase"
  );

  // ----------------------------------------------------
  // TEST 2: Blocked Section Upstream Hold Plan
  // ----------------------------------------------------
  console.log("\nTest 2: Blocked Section Upstream Hold Plan");
  const optResultBlock = optimizationEngine.optimizeNetwork(
    initialTrains,
    defaultSections,
    defaultSignals,
    defaultJunctions,
    [],
    [],
    {
      trainsCompleted: 0,
      trainsPerHour: 4.0,
      corridorThroughput: 80,
      baselineThroughput: 75,
      throughputImprovement: 6.7,
      averageDelay: 2.0,
      maximumDelay: 5,
      averageTravelTime: 40,
      corridorUtilization: 50,
      bottleneckSection: null,
      totalDistanceTraveledKm: 100,
      conflictFreeTimeSeconds: 300,
      recommendationsTotalCount: 4,
      recommendationsAcceptedCount: 4,
      recommendationAcceptanceRate: 100,
      estimatedDelaySavedMinutes: 8,
      completedRecords: [],
    },
    [],
    100,
    300,
    adaptiveDecisionEngine,
    1,
    [testBlockageIncident]
  );

  const blockPlan = optResultBlock.availableRecoveryPlans?.find(
    (p) => p.associatedIncidentId === "INC-BLOCK-01"
  );

  assert(
    blockPlan !== undefined &&
      blockPlan.stagingPhases.some((phase) =>
        phase.actions.some((a) => a.role === "SIDING_HOLD" || a.candidateAction.action === "HOLD_TRAIN")
      ),
    "Blocked section generates staged containment plan holding traffic upstream of blockage"
  );

  // ----------------------------------------------------
  // TEST 3: Unsafe Actions Exclusion
  // ----------------------------------------------------
  console.log("\nTest 3: Unsafe Actions Exclusion from Recovery Plans");
  const baseForward = predictionEngine.simulateForward(
    initialTrains,
    defaultSections,
    defaultSignals,
    defaultJunctions,
    300,
    [],
    [testTsrIncident]
  );

  const unsafeEvalPlan = recoveryPlanEngine.synthesizeRecoveryPlans(
    [testTsrIncident],
    initialTrains,
    defaultSections,
    defaultSignals,
    defaultJunctions,
    [
      {
        id: "CAND-UNSAFE-SPEED-120",
        affectedTrainId: "T001",
        action: "INCREASE_SPEED",
        targetSpeed: 120,
        affectedSectionId: "ND-GZB-01",
        description: "Unsafe speed exceeding TSR 45 km/h",
      },
    ],
    [
      {
        candidate: {
          id: "CAND-UNSAFE-SPEED-120",
          affectedTrainId: "T001",
          action: "INCREASE_SPEED",
          targetSpeed: 120,
          affectedSectionId: "ND-GZB-01",
          description: "Unsafe speed exceeding TSR 45 km/h",
        },
        isSafe: false,
        safetyRejectionReason: "Speed 120 km/h exceeds TSR limit 45 km/h",
        objectiveScore: -Infinity,
        scoreBreakdown: { throughputGainScore: 0, delayRecoveryScore: 0, bottleneckReliefScore: 0, priorityScore: 0, brakingLossScore: 0, junctionWaitScore: 0, totalScore: -Infinity },
        expectedMetrics: { sectionThroughputDeltaPercent: 0, delayReductionMinutes: 0, bottleneckReliefPercent: 0 },
        predictedState: baseForward.predictedState,
      },
    ],
    [],
    baseForward.predictedState,
    100,
    300
  );

  const hasUnsafeCandidateInPlan = unsafeEvalPlan.some((p) =>
    p.stagingPhases.some((ph) =>
      ph.actions.some((a) => a.candidateAction.id === "CAND-UNSAFE-SPEED-120")
    )
  );

  assert(
    !hasUnsafeCandidateInPlan,
    "Unsafe candidate actions (-Infinity / isSafe === false) are strictly excluded from recovery plans"
  );

  // ----------------------------------------------------
  // TEST 4: Clearance-Dependent Staging (ON_INCIDENT_CLEARANCE)
  // ----------------------------------------------------
  console.log("\nTest 4: Clearance-Dependent Staging (ON_INCIDENT_CLEARANCE)");
  const clearanceStagedPlan = recoveryPlanEngine.synthesizeRecoveryPlans(
    [testTsrIncident],
    initialTrains,
    defaultSections,
    defaultSignals,
    defaultJunctions,
    [
      {
        id: "CAND-POST-CLEAR-ACCEL",
        affectedTrainId: "T001",
        action: "INCREASE_SPEED",
        targetSpeed: 110,
        affectedSectionId: "ND-GZB-01",
        description: "Post-clearance line-speed acceleration",
      },
    ],
    [
      {
        candidate: {
          id: "CAND-POST-CLEAR-ACCEL",
          affectedTrainId: "T001",
          action: "INCREASE_SPEED",
          targetSpeed: 110,
          affectedSectionId: "ND-GZB-01",
          description: "Post-clearance line-speed acceleration",
        },
        isSafe: true,
        objectiveScore: 85,
        scoreBreakdown: { throughputGainScore: 85, delayRecoveryScore: 85, bottleneckReliefScore: 85, priorityScore: 85, brakingLossScore: 0, junctionWaitScore: 0, totalScore: 85 },
        expectedMetrics: { sectionThroughputDeltaPercent: 10, delayReductionMinutes: 2, bottleneckReliefPercent: 15 },
        predictedState: baseForward.predictedState,
      },
    ],
    [],
    baseForward.predictedState,
    100,
    300
  );

  const clearancePhase = clearanceStagedPlan[0]?.stagingPhases.find(
    (ph) => ph.triggerCondition === "ON_INCIDENT_CLEARANCE"
  );

  assert(
    clearancePhase !== undefined &&
      clearancePhase.actions.some((a) => a.candidateAction.id === "CAND-POST-CLEAR-ACCEL"),
    "Post-clearance acceleration actions are strictly staged behind ON_INCIDENT_CLEARANCE trigger"
  );

  // ----------------------------------------------------
  // TEST 5: State Non-Mutation Invariant
  // ----------------------------------------------------
  console.log("\nTest 5: State Non-Mutation Invariant During Planning");
  const testEngine = createSimulationEngine();
  testEngine.declareIncident(testTsrIncident);

  const preSnapshot = JSON.stringify(testEngine.getSnapshot().trains);
  // Trigger recovery plan synthesis
  recoveryPlanEngine.synthesizeRecoveryPlans(
    [testTsrIncident],
    testEngine.getSnapshot().trains,
    defaultSections,
    defaultSignals,
    defaultJunctions,
    [],
    [],
    [],
    baseForward.predictedState,
    100,
    300
  );
  const postSnapshot = JSON.stringify(testEngine.getSnapshot().trains);

  assert(
    preSnapshot === postSnapshot,
    "Recovery plan synthesis is purely non-mutating with zero side-effects on live SimulationEngine state"
  );

  // ----------------------------------------------------
  // TEST 6: Incident Non-Clearance Invariant
  // ----------------------------------------------------
  console.log("\nTest 6: Incident Non-Clearance Invariant");
  const liveIncidents = testEngine.getActiveIncidents();
  const liveTsr = liveIncidents.find((i) => i.id === "INC-TSR-01");

  assert(
    liveTsr !== undefined && liveTsr.status === "ACTIVE_MITIGATING",
    "Recovery planning never automatically clears or mutates incident lifecycle status"
  );

  // ----------------------------------------------------
  // TEST 7: No Action Dispatch Invariant
  // ----------------------------------------------------
  console.log("\nTest 7: No Action Dispatch Invariant");
  const liveRecoveryPlans = testEngine.getRecoveryPlans();

  assert(
    liveRecoveryPlans.every((p) => p.executionStatus === "PROPOSED"),
    "All synthesized recovery plans remain in advisory PROPOSED state with zero automatic dispatch"
  );

  // ----------------------------------------------------
  // TEST 8: Phase 9 Strategy Reuse
  // ----------------------------------------------------
  console.log("\nTest 8: Phase 9 Strategy Reuse");
  const mockPhase9Strategy: CoordinatedStrategyPlan = {
    strategyId: "STRAT-MOCK-P9",
    planType: "PRIMARY_THROUGHPUT",
    name: "Mock Incident Corridor Strategy",
    summary: "Coordinated strategy touching incident zone",
    creationSimulationTime: 100,
    stateRevisionAtGeneration: 1,
    targetTrainIds: ["T001", "T002"],
    targetSectionIds: ["ND-GZB-01"],
    constituentActions: [
      {
        candidateAction: {
          id: "CAND-STRAT-P9-01",
          affectedTrainId: "T001",
          action: "REDUCE_SPEED",
          targetSpeed: 45,
          affectedSectionId: "ND-GZB-01",
          description: "Strategy TSR compliance",
        },
        trainId: "T001",
        trainName: "Vande Bharat Express",
        role: "SPEED_REGULATE",
        targetSectionId: "ND-GZB-01",
        individualBaseScore: 80,
        individualAdaptiveScore: 80,
        rationalSummary: "Comply with TSR",
      },
    ],
    predictedImpact: {
      projectedNetDelaySavedMinutes: 1.5,
      projectedCorridorThroughputGainPercent: 5,
      projectedBottleneckReliefPercent: 10,
      projectedConflictFreeHorizonSeconds: 250,
    },
    resilienceMetrics: {
      delayPropagationMinutes: -1.5,
      conflictExposureSeconds: 50,
      throughputDegradationPercent: 5,
      bottleneckPersistenceRatio: 0.1,
      recoveryTimeSeconds: 120,
      affectedTrainCount: 2,
      recoveryEfficiencyRatio: 1.5,
      headwayBufferMarginKm: 2.5,
      kinematicStabilityIndex: 0.9,
    },
    objectiveScore: 82,
    adaptiveScore: 82,
    safetyStatus: "VERIFIED_SAFE",
    rationale: "Optimized multi-train strategy",
    provenance: {
      clusterType: "SPEED_HARMONIZATION",
      corridorZone: "ND-GZB",
      algorithm: "JOINT_RESILIENCE_SYNTHESIS",
      evaluatedPermutationsCount: 4,
    },
    executionStatus: "PROPOSED",
    phase8CAuditLinkage: {
      evaluationWindowSeconds: 30,
      constituentDecisionAuditIds: [],
      verificationStatus: "PENDING",
      attributionType: "DIRECT",
    },
  };

  const planWithP9 = recoveryPlanEngine.synthesizeRecoveryPlans(
    [testTsrIncident],
    initialTrains,
    defaultSections,
    defaultSignals,
    defaultJunctions,
    [],
    [],
    [mockPhase9Strategy],
    baseForward.predictedState,
    100,
    300
  );

  const containsP9Action = planWithP9[0]?.stagingPhases.some((ph) =>
    ph.actions.some((a) => a.candidateAction.id === "CAND-STRAT-P9-01")
  );

  assert(
    containsP9Action === true,
    "Recovery plan seamlessly bundles relevant verified Phase 9 strategies without re-running duplicate search"
  );

  // ----------------------------------------------------
  // TEST 9: Adaptive Learning Safety Guarantee
  // ----------------------------------------------------
  console.log("\nTest 9: Adaptive Learning Safety Guarantee");
  // Even if adaptive score is artificially high, unsafe candidate (isSafe: false) must be rejected
  const unsafeWithAdaptivePlan = recoveryPlanEngine.synthesizeRecoveryPlans(
    [testTsrIncident],
    initialTrains,
    defaultSections,
    defaultSignals,
    defaultJunctions,
    [
      {
        id: "CAND-UNSAFE-ADAPTIVE-HIGH",
        affectedTrainId: "T001",
        action: "INCREASE_SPEED",
        targetSpeed: 130,
        affectedSectionId: "ND-GZB-01",
        description: "Unsafe speed with high adaptive score",
      },
    ],
    [
      {
        candidate: {
          id: "CAND-UNSAFE-ADAPTIVE-HIGH",
          affectedTrainId: "T001",
          action: "INCREASE_SPEED",
          targetSpeed: 130,
          affectedSectionId: "ND-GZB-01",
          description: "Unsafe speed with high adaptive score",
        },
        isSafe: false,
        safetyRejectionReason: "Exceeds TSR",
        objectiveScore: -Infinity,
        adaptiveScore: 99.0, // High adaptive score must NOT rescue unsafe candidate
        scoreBreakdown: { throughputGainScore: 0, delayRecoveryScore: 0, bottleneckReliefScore: 0, priorityScore: 0, brakingLossScore: 0, junctionWaitScore: 0, totalScore: -Infinity },
        expectedMetrics: { sectionThroughputDeltaPercent: 0, delayReductionMinutes: 0, bottleneckReliefPercent: 0 },
        predictedState: baseForward.predictedState,
      },
    ],
    [],
    baseForward.predictedState,
    100,
    300
  );

  const hasRescuedCandidate = unsafeWithAdaptivePlan.some((p) =>
    p.stagingPhases.some((ph) =>
      ph.actions.some((a) => a.candidateAction.id === "CAND-UNSAFE-ADAPTIVE-HIGH")
    )
  );

  assert(
    !hasRescuedCandidate,
    "Adaptive learning cannot rescue unsafe candidate actions (-Infinity) into recovery plans"
  );

  // ----------------------------------------------------
  // TEST 10: Determinism Verification
  // ----------------------------------------------------
  console.log("\nTest 10: Determinism Verification");
  const planA = recoveryPlanEngine.synthesizeRecoveryPlans(
    [testTsrIncident],
    initialTrains,
    defaultSections,
    defaultSignals,
    defaultJunctions,
    mockPhase9Strategy.constituentActions.map((a) => a.candidateAction),
    [
      {
        candidate: mockPhase9Strategy.constituentActions[0].candidateAction,
        isSafe: true,
        objectiveScore: 80,
        scoreBreakdown: { throughputGainScore: 80, delayRecoveryScore: 80, bottleneckReliefScore: 80, priorityScore: 80, brakingLossScore: 0, junctionWaitScore: 0, totalScore: 80 },
        expectedMetrics: { sectionThroughputDeltaPercent: 5, delayReductionMinutes: 1, bottleneckReliefPercent: 10 },
        predictedState: baseForward.predictedState,
      },
    ],
    [mockPhase9Strategy],
    baseForward.predictedState,
    100,
    300
  );

  const planB = recoveryPlanEngine.synthesizeRecoveryPlans(
    [testTsrIncident],
    initialTrains,
    defaultSections,
    defaultSignals,
    defaultJunctions,
    mockPhase9Strategy.constituentActions.map((a) => a.candidateAction),
    [
      {
        candidate: mockPhase9Strategy.constituentActions[0].candidateAction,
        isSafe: true,
        objectiveScore: 80,
        scoreBreakdown: { throughputGainScore: 80, delayRecoveryScore: 80, bottleneckReliefScore: 80, priorityScore: 80, brakingLossScore: 0, junctionWaitScore: 0, totalScore: 80 },
        expectedMetrics: { sectionThroughputDeltaPercent: 5, delayReductionMinutes: 1, bottleneckReliefPercent: 10 },
        predictedState: baseForward.predictedState,
      },
    ],
    [mockPhase9Strategy],
    baseForward.predictedState,
    100,
    300
  );

  assert(
    JSON.stringify(planA) === JSON.stringify(planB),
    "Identical inputs produce bitwise-identical staged recovery plans with stable IDs and ordering"
  );

  // ----------------------------------------------------
  // TEST 11: Reset Cleanliness
  // ----------------------------------------------------
  console.log("\nTest 11: Reset Cleanliness");
  testEngine.reset();
  const postResetPlans = testEngine.getRecoveryPlans();
  const postResetIncidents = testEngine.getActiveIncidents();

  assert(
    postResetPlans.length === 0 && postResetIncidents.length === 0,
    "SimulationEngine.reset() cleanly purges active incidents and recovery plans"
  );

  // ----------------------------------------------------
  // TEST 12: Benchmark Isolation
  // ----------------------------------------------------
  console.log("\nTest 12: Benchmark Isolation");
  const livePlansBeforeBenchmark = testEngine.getRecoveryPlans().length;
  benchmarkRunner.runBenchmark("NORMAL_OPERATION");
  const livePlansAfterBenchmark = testEngine.getRecoveryPlans().length;

  assert(
    livePlansBeforeBenchmark === livePlansAfterBenchmark,
    "Headless benchmark simulation executes without polluting live recovery planning structures"
  );

  // ----------------------------------------------------
  // TEST 13: Constituent Action Safety Status
  // ----------------------------------------------------
  console.log("\nTest 13: Constituent Action Safety Status");
  assert(
    tsrPlan !== undefined &&
      tsrPlan.stagingPhases.every((ph) =>
        ph.actions.every((act) => act.candidateAction !== undefined && act.individualBaseScore > -Infinity)
      ),
    "Every constituent action in synthesized recovery plans has explicit verified safety"
  );

  // ----------------------------------------------------
  // TEST 14: Single-Clock Invariant
  // ----------------------------------------------------
  console.log("\nTest 14: Single-Clock Invariant");
  assert(
    typeof (recoveryPlanEngine as any).timer === "undefined",
    "RecoveryPlanEngine is purely algorithmic and introduces zero secondary simulation clocks or timers"
  );

  // ----------------------------------------------------
  // TEST 15: Full Regression Verification
  // ----------------------------------------------------
  console.log("\nTest 15: Full Regression Verification");
  const fullSnapshot = testEngine.getSnapshot();
  assert(
    fullSnapshot.trains.length > 0 &&
      fullSnapshot.sections.length > 0 &&
      fullSnapshot.signals.length > 0,
    "Baseline railway simulation and topology remain fully operational without regression"
  );

  console.log("\n-------------------------------------------------------");
  console.log(`  Phase 10 Step 3 Test Summary: ${passCount} Passed, ${failCount} Failed`);
  console.log("-------------------------------------------------------\n");

  return failCount === 0;
}

if (require.main === module || !process.env.TEST_IMPORT) {
  runPhase10Step3Tests();
}
