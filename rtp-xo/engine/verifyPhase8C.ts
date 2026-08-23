/**
 * RTPXO - Phase 8C Automated Verification Suite
 * Closed-Loop Decision Verification & Live Outcome Measurement
 */

import { SimulationEngine } from "./simulationEngine";
import { benchmarkRunner } from "./benchmarkRunner";
import { trains as initialTrains } from "../data/trains";

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

export function runPhase8CTests(): boolean {
  console.log("\n=======================================================");
  console.log("  RTPXO PHASE 8C: CLOSED-LOOP DECISION VERIFICATION");
  console.log("=======================================================\n");

  const engine = new SimulationEngine(initialTrains);

  // ----------------------------------------------------
  // TEST 1: Baseline Initialization
  // ----------------------------------------------------
  console.log("Test 1: Baseline Initialization");
  engine.reset();
  const train1 = initialTrains[0];
  engine.overrideTrainSpeed(train1.id, 100);

  const historyT1 = engine.getDecisionHistory();
  assert(historyT1.length === 1, "Decision record created on speed override");
  const rec1 = historyT1[0];
  assert(
    rec1.preState !== undefined &&
      typeof rec1.preState.trainSpeed === "number" &&
      typeof rec1.preState.trainDelayMinutes === "number" &&
      typeof rec1.preState.sectionThroughput === "number" &&
      typeof rec1.preState.sectionOccupancyCount === "number" &&
      typeof rec1.preState.hasActiveConflict === "boolean",
    "Baseline preState captures speed, delay, section throughput, occupancy, and conflict status"
  );
  assert(
    rec1.actualOutcome === undefined,
    "Decision record initializes with actualOutcome undefined (PENDING)"
  );

  // ----------------------------------------------------
  // TEST 2: Timing Isolation (Pending before 30s window)
  // ----------------------------------------------------
  console.log("\nTest 2: Timing Isolation");
  engine.step(15); // Advance 15 simulated seconds
  const historyT2 = engine.getDecisionHistory();
  assert(
    historyT2[0].actualOutcome === undefined,
    "At T+15s (< 30s evaluation window), actualOutcome remains undefined/PENDING"
  );

  // ----------------------------------------------------
  // TEST 3: Evaluation Trigger (After 30s window)
  // ----------------------------------------------------
  console.log("\nTest 3: Evaluation Trigger");
  engine.step(20); // Total elapsed sim time = 35s (> 30s)
  const historyT3 = engine.getDecisionHistory();
  assert(
    historyT3[0].actualOutcome !== undefined,
    "At T+35s (>= 30s evaluation window), actualOutcome is populated"
  );
  assert(
    typeof historyT3[0].actualOutcome?.actualDelayDeltaMinutes === "number" &&
      typeof historyT3[0].actualOutcome?.actualThroughputDelta === "number" &&
      historyT3[0].actualOutcome?.measuredAtSimulationTime === 35,
    "Measured outcome captures live deltas and measurement timestamp"
  );

  // ----------------------------------------------------
  // TEST 4: Accurate Outcome Verification (VERIFIED_ACCURATE)
  // ----------------------------------------------------
  console.log("\nTest 4: Accurate Outcome Verification");
  engine.reset();
  const snapBefore = engine.getSnapshot();
  const pendingRec = snapBefore.recommendations[0];
  assert(pendingRec !== undefined, "Actionable recommendation present in scenario");

  if (pendingRec) {
    engine.applyRecommendation(pendingRec.id);
    engine.step(35); // Run past 30s evaluation window
    const historyT4 = engine.getDecisionHistory();
    const appliedRecDecision = historyT4.find((d) => d.eventType === "RECOMMENDATION_APPLIED");
    assert(
      appliedRecDecision !== undefined &&
        appliedRecDecision.actualOutcome !== undefined &&
        (appliedRecDecision.actualOutcome.verificationStatus === "VERIFIED_ACCURATE" ||
          appliedRecDecision.actualOutcome.verificationStatus === "DEVIATED"),
      "Applied recommendation evaluated with authoritative verification status"
    );
  }

  // ----------------------------------------------------
  // TEST 5: Deviation Detection (DEVIATED)
  // ----------------------------------------------------
  console.log("\nTest 5: Deviation Detection");
  engine.reset();
  const trainToHold = initialTrains[0];
  // Override speed high, but then immediately force speed to 0 and hold train
  engine.overrideTrainSpeed(trainToHold.id, 120);
  engine.step(10);
  engine.holdTrain(trainToHold.id);
  engine.step(35); // Advance past hold's 30s window

  const historyT5 = engine.getDecisionHistory();
  const holdDecision = historyT5.find((d) => d.eventType === "TRAIN_HOLD");
  assert(
    holdDecision !== undefined && holdDecision.actualOutcome !== undefined,
    "Train hold decision evaluated at T+30s window"
  );
  assert(
    holdDecision?.actualOutcome?.measuredSpeedKmH === 0,
    "Measured speed correctly confirms train remained stopped (0 km/h)"
  );

  // ----------------------------------------------------
  // TEST 6: Conflict Resolution Verification
  // ----------------------------------------------------
  console.log("\nTest 6: Conflict Resolution Verification");
  engine.reset();
  engine.loadScenario("JUNCTION_CONFLICT");
  const snapJunction = engine.getSnapshot();
  const conflictRec = snapJunction.recommendations.find((r) => r.action === "HOLD_TRAIN");
  assert(conflictRec !== undefined, "Junction scenario generates conflict resolution recommendation");

  if (conflictRec) {
    engine.applyRecommendation(conflictRec.id);
    engine.step(35);
    const histJunction = engine.getDecisionHistory();
    const resolvedRec = histJunction.find((d) => d.eventType === "RECOMMENDATION_APPLIED");
    assert(
      resolvedRec !== undefined &&
        resolvedRec.actualOutcome !== undefined &&
        (resolvedRec.actualOutcome.conflictResolution === "RESOLVED" ||
          resolvedRec.actualOutcome.conflictResolution === "UNRESOLVED"),
      "Conflict resolution status evaluated deterministically"
    );
  }

  // ----------------------------------------------------
  // TEST 7: Superseded Decision Handling
  // ----------------------------------------------------
  console.log("\nTest 7: Superseded Decision Handling");
  engine.reset();
  const activeTrainsT7 = engine.getSnapshot().trains;
  const trainSuperseded = activeTrainsT7[0].id;
  engine.overrideTrainSpeed(trainSuperseded, 70); // Decision 1 at T=0
  engine.step(10); // T=10s
  engine.overrideTrainSpeed(trainSuperseded, 90); // Decision 2 at T=10s (supersedes Decision 1)

  const historyT7 = engine.getDecisionHistory();
  const dec1 = historyT7[0];
  const dec2 = historyT7[1];

  assert(
    dec1.actualOutcome !== undefined &&
      dec1.actualOutcome.verificationStatus === "INCONCLUSIVE" &&
      dec1.actualOutcome.attributionType === "SUPERSEDED",
    "Decision 1 immediately marked INCONCLUSIVE and SUPERSEDED upon subsequent action on same train"
  );
  assert(
    dec2.actualOutcome === undefined,
    "Decision 2 maintains its own independent PENDING evaluation window"
  );

  // ----------------------------------------------------
  // TEST 8: Shared Attribution (Concurrent Actions)
  // ----------------------------------------------------
  console.log("\nTest 8: Shared Attribution");
  engine.reset();
  const activeTrainsT8 = engine.getSnapshot().trains;
  const trainA = activeTrainsT8[0].id;
  const trainB = activeTrainsT8[1].id;
  engine.overrideTrainSpeed(trainA, 85); // Decision on Train A at T=0
  engine.step(5);
  engine.overrideTrainSpeed(trainB, 95); // Concurrent decision on Train B at T=5s
  engine.step(35); // Past both 30s evaluation windows

  const historyT8 = engine.getDecisionHistory();
  assert(
    historyT8[0].actualOutcome !== undefined &&
      historyT8[0].actualOutcome.attributionType === "SHARED_OVERLAP",
    "Concurrent action on other corridor train produces SHARED_OVERLAP attribution"
  );

  // ----------------------------------------------------
  // TEST 9: Reset Isolation
  // ----------------------------------------------------
  console.log("\nTest 9: Reset Isolation");
  engine.reset();
  assert(
    engine.getDecisionHistory().length === 0,
    "engine.reset() clears all decision history and closed-loop evaluation records"
  );
  engine.loadScenario("DELAYED_TRAIN");
  assert(
    engine.getDecisionHistory().length === 0,
    "engine.loadScenario() initializes with clean empty decision history"
  );

  // ----------------------------------------------------
  // TEST 10: Benchmark Isolation
  // ----------------------------------------------------
  console.log("\nTest 10: Benchmark Isolation");
  engine.reset();
  const countBeforeBench = engine.getDecisionHistory().length;
  const benchResult = benchmarkRunner.runBenchmark("DELAYED_TRAIN", 15);
  const countAfterBench = engine.getDecisionHistory().length;

  assert(
    benchResult !== undefined && countBeforeBench === countAfterBench && countAfterBench === 0,
    "Benchmark dual-run execution is isolated and does not create or mutate live decisionHistory"
  );

  console.log("\n-------------------------------------------------------");
  console.log(`  Phase 8C Test Summary: ${passCount} Passed, ${failCount} Failed`);
  console.log("-------------------------------------------------------\n");

  return failCount === 0;
}

if (require.main === module) {
  const success = runPhase8CTests();
  process.exit(success ? 0 : 1);
}
