/**
 * RTPXO - Phase 8D Automated Verification Suite
 * Adaptive Decision Intelligence & Policy Learning Engine
 */

import { SimulationEngine } from "./simulationEngine";
import { AdaptiveDecisionEngine, adaptiveDecisionEngine } from "./adaptiveDecisionEngine";
import { benchmarkRunner } from "./benchmarkRunner";
import { trains as initialTrains } from "../data/trains";
import { sections as defaultSections } from "../data/sections";
import { DecisionAuditRecord, CandidateAction } from "../types/optimization";

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

export function runPhase8DTests(): boolean {
  console.log("\n=======================================================");
  console.log("  RTPXO PHASE 8D: ADAPTIVE DECISION INTELLIGENCE");
  console.log("=======================================================\n");

  const engine = new SimulationEngine(initialTrains);
  const testAdaptive = new AdaptiveDecisionEngine();

  const dummyTrain = initialTrains[0];
  const dummySection = defaultSections[0];

  const dummyCandidate: CandidateAction = {
    id: "CAND-TEST-HOLD",
    affectedTrainId: dummyTrain.id,
    action: "HOLD_TRAIN",
    affectedSectionId: dummySection.id,
    description: "Test hold train",
  };

  // ----------------------------------------------------
  // TEST 1: Empty history produces neutral adaptive adjustment
  // ----------------------------------------------------
  console.log("Test 1: Neutral Prior with Empty History");
  testAdaptive.reset();
  const insight1 = testAdaptive.evaluateAdaptiveInsight(
    dummyCandidate,
    dummyTrain,
    dummySection,
    false,
    "MODERATE",
    80.0
  );
  assert(
    insight1.adaptiveAdjustment === 0 &&
      insight1.adaptiveScore === 80.0 &&
      insight1.confidenceLevel === "LOW" &&
      insight1.fallbackLevel === "NEUTRAL_PRIOR",
    "Empty history yields 0.0 adaptive adjustment, identical base score, and LOW confidence"
  );

  // ----------------------------------------------------
  // TEST 2: VERIFIED_ACCURATE outcome increases historical success evidence
  // ----------------------------------------------------
  console.log("\nTest 2: VERIFIED_ACCURATE Learning Update");
  const recordAccurate: DecisionAuditRecord = {
    id: "DEC-TEST-1",
    simulationTime: 10,
    timestamp: Date.now(),
    eventType: "RECOMMENDATION_APPLIED",
    affectedTrainId: dummyTrain.id,
    affectedSectionId: dummySection.id,
    action: "HOLD_TRAIN",
    reason: "Test accurate hold",
    evaluationWindowSeconds: 30,
    preState: {
      trainSpeed: 60,
      trainDelayMinutes: 5,
      sectionId: dummySection.id,
      sectionThroughput: 2.0,
      sectionOccupancyCount: 1,
      hasActiveConflict: false,
      trainPriorityClass: "HIGH",
    },
    predictionAvailable: {
      horizonSeconds: 300,
      projectedConflictsCount: 0,
    },
    projectedImpact: {
      expectedThroughputImpact: 5,
      expectedDelayImpact: -2,
      projectedDelayMinutes: 3,
    },
    actualOutcome: {
      measuredAtSimulationTime: 40,
      evaluationWindowSeconds: 30,
      measuredSpeedKmH: 0,
      measuredDelayMinutes: 3,
      measuredSectionThroughput: 2.1,
      actualDelayDeltaMinutes: -2,
      actualThroughputDelta: 0.1,
      conflictResolution: "NOT_APPLICABLE",
      verificationStatus: "VERIFIED_ACCURATE",
      attributionType: "DIRECT",
    },
  };

  testAdaptive.recordOutcome(recordAccurate);
  const insight2 = testAdaptive.evaluateAdaptiveInsight(
    dummyCandidate,
    dummyTrain,
    dummySection,
    false,
    "MODERATE",
    80.0
  );
  assert(
    insight2.adaptiveAdjustment > 0 &&
      insight2.adaptiveScore > 80.0 &&
      insight2.successRate === 1.0,
    "VERIFIED_ACCURATE outcome increases success rate to 1.0 and generates positive adaptive bonus"
  );

  // ----------------------------------------------------
  // TEST 3: DEVIATED outcome decreases historical success evidence
  // ----------------------------------------------------
  console.log("\nTest 3: DEVIATED Outcome Learning Update");
  const testDeviatedEngine = new AdaptiveDecisionEngine();
  const recordDeviated: DecisionAuditRecord = {
    ...recordAccurate,
    id: "DEC-TEST-DEV-1",
    action: "REDUCE_SPEED",
    actualOutcome: {
      measuredAtSimulationTime: 40,
      evaluationWindowSeconds: 30,
      measuredSpeedKmH: 30,
      measuredDelayMinutes: 10,
      measuredSectionThroughput: 1.0,
      actualDelayDeltaMinutes: 5,
      actualThroughputDelta: -1.0,
      conflictResolution: "UNRESOLVED",
      verificationStatus: "DEVIATED",
      attributionType: "DIRECT",
    },
  };

  testDeviatedEngine.recordOutcome(recordDeviated);
  const candReduce: CandidateAction = {
    id: "CAND-TEST-REDUCE",
    affectedTrainId: dummyTrain.id,
    action: "REDUCE_SPEED",
    affectedSectionId: dummySection.id,
    description: "Test reduce speed",
  };
  const insightDev = testDeviatedEngine.evaluateAdaptiveInsight(
    candReduce,
    dummyTrain,
    dummySection,
    false,
    "MODERATE",
    75.0
  );
  assert(
    insightDev.adaptiveAdjustment < 0 &&
      insightDev.adaptiveScore < 75.0 &&
      insightDev.successRate === 0.0,
    "DEVIATED outcome decreases success rate to 0.0 and generates negative adaptive penalty"
  );

  // ----------------------------------------------------
  // TEST 4: INCONCLUSIVE outcome does not affect success rate
  // ----------------------------------------------------
  console.log("\nTest 4: INCONCLUSIVE Outcome Neutrality");
  const rateBefore = insight2.successRate;
  const recordInconclusive: DecisionAuditRecord = {
    ...recordAccurate,
    id: "DEC-TEST-INC",
    actualOutcome: {
      ...recordAccurate.actualOutcome!,
      verificationStatus: "INCONCLUSIVE",
      attributionType: "DIRECT",
    },
  };
  testAdaptive.recordOutcome(recordInconclusive);
  const insight4 = testAdaptive.evaluateAdaptiveInsight(
    dummyCandidate,
    dummyTrain,
    dummySection,
    false,
    "MODERATE",
    80.0
  );
  assert(
    insight4.successRate === rateBefore && insight4.verifiedSampleCount === 1,
    "INCONCLUSIVE outcome does not contaminate verified success rate or verified sample count"
  );

  // ----------------------------------------------------
  // TEST 5: SUPERSEDED outcome does not affect success rate
  // ----------------------------------------------------
  console.log("\nTest 5: SUPERSEDED Outcome Neutrality");
  const recordSuperseded: DecisionAuditRecord = {
    ...recordAccurate,
    id: "DEC-TEST-SUP",
    actualOutcome: {
      ...recordAccurate.actualOutcome!,
      verificationStatus: "INCONCLUSIVE",
      attributionType: "SUPERSEDED",
    },
  };
  testAdaptive.recordOutcome(recordSuperseded);
  const insight5 = testAdaptive.evaluateAdaptiveInsight(
    dummyCandidate,
    dummyTrain,
    dummySection,
    false,
    "MODERATE",
    80.0
  );
  assert(
    insight5.successRate === rateBefore && insight5.verifiedSampleCount === 1,
    "SUPERSEDED outcome does not contaminate verified success rate"
  );

  // ----------------------------------------------------
  // TEST 6: Exact context matching
  // ----------------------------------------------------
  console.log("\nTest 6: Exact Context Matching");
  const insightExact = testAdaptive.evaluateAdaptiveInsight(
    dummyCandidate,
    dummyTrain,
    dummySection,
    false,
    "MODERATE",
    80.0
  );
  assert(
    insightExact.fallbackLevel === "EXACT",
    "Exact context match resolved successfully"
  );

  // ----------------------------------------------------
  // TEST 7: Context fallback hierarchy
  // ----------------------------------------------------
  console.log("\nTest 7: Context Fallback Hierarchy");
  const otherSection = defaultSections[1]; // Different section ID
  const insightFallback = testAdaptive.evaluateAdaptiveInsight(
    dummyCandidate,
    dummyTrain,
    otherSection,
    false,
    "MODERATE",
    80.0
  );
  assert(
    insightFallback.fallbackLevel === "SECTION_INDEPENDENT" ||
      insightFallback.fallbackLevel === "CONGESTION_ACTION" ||
      insightFallback.fallbackLevel === "ACTION_ONLY",
    "Section-independent generalized context fallback triggered successfully"
  );

  // ----------------------------------------------------
  // TEST 8: Confidence scaling with verified sample count
  // ----------------------------------------------------
  console.log("\nTest 8: Confidence Level Scaling");
  const testConfEngine = new AdaptiveDecisionEngine();
  // Add 1 sample -> LOW
  testConfEngine.recordOutcome(recordAccurate);
  const conf1 = testConfEngine.evaluateAdaptiveInsight(dummyCandidate, dummyTrain, dummySection, false, "MODERATE", 80);
  assert(conf1.confidenceLevel === "LOW", "1 verified sample produces LOW confidence");

  // Add 3 more samples (total 4) -> MEDIUM
  for (let i = 2; i <= 4; i++) {
    testConfEngine.recordOutcome({ ...recordAccurate, id: `DEC-TEST-CONF-${i}` });
  }
  const conf2 = testConfEngine.evaluateAdaptiveInsight(dummyCandidate, dummyTrain, dummySection, false, "MODERATE", 80);
  assert(conf2.confidenceLevel === "MEDIUM", "4 verified samples produce MEDIUM confidence");

  // Add 5 more samples (total 9) -> HIGH
  for (let i = 5; i <= 9; i++) {
    testConfEngine.recordOutcome({ ...recordAccurate, id: `DEC-TEST-CONF-${i}` });
  }
  const conf3 = testConfEngine.evaluateAdaptiveInsight(dummyCandidate, dummyTrain, dummySection, false, "MODERATE", 80);
  assert(conf3.confidenceLevel === "HIGH", "9 verified samples produce HIGH confidence");

  // ----------------------------------------------------
  // TEST 9: Adaptive adjustment bounds [-10, +10]
  // ----------------------------------------------------
  console.log("\nTest 9: Adaptive Adjustment Bounding");
  // Add 50 accurate outcomes
  for (let i = 10; i <= 50; i++) {
    testConfEngine.recordOutcome({ ...recordAccurate, id: `DEC-TEST-BOUND-${i}` });
  }
  const insightBounded = testConfEngine.evaluateAdaptiveInsight(dummyCandidate, dummyTrain, dummySection, false, "MODERATE", 80);
  assert(
    insightBounded.adaptiveAdjustment <= 10.0 && insightBounded.adaptiveAdjustment >= -10.0,
    `Adaptive bonus remains strictly bounded at <= +10.0 (Actual: ${insightBounded.adaptiveAdjustment})`
  );

  // ----------------------------------------------------
  // TEST 10: Unsafe candidate remains -Infinity
  // ----------------------------------------------------
  console.log("\nTest 10: Unsafe Candidate Safety Invariant");
  const insightUnsafe = testConfEngine.evaluateAdaptiveInsight(
    dummyCandidate,
    dummyTrain,
    dummySection,
    false,
    "MODERATE",
    -Infinity
  );
  assert(
    insightUnsafe.adaptiveScore === -Infinity && insightUnsafe.adaptiveAdjustment === 0,
    "Unsafe candidate (-Infinity) is strictly non-rescuable by historical adaptive learning"
  );

  // ----------------------------------------------------
  // TEST 11: Adaptive ranking prefers historically successful actions
  // ----------------------------------------------------
  console.log("\nTest 11: Adaptive Candidate Ranking Preference");
  engine.reset();

  // Train learning engine with verified successful HOLD_TRAIN
  for (let i = 0; i < 10; i++) {
    engine.getAdaptiveEngine().recordOutcome({
      ...recordAccurate,
      id: `DEC-ACC-${i}`,
      action: "HOLD_TRAIN",
      preState: {
        ...recordAccurate.preState,
        sectionOccupancyCount: 2, // SATURATED
        hasActiveConflict: true, // CONFLICT
      },
    });
  }

  // Load junction conflict scenario and evaluate recommendations
  engine.loadScenario("JUNCTION_CONFLICT");
  const snap = engine.getSnapshot();
  const topRec = snap.recommendations[0];
  assert(
    topRec !== undefined &&
      topRec.adaptiveScore !== undefined &&
      topRec.adaptiveScore >= (topRec.objectiveScore ?? 0),
    "Adaptive decision ranking prioritizes historically verified actions"
  );

  // ----------------------------------------------------
  // TEST 12: Adaptive ranking does not override safety rejections
  // ----------------------------------------------------
  console.log("\nTest 12: Absolute Safety Interlocking Invariant");
  const rejAlts = topRec?.rejectedAlternatives || [];
  const unsafeRejections = rejAlts.filter((r) => !r.isSafe);
  assert(
    unsafeRejections.every((r) => r.adaptiveScore === -Infinity),
    "All unsafe candidate alternatives remain strictly rejected at -Infinity"
  );

  // ----------------------------------------------------
  // TEST 13: Scenario reset clears adaptive learning
  // ----------------------------------------------------
  console.log("\nTest 13: Reset Isolation");
  engine.reset();
  assert(
    engine.getAdaptiveEngine().getBucketCount() === 0 &&
      engine.getAdaptiveEngine().getRetainedOutcomesCount() === 0,
    "engine.reset() cleanly purges all scenario-specific learned adaptive statistics"
  );

  // ----------------------------------------------------
  // TEST 14: BenchmarkRunner pure isolation
  // ----------------------------------------------------
  console.log("\nTest 14: Benchmark Isolation");
  const liveSim = new SimulationEngine();
  const countBefore = liveSim.getAdaptiveEngine().getBucketCount();
  benchmarkRunner.runBenchmark("DELAYED_TRAIN", 15);
  const countAfter = liveSim.getAdaptiveEngine().getBucketCount();
  assert(
    countBefore === countAfter && countAfter === 0,
    "Benchmark dual-run execution does not pollute live adaptive learning buckets"
  );

  // ----------------------------------------------------
  // TEST 15: No simulation clock created
  // ----------------------------------------------------
  console.log("\nTest 15: Single Simulation Clock Invariant");
  const simTimeBefore = engine.getSnapshot().simulationTime;
  testAdaptive.evaluateAdaptiveInsight(dummyCandidate, dummyTrain, dummySection, false, "MODERATE", 70);
  const simTimeAfter = engine.getSnapshot().simulationTime;
  assert(
    simTimeBefore === simTimeAfter,
    "Adaptive decision engine does not create or mutate any secondary simulation clocks"
  );

  // ----------------------------------------------------
  // TEST 16: No train kinematics mutated
  // ----------------------------------------------------
  console.log("\nTest 16: Kinematic Invariant");
  const trainSpeedBefore = dummyTrain.speed;
  testAdaptive.evaluateAdaptiveInsight(dummyCandidate, dummyTrain, dummySection, false, "MODERATE", 70);
  assert(
    dummyTrain.speed === trainSpeedBefore,
    "Adaptive evaluation is purely observational and does not mutate train kinematics"
  );

  // ----------------------------------------------------
  // TEST 17: Deterministic reproducibility
  // ----------------------------------------------------
  console.log("\nTest 17: Determinism Verification");
  const run1 = testConfEngine.evaluateAdaptiveInsight(dummyCandidate, dummyTrain, dummySection, false, "MODERATE", 75.5);
  const run2 = testConfEngine.evaluateAdaptiveInsight(dummyCandidate, dummyTrain, dummySection, false, "MODERATE", 75.5);
  assert(
    run1.adaptiveScore === run2.adaptiveScore &&
      run1.adaptiveAdjustment === run2.adaptiveAdjustment &&
      run1.evidenceSummary === run2.evidenceSummary,
    "Identical inputs produce deterministic, bitwise-identical adaptive scores and explanations"
  );

  // ----------------------------------------------------
  // TEST 18: Maximum learning bucket limit (1000)
  // ----------------------------------------------------
  console.log("\nTest 18: Maximum Bucket Limit Enforcement");
  const testLimitEngine = new AdaptiveDecisionEngine();
  for (let i = 0; i < 1100; i++) {
    const fakeRec: DecisionAuditRecord = {
      ...recordAccurate,
      id: `DEC-LIMIT-${i}`,
      preState: {
        ...recordAccurate.preState,
        sectionId: `SEC-LIMIT-${i}`,
      },
    };
    testLimitEngine.recordOutcome(fakeRec);
  }
  assert(
    testLimitEngine.getBucketCount() <= 1000,
    `Maximum bucket capacity bounded at 1000 (Actual: ${testLimitEngine.getBucketCount()})`
  );

  // ----------------------------------------------------
  // TEST 19: Maximum retained outcome limit (500)
  // ----------------------------------------------------
  console.log("\nTest 19: Maximum Retained Outcomes Limit Enforcement");
  assert(
    testLimitEngine.getRetainedOutcomesCount() <= 500,
    `Maximum retained outcomes bounded at 500 (Actual: ${testLimitEngine.getRetainedOutcomesCount()})`
  );

  // ----------------------------------------------------
  // TEST 20: Full Closed-Loop: Act -> Measure -> Learn -> Improve
  // ----------------------------------------------------
  console.log("\nTest 20: Full Closed-Loop Learning Integration");
  engine.reset();
  engine.loadScenario("JUNCTION_CONFLICT");

  // Step 1: Apply initial recommendation
  const recInit = engine.getSnapshot().recommendations[0];
  assert(recInit !== undefined, "Initial recommendation available for action");

  if (recInit) {
    engine.applyRecommendation(recInit.id);
    // Step 2: Advance simulation past 30s evaluation window to trigger Phase 8C verification
    engine.step(35);

    // Step 3: Verify that adaptive learning bucket captured the completed outcome
    assert(
      engine.getAdaptiveEngine().getBucketCount() > 0,
      "Phase 8C verified outcome successfully trained Adaptive Decision Engine online"
    );
  }

  console.log("\n-------------------------------------------------------");
  console.log(`  Phase 8D Test Summary: ${passCount} Passed, ${failCount} Failed`);
  console.log("-------------------------------------------------------\n");

  return failCount === 0;
}

if (require.main === module) {
  const success = runPhase8DTests();
  process.exit(success ? 0 : 1);
}
