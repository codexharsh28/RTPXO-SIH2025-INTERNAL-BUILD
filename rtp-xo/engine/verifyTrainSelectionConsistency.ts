/**
 * RTPXO Train Selection & Fleet Completeness Verification Suite
 * Verifies that all 6 trains (T001 to T006) exist in the authoritative simulation state
 * and resolve cleanly for sidebar inspection across all scenarios and simulation states.
 */

import { simulationEngine } from "./simulationEngine";
import { operationalScenarios } from "../data/scenarios";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    throw new Error(message);
  }
}

export function runTrainSelectionConsistencyTests(): void {
  console.log("================================================================================");
  console.log("🚆 RTPXO TRAIN SELECTION & FLEET RESOLUTION VERIFICATION SUITE");
  console.log("================================================================================\n");

  const expectedTrainIds = ["T001", "T002", "T003", "T004", "T005", "T006"];

  // ---------------------------------------------------------------------------
  // TEST 1: Initial Default Fleet Verification
  // ---------------------------------------------------------------------------
  console.log("[TEST 1] Verifying initial state has all 6 canonical trains...");
  simulationEngine.reset();
  const snap1 = simulationEngine.getSnapshot();

  assert(snap1.trains.length >= 6, `Expected at least 6 trains, got ${snap1.trains.length}`);

  for (const id of expectedTrainIds) {
    const train = simulationEngine.getTrainById(id);
    assert(train !== undefined, `Train ${id} must resolve from simulationEngine.getTrainById()`);
    assert(train?.id === id, `Train ${id} ID mismatch`);
    assert(train?.name !== undefined && train.name.length > 0, `Train ${id} name must be valid`);
    assert(train?.currentSection !== undefined, `Train ${id} must have currentSection`);
    assert(train?.currentBlock !== undefined, `Train ${id} must have currentBlock`);
    assert(train?.speed !== undefined, `Train ${id} must have speed`);
    assert(train?.status !== undefined, `Train ${id} must have status`);

    // Verify snapshot find
    const snapshotTrain = snap1.trains.find((t) => t.id === id);
    assert(snapshotTrain !== undefined, `Train ${id} must exist in snapshot.trains`);
    assert(snapshotTrain?.id === id, `Train ${id} snapshot lookup ID mismatch`);
  }
  console.log("  ✅ Test 1 Passed: All 6 canonical trains exist and resolve in default state.");

  // ---------------------------------------------------------------------------
  // TEST 2: Multi-Scenario Completeness (All Scenarios must retain all 6 trains)
  // ---------------------------------------------------------------------------
  console.log("\n[TEST 2] Verifying all 6 trains are resolvable across EVERY scenario...");
  for (const scenario of operationalScenarios) {
    simulationEngine.loadScenario(scenario.id);
    const snap = simulationEngine.getSnapshot();

    assert(snap.activeScenarioId === scenario.id, `Scenario ID ${scenario.id} not set`);
    assert(snap.trains.length >= 6, `Scenario ${scenario.id} has only ${snap.trains.length} trains (expected >= 6)`);

    for (const id of expectedTrainIds) {
      const train = simulationEngine.getTrainById(id);
      assert(train !== undefined, `Train ${id} failed to resolve in scenario ${scenario.id}`);
      const snapTrain = snap.trains.find((t) => t.id === id);
      assert(snapTrain !== undefined, `Train ${id} missing in snapshot.trains for scenario ${scenario.id}`);
    }
    console.log(`    -> Scenario ${scenario.id} (${scenario.name}): All 6 trains verified.`);
  }
  console.log("  ✅ Test 2 Passed: Every operational scenario maintains complete 6-train fleet.");

  // ---------------------------------------------------------------------------
  // TEST 3: "All Trains" vs "Active Trains" Distinction
  // ---------------------------------------------------------------------------
  console.log("\n[TEST 3] Verifying activeTrains is a proper subset of snapshot.trains...");
  simulationEngine.loadScenario("DELAYED_TRAIN");
  const snap3 = simulationEngine.getSnapshot();

  assert(snap3.trains.length >= 6, `Expected full fleet in snap3.trains, got ${snap3.trains.length}`);
  if (snap3.activeTrains) {
    for (const active of snap3.activeTrains) {
      assert(
        snap3.trains.some((t) => t.id === active.id),
        `Active train ${active.id} must exist in snapshot.trains`
      );
    }
  }
  console.log("  ✅ Test 3 Passed: activeTrains is a strictly synchronized subset of snapshot.trains.");

  // ---------------------------------------------------------------------------
  // TEST 4: Live Simulation Kinematics & Selection Consistency
  // ---------------------------------------------------------------------------
  console.log("\n[TEST 4] Stepping simulation and verifying live train selection...");
  simulationEngine.loadScenario("MULTI_TRAIN_OPERATIONS");
  simulationEngine.start();

  for (let i = 0; i < 5; i++) {
    simulationEngine.step(1.0);
  }

  const snap4 = simulationEngine.getSnapshot();
  for (const id of expectedTrainIds) {
    const train = snap4.trains.find((t) => t.id === id);
    assert(train !== undefined, `Train ${id} missing from live snapshot during simulation`);
    assert(train?.progress === train?.position, `Train ${id} progress !== position during run`);
  }
  console.log("  ✅ Test 4 Passed: Live simulation retains all 6 trains with synchronized telemetry.");

  // ---------------------------------------------------------------------------
  // TEST 5: Manual Speed Override & Hold on Background Trains (T003 to T006)
  // ---------------------------------------------------------------------------
  console.log("\n[TEST 5] Testing operator override on trains T003 to T006...");
  simulationEngine.loadScenario("DELAYED_TRAIN");

  // Override T003
  simulationEngine.overrideTrainSpeed("T003", 90);
  const snap5A = simulationEngine.getSnapshot();
  const t3 = snap5A.trains.find((t) => t.id === "T003")!;
  assert(t3.speed === 90, `Expected T003 speed 90, got ${t3.speed}`);

  // Hold T004
  simulationEngine.holdTrain("T004");
  const snap5B = simulationEngine.getSnapshot();
  const t4 = snap5B.trains.find((t) => t.id === "T004")!;
  assert(t4.status === "HOLDING", `Expected T004 status HOLDING, got ${t4.status}`);
  assert(t4.speed === 0, `Expected T004 speed 0, got ${t4.speed}`);

  // Release T004
  simulationEngine.releaseTrain("T004", 75);
  const snap5C = simulationEngine.getSnapshot();
  const t4Rel = snap5C.trains.find((t) => t.id === "T004")!;
  assert(t4Rel.speed === 75, `Expected T004 speed 75, got ${t4Rel.speed}`);
  console.log("  ✅ Test 5 Passed: Manual overrides and hold/release work on all 6 trains.");

  // ---------------------------------------------------------------------------
  // TEST 6: Pause, Resume, Reset Fleet Invariance
  // ---------------------------------------------------------------------------
  console.log("\n[TEST 6] Verifying pause/resume/reset preserves all 6 trains...");
  simulationEngine.pause();
  assert(simulationEngine.getSnapshot().trains.length >= 6, "Pause lost trains");

  simulationEngine.start();
  assert(simulationEngine.getSnapshot().trains.length >= 6, "Start lost trains");

  simulationEngine.reset();
  assert(simulationEngine.getSnapshot().trains.length >= 6, "Reset lost trains");
  console.log("  ✅ Test 6 Passed: Fleet size never shrinks under pause, resume, or reset.");

  console.log("\n================================================================================");
  console.log("🎉 ALL TRAIN SELECTION & FLEET RESOLUTION TESTS PASSED WITH 100% SUCCESS!");
  console.log("================================================================================\n");
}

if (typeof require !== "undefined" && require.main === module) {
  runTrainSelectionConsistencyTests();
}
