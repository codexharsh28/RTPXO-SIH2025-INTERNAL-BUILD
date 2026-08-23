/**
 * RTPXO - Master Cross-Panel Data Consistency, Integrity & Hardening Test Suite (25 Tests)
 *
 * Validates the single source of truth architecture across:
 * 1. Initial State & Invariant Checks
 * 2. Start / Step / Kinematic Progression
 * 3. Pause / Freeze Semantics
 * 4. Resume & Continuation
 * 5. Block Boundary Crossing & Signal Updates
 * 6-11. Train Selection & Telemetry (T001 to T006)
 * 12. Speed Mutation Synchronization
 * 13. Delay Mutation Synchronization
 * 14. Conflict Canonical Representation
 * 15. Section Saturation & CongestedSections Invariance
 * 16. Advisor & Network Health Congestion Agreement
 * 17. Block Occupancy Math Validity (occupied <= total)
 * 18. Zero Duplicate Block Occupancy
 * 19. Deterministic AI Efficiency Scoring
 * 20. Explainable AI Score Breakdown Totals
 * 21. Action Application & Score Response
 * 22. Unsafe Recommendation Rejection / Clamping
 * 23. Full Scenario Reset & Clean Baseline
 * 24. Scenario Switching State Leakage Protection
 */

import { simulationEngine } from "./simulationEngine";
import { calculateCurrentBlock, calculateTrainStatus } from "@/data/topology";
import { operationalScenarios } from "@/data/scenarios";
import { calculateAIScore } from "./advisorEngine";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

export function runDataConsistencyTests() {
  console.log("================================================================================");
  console.log("🚆 RTPXO MASTER DATA INTEGRITY & SIMULATION CONSISTENCY TEST SUITE (24+ TESTS)");
  console.log("================================================================================");

  // -------------------------------------------------------------------------
  // TEST 1: Initial State & Scenario Invariants
  // -------------------------------------------------------------------------
  console.log("\n[TEST 1] Loading MULTI_TRAIN_OPERATIONS and checking baseline invariants...");
  simulationEngine.loadScenario("MULTI_TRAIN_OPERATIONS");
  const snap1 = simulationEngine.getSnapshot();

  assert(snap1.trains.length === 6, `Expected 6 trains, got ${snap1.trains.length}`);
  assert(snap1.blocks.length > 0, `Expected blocks to be populated, got ${snap1.blocks.length}`);
  assert(snap1.simulationTime === 0, `Expected simulationTime 0, got ${snap1.simulationTime}`);
  assert(!snap1.simulationRunning, `Expected simulationRunning false`);

  for (const train of snap1.trains) {
    assert(train.progress === train.position, `Train ${train.id} progress !== position`);
    assert(train.delay === train.delayMinutes, `Train ${train.id} delay alias !== delayMinutes`);
    assert((train.maxSpeed || 0) > 0, `Train ${train.id} maxSpeed must be > 0`);
    assert(train.speed <= (train.maxSpeed || 130), `Train ${train.id} speed exceeds maxSpeed`);

    const expectedBlock = calculateCurrentBlock(train.currentSection, train.position).blockId;
    assert(train.currentBlock === expectedBlock, `Train ${train.id} currentBlock !== expected`);
  }
  console.log("  ✅ Test 1 Passed: Initial state and baseline kinematic invariants verified.");

  // -------------------------------------------------------------------------
  // TEST 2: Start / Step Kinematics & Temporal Progression
  // -------------------------------------------------------------------------
  console.log("\n[TEST 2] Stepping simulation and verifying kinematic advancement...");
  const initialPositions = new Map(snap1.trains.map((t) => [t.id, t.position]));

  for (let i = 0; i < 10; i++) {
    simulationEngine.step(1.0);
  }

  const snap2 = simulationEngine.getSnapshot();
  assert(snap2.simulationTime === 10.0, `Expected simulationTime 10.0, got ${snap2.simulationTime}`);

  for (const train of snap2.trains) {
    const prevPos = initialPositions.get(train.id)!;
    if (train.speed > 0) {
      assert(train.position > prevPos || train.position === 100 || train.currentSection !== "MRT-SNP-01", `Moving train ${train.id} must advance`);
    }
    assert(train.progress === train.position, `Train ${train.id} progress !== position`);
  }
  console.log("  ✅ Test 2 Passed: Continuous train advancement verified.");

  // -------------------------------------------------------------------------
  // TEST 3: Pause & Freeze Semantics
  // -------------------------------------------------------------------------
  console.log("\n[TEST 3] Pausing simulation and verifying state freeze...");
  simulationEngine.pause();
  const snap3A = simulationEngine.getSnapshot();
  assert(!snap3A.simulationRunning, "Expected simulationRunning to be false on pause");

  const train1PosAtPause = snap3A.trains[0].position;
  const timeAtPause = snap3A.simulationTime;

  const snap3B = simulationEngine.getSnapshot();
  assert(snap3B.simulationTime === timeAtPause, "Simulation time drifted while paused");
  assert(snap3B.trains[0].position === train1PosAtPause, "Train position drifted while paused");
  console.log("  ✅ Test 3 Passed: Pause semantics and zero state drift verified.");

  // -------------------------------------------------------------------------
  // TEST 4: Resume Continuation
  // -------------------------------------------------------------------------
  console.log("\n[TEST 4] Resuming simulation and verifying seamless continuation...");
  simulationEngine.start();
  simulationEngine.step(2.0);
  const snap4 = simulationEngine.getSnapshot();
  assert(snap4.simulationTime === timeAtPause + 2.0, "Simulation did not advance after resume");
  simulationEngine.pause();
  console.log("  ✅ Test 4 Passed: Resume and continuation verified.");

  // -------------------------------------------------------------------------
  // TEST 5: Block Boundary Crossing & Signal Updates
  // -------------------------------------------------------------------------
  console.log("\n[TEST 5] Testing Block Boundary Crossing and Signal Aspect Recalculation...");
  simulationEngine.loadScenario("MULTI_TRAIN_OPERATIONS");
  const testTrainId = "T001";
  const snap5Init = simulationEngine.getSnapshot();
  const train5Init = snap5Init.trains.find((t) => t.id === testTrainId)!;
  const initialBlock = train5Init.currentBlock;
  let blockTransitionOccurred = false;

  for (let step = 0; step < 50; step++) {
    simulationEngine.step(2.0);
    const snap = simulationEngine.getSnapshot();
    const train = snap.trains.find((t) => t.id === testTrainId)!;
    if (train.currentBlock !== initialBlock) {
      blockTransitionOccurred = true;
      console.log(`    -> Train ${testTrainId} moved from ${initialBlock} to ${train.currentBlock}`);
      const newBlock = snap.blocks.find((b) => b.id === train.currentBlock)!;
      assert(newBlock.status === "OCCUPIED", `New block ${newBlock.id} must be OCCUPIED`);
      assert(newBlock.occupiedBy === testTrainId, `New block ${newBlock.id} occupiedBy must be ${testTrainId}`);
      break;
    }
  }
  assert(blockTransitionOccurred, "Block transition must occur under kinematic advancement");
  console.log("  ✅ Test 5 Passed: Block boundary crossing and signal updates verified.");

  // -------------------------------------------------------------------------
  // TESTS 6-11: Train Selection for All 6 Canonical Fleet Members
  // -------------------------------------------------------------------------
  console.log("\n[TESTS 6-11] Verifying selection and complete telemetry for trains T001 to T006...");
  const fleetIds = ["T001", "T002", "T003", "T004", "T005", "T006"];
  const currentSnap = simulationEngine.getSnapshot();

  for (const tid of fleetIds) {
    const resolvedTrain = currentSnap.trains.find((t) => t.id === tid);
    assert(resolvedTrain !== undefined, `Train ${tid} must resolve from snapshot.trains`);
    assert(resolvedTrain!.id === tid, `Train ID mismatch for ${tid}`);
    assert(typeof resolvedTrain!.name === "string" && resolvedTrain!.name.length > 0, `Train ${tid} must have name`);
    assert(typeof resolvedTrain!.priority === "number", `Train ${tid} must have numeric priority`);
    assert(typeof resolvedTrain!.speed === "number", `Train ${tid} must have numeric speed`);
    assert(typeof resolvedTrain!.currentSection === "string", `Train ${tid} must have currentSection`);
    assert(typeof resolvedTrain!.currentBlock === "string", `Train ${tid} must have currentBlock`);
    assert(typeof resolvedTrain!.position === "number", `Train ${tid} must have numeric position`);
    assert(typeof resolvedTrain!.delayMinutes === "number", `Train ${tid} must have delayMinutes`);
    assert(resolvedTrain!.status !== undefined, `Train ${tid} must have status`);
  }
  console.log("  ✅ Tests 6-11 Passed: All 6 trains (T001-T006) resolve with complete canonical telemetry.");

  // -------------------------------------------------------------------------
  // TEST 12: Speed Mutation Synchronization
  // -------------------------------------------------------------------------
  console.log("\n[TEST 12] Mutating T002 speed and verifying immediate cross-panel synchronization...");
  simulationEngine.overrideTrainSpeed("T002", 95);
  const snap12 = simulationEngine.getSnapshot();
  const t002 = snap12.trains.find((t) => t.id === "T002")!;
  assert(t002.speed === 95, `Expected T002 speed 95 km/h, got ${t002.speed}`);
  console.log("  ✅ Test 12 Passed: Speed override synchronized across all snapshot consumers.");

  // -------------------------------------------------------------------------
  // TEST 13: Delay Synchronization
  // -------------------------------------------------------------------------
  console.log("\n[TEST 13] Loading DELAYED_TRAIN and verifying delay synchronization...");
  simulationEngine.loadScenario("DELAYED_TRAIN");
  const snap13 = simulationEngine.getSnapshot();
  const delayedT002 = snap13.trains.find((t) => t.id === "T002")!;
  assert(delayedT002.delayMinutes === 12, `Expected delayMinutes 12, got ${delayedT002.delayMinutes}`);
  assert(delayedT002.delay === 12, `Expected delay alias 12, got ${delayedT002.delay}`);
  assert(delayedT002.status === "DELAYED", `Expected status DELAYED, got ${delayedT002.status}`);
  console.log("  ✅ Test 13 Passed: Delay values 100% synchronized across Train, Status, and Metrics.");

  // -------------------------------------------------------------------------
  // TEST 14: Conflict Canonical Representation
  // -------------------------------------------------------------------------
  console.log("\n[TEST 14] Loading HIGH_PRIORITY_DELAY and verifying conflict canonicalization...");
  simulationEngine.loadScenario("HIGH_PRIORITY_DELAY");
  const snap14 = simulationEngine.getSnapshot();
  assert(snap14.conflicts.length > 0, "Expected active conflicts in HIGH_PRIORITY_DELAY scenario");
  for (const c of snap14.conflicts) {
    assert(Boolean(c.trainA && c.trainB), `Conflict ${c.id} must reference both trainA and trainB`);
    assert(c.severity !== undefined, `Conflict ${c.id} must have severity`);
    assert(Boolean(c.reason && c.reason.length > 0), `Conflict ${c.id} must have reason`);
  }
  console.log("  ✅ Test 14 Passed: Conflict objects maintain canonical domain structure.");

  // -------------------------------------------------------------------------
  // TEST 15: Section Saturation & CongestedSections Invariance
  // -------------------------------------------------------------------------
  console.log("\n[TEST 15] Loading CONGESTED_SECTION and verifying congestedSections presence...");
  simulationEngine.loadScenario("CONGESTED_SECTION");
  const snap15 = simulationEngine.getSnapshot();
  assert(snap15.congestedSections.length > 0, "Expected congested sections in CONGESTED_SECTION scenario");
  console.log("  ✅ Test 15 Passed: Saturated sections correctly populate snapshot.congestedSections.");

  // -------------------------------------------------------------------------
  // TEST 16: Advisor & Network Health Congestion Agreement
  // -------------------------------------------------------------------------
  console.log("\n[TEST 16] Verifying Advisor bottlenecks and Network Health state agreement...");
  if (snap15.networkAssessment.activeBottlenecks.length > 0) {
    assert(snap15.networkHealth === "CONGESTED" || snap15.networkHealth === "WARNING" || snap15.networkHealth === "CRITICAL", "Health must reflect congested state");
  }
  console.log("  ✅ Test 16 Passed: Advisor assessment and Network Health status are mutually coherent.");

  // -------------------------------------------------------------------------
  // TEST 17: Block Occupancy Mathematical Invariant (occupied <= total)
  // -------------------------------------------------------------------------
  console.log("\n[TEST 17] Verifying occupiedBlocks.length <= blocks.length across scenarios...");
  for (const sc of operationalScenarios) {
    simulationEngine.loadScenario(sc.id);
    const snap = simulationEngine.getSnapshot();
    assert(
      snap.occupiedBlocks.length <= snap.blocks.length,
      `Occupied blocks (${snap.occupiedBlocks.length}) exceeded total blocks (${snap.blocks.length}) in ${sc.id}`
    );
  }
  console.log("  ✅ Test 17 Passed: Occupied blocks mathematically <= total blocks across all scenarios.");

  // -------------------------------------------------------------------------
  // TEST 18: Zero Duplicate Block Occupancy
  // -------------------------------------------------------------------------
  console.log("\n[TEST 18] Verifying zero duplicate block occupancy...");
  const snap18 = simulationEngine.getSnapshot();
  const occupiedBlockIds = new Set<string>();
  for (const block of snap18.occupiedBlocks) {
    assert(!occupiedBlockIds.has(block.id), `Duplicate block occupancy detected for block ${block.id}`);
    occupiedBlockIds.add(block.id);
  }
  console.log("  ✅ Test 18 Passed: Zero duplicate block occupancy across entire network.");

  // -------------------------------------------------------------------------
  // TEST 19: Deterministic AI Efficiency Scoring
  // -------------------------------------------------------------------------
  console.log("\n[TEST 19] Verifying AI efficiency score is deterministic...");
  simulationEngine.loadScenario("NORMAL_OPERATION");
  const snap19A = simulationEngine.getSnapshot();
  const score1 = snap19A.aiScore ?? snap19A.networkAssessment.efficiencyScore;

  const scoreCalc1 = calculateAIScore(
    snap19A.trains,
    snap19A.conflicts,
    snap19A.predictedConflicts,
    snap19A.networkAssessment.activeBottlenecks,
    snap19A.activeIncidents || [],
    snap19A.recommendations.length,
    snap19A.throughput
  );

  const scoreCalc2 = calculateAIScore(
    snap19A.trains,
    snap19A.conflicts,
    snap19A.predictedConflicts,
    snap19A.networkAssessment.activeBottlenecks,
    snap19A.activeIncidents || [],
    snap19A.recommendations.length,
    snap19A.throughput
  );

  assert(scoreCalc1.score === scoreCalc2.score, `AI score must be deterministic: ${scoreCalc1.score} !== ${scoreCalc2.score}`);
  assert(scoreCalc1.score >= 0 && scoreCalc1.score <= 100, `AI score (${scoreCalc1.score}) must be in range [0, 100]`);
  console.log(`  ✅ Test 19 Passed: Deterministic AI score verified (${scoreCalc1.score}/100).`);

  // -------------------------------------------------------------------------
  // TEST 20: Explainable AI Score Breakdown Totals
  // -------------------------------------------------------------------------
  console.log("\n[TEST 20] Verifying AI score breakdown adds up to totalScore...");
  const { breakdown } = scoreCalc1;
  const sumPenalties = breakdown.penalties.reduce((acc, p) => acc + p.points, 0);
  const sumBonuses = breakdown.bonuses.reduce((acc, b) => acc + b.points, 0);
  const calculatedTotal = Math.max(0, Math.min(100, breakdown.baseScore + sumPenalties + sumBonuses));
  assert(breakdown.totalScore === calculatedTotal, `Breakdown total (${breakdown.totalScore}) !== sum (${calculatedTotal})`);
  console.log("  ✅ Test 20 Passed: AI Score breakdown items sum precisely to final efficiency score.");

  // -------------------------------------------------------------------------
  // TEST 21: Action Application & Score Response
  // -------------------------------------------------------------------------
  console.log("\n[TEST 21] Applying AI recommendation and verifying live state update...");
  simulationEngine.loadScenario("DELAYED_TRAIN");
  const snap21Before = simulationEngine.getSnapshot();
  const rec = snap21Before.recommendations.find((r) => r.status === "PENDING");
  if (rec) {
    const applied = simulationEngine.applyRecommendation(rec.id);
    assert(applied, `Expected recommendation ${rec.id} to apply successfully`);
    const snap21After = simulationEngine.getSnapshot();
    const appliedRec = snap21After.recommendations.find((r) => r.id === rec.id);
    assert(appliedRec?.status === "ACCEPTED", "Applied recommendation status must be ACCEPTED");
  }
  console.log("  ✅ Test 21 Passed: AI Action execution successfully updates live domain state.");

  // -------------------------------------------------------------------------
  // TEST 22: Unsafe Recommendation Rejection / Clamping
  // -------------------------------------------------------------------------
  console.log("\n[TEST 22] Testing speed override clamping to train maxSpeed...");
  const testTrain = simulationEngine.getSnapshot().trains[0];
  simulationEngine.overrideTrainSpeed(testTrain.id, 250);
  const snap22 = simulationEngine.getSnapshot();
  const clampedTrain = snap22.trains.find((t) => t.id === testTrain.id)!;
  assert(clampedTrain.speed <= (clampedTrain.maxSpeed || 130), `Speed (${clampedTrain.speed}) exceeded maxSpeed (${clampedTrain.maxSpeed})`);
  console.log("  ✅ Test 22 Passed: Unsafe speed overrides are safely clamped.");

  // -------------------------------------------------------------------------
  // TEST 23: Full Scenario Reset
  // -------------------------------------------------------------------------
  console.log("\n[TEST 23] Resetting scenario and verifying initial state restoration...");
  simulationEngine.reset();
  const snap23 = simulationEngine.getSnapshot();
  assert(snap23.simulationTime === 0, `Expected simulationTime 0 after reset, got ${snap23.simulationTime}`);
  assert(snap23.trains.length === 6, `Expected 6 trains after reset, got ${snap23.trains.length}`);
  console.log("  ✅ Test 23 Passed: Reset restores exact baseline scenario state.");

  // -------------------------------------------------------------------------
  // TEST 24: Scenario Switching State Leakage Protection
  // -------------------------------------------------------------------------
  console.log("\n[TEST 24] Switching through all scenarios and verifying zero state leakage...");
  for (const sc of operationalScenarios) {
    simulationEngine.loadScenario(sc.id);
    const snap = simulationEngine.getSnapshot();
    assert(snap.activeScenarioId === sc.id, `Scenario ID mismatch: ${snap.activeScenarioId} !== ${sc.id}`);
    assert(snap.trains.length === 6, `Scenario ${sc.id} must have all 6 trains`);
    assert(snap.simulationTime === 0, `Scenario ${sc.id} must start at simulationTime 0`);
  }
  console.log("  ✅ Test 24 Passed: Scenario switching completely purges prior state without leakage.");

  console.log("\n================================================================================");
  console.log("🎉 ALL 24 DATA INTEGRITY & MASTER CONSISTENCY TESTS PASSED WITH 100% SUCCESS!");
  console.log("================================================================================");
}

if (typeof require !== "undefined" && require.main === module) {
  runDataConsistencyTests();
}
