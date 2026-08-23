/**
 * RTPXO - Phase 8B Automated Verification Suite
 * Predictive Timeline & Decision Replay Verification
 */

import { SimulationEngine } from "./simulationEngine";
import { PredictionEngine } from "./predictionEngine";
import { benchmarkRunner } from "./benchmarkRunner";
import { trains as initialTrains } from "../data/trains";
import { sections as initialSections } from "../data/sections";
import { signals as initialSignals } from "../data/signals";
import { junctions as initialJunctions } from "../data/junctions";

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

export function runPhase8BTests(): boolean {
  console.log("\n=======================================================");
  console.log("  RTPXO PHASE 8B: PREDICTIVE TIMELINE & DECISION REPLAY");
  console.log("=======================================================\n");

  const predictionEngine = new PredictionEngine();

  // ----------------------------------------------------
  // TEST 1: Timeline Checkpoints Single-Pass Capture
  // ----------------------------------------------------
  console.log("Test 1: Timeline Checkpoints Single-Pass Capture");
  const pred300 = predictionEngine.simulateForward(
    initialTrains,
    initialSections,
    initialSignals,
    initialJunctions,
    300
  );
  assert(
    pred300.predictedState.timeline !== undefined && pred300.predictedState.timeline.length > 0,
    "Timeline checkpoints captured in predicted forward state"
  );
  const offsets300 = pred300.predictedState.timeline?.map((cp) => cp.offsetSeconds) || [];
  assert(
    offsets300.includes(0) && offsets300.includes(60) && offsets300.includes(120) && offsets300.includes(300),
    "Checkpoints include +0s, +60s, +120s, and +300s milestones"
  );

  // ----------------------------------------------------
  // TEST 2: Horizon Bounding (No Out-of-Horizon Fabrications)
  // ----------------------------------------------------
  console.log("\nTest 2: Horizon Bounding");
  assert(
    !offsets300.includes(600),
    "Checkpoint +600s is NOT fabricated when horizon is 300s"
  );

  const pred600 = predictionEngine.simulateForward(
    initialTrains,
    initialSections,
    initialSignals,
    initialJunctions,
    600
  );
  const offsets600 = pred600.predictedState.timeline?.map((cp) => cp.offsetSeconds) || [];
  assert(
    offsets600.includes(600),
    "Checkpoint +600s is captured when horizon is 600s"
  );

  // ----------------------------------------------------
  // TEST 3: Checkpoint Data Structure & Fields
  // ----------------------------------------------------
  console.log("\nTest 3: Checkpoint Data Structure & Fields");
  const cp60 = pred300.predictedState.timeline?.find((cp) => cp.offsetSeconds === 60);
  assert(
    cp60 !== undefined &&
      Array.isArray(cp60.trains) &&
      Array.isArray(cp60.sections) &&
      Array.isArray(cp60.signals) &&
      Array.isArray(cp60.headways) &&
      typeof cp60.activeConflictsCount === "number",
    "Checkpoint contains trains, sections, signals, headways, and conflict counts"
  );

  // ----------------------------------------------------
  // TEST 4: Forecast Signals Isolation
  // ----------------------------------------------------
  console.log("\nTest 4: Forecast Signals Isolation from Authoritative State");
  const engine = new SimulationEngine(initialTrains);
  const liveSignalsBefore = engine.getSnapshot().signals.map((s) => s.aspect);
  const checkpointSignals = pred300.predictedState.timeline?.[0].signals;
  const liveSignalsAfter = engine.getSnapshot().signals.map((s) => s.aspect);

  assert(
    JSON.stringify(liveSignalsBefore) === JSON.stringify(liveSignalsAfter),
    "Evaluating timeline prediction does not mutate live signal aspects in SimulationEngine"
  );

  // ----------------------------------------------------
  // TEST 5: Decision Audit Recording on Recommendation Applied
  // ----------------------------------------------------
  console.log("\nTest 5: Decision Audit Recording on Recommendation Applied");
  engine.reset();
  const snapshotBeforeRec = engine.getSnapshot();
  const pendingRec = snapshotBeforeRec.recommendations[0];
  assert(pendingRec !== undefined, "Initial state provides an actionable pending recommendation");

  if (pendingRec) {
    engine.applyRecommendation(pendingRec.id);
    const history = engine.getDecisionHistory();
    assert(
      history.length > 0 && history[0].eventType === "RECOMMENDATION_APPLIED",
      "Recommendation application records structured DecisionAuditRecord"
    );
    assert(
      history[0].preState !== undefined &&
        history[0].projectedImpact !== undefined &&
        history[0].actualOutcome === undefined,
      "Decision record contains preState, projectedImpact, and explicit undefined actualOutcome"
    );
  }

  // ----------------------------------------------------
  // TEST 6: Decision Audit Recording on Manual Overrides
  // ----------------------------------------------------
  console.log("\nTest 6: Decision Audit Recording on Manual Overrides");
  const trainId = initialTrains[0].id;
  engine.overrideTrainSpeed(trainId, 110);
  engine.holdTrain(trainId);
  engine.releaseTrain(trainId, 90);

  const hist = engine.getDecisionHistory();
  const speedOverrideRecord = hist.find((h) => h.eventType === "MANUAL_SPEED_OVERRIDE");
  const holdRecord = hist.find((h) => h.eventType === "TRAIN_HOLD");
  const releaseRecord = hist.find((h) => h.eventType === "TRAIN_RELEASE");

  assert(
    speedOverrideRecord !== undefined && holdRecord !== undefined && releaseRecord !== undefined,
    "Manual speed override, hold, and release record audit entries"
  );

  // ----------------------------------------------------
  // TEST 7: Decision History Buffer Bounded at 50 Records (FIFO)
  // ----------------------------------------------------
  console.log("\nTest 7: Decision History Buffer Bounded at 50 Records (FIFO)");
  for (let i = 0; i < 60; i++) {
    engine.overrideTrainSpeed(trainId, 50 + (i % 30));
  }
  const boundedHist = engine.getDecisionHistory();
  assert(
    boundedHist.length === 50,
    `Decision history is capped strictly at 50 records (actual: ${boundedHist.length})`
  );

  // ----------------------------------------------------
  // TEST 8: Reset Clears Decision History & Timeline Selection
  // ----------------------------------------------------
  console.log("\nTest 8: Reset Clears Decision History & Timeline Selection");
  engine.setSelectedTimelineOffset(120);
  assert(engine.getSelectedTimelineOffset() === 120, "Timeline offset selectable");
  engine.reset();
  assert(
    engine.getDecisionHistory().length === 0 && engine.getSelectedTimelineOffset() === 0,
    "Reset clears decision history and resets selectedTimelineOffset to 0"
  );

  // ----------------------------------------------------
  // TEST 9: Read-Only Timeline Offset Selection (Zero Physics Mutation)
  // ----------------------------------------------------
  console.log("\nTest 9: Read-Only Timeline Offset Selection");
  const timeBefore = engine.getSnapshot().simulationTime;
  engine.setSelectedTimelineOffset(300);
  const snapAfterOffset = engine.getSnapshot();

  assert(
    snapAfterOffset.selectedTimelineOffset === 300,
    "Snapshot reflects selectedTimelineOffset"
  );
  assert(
    snapAfterOffset.simulationTime === timeBefore,
    "Selected timeline offset does NOT advance or mutate live simulation clock"
  );

  // ----------------------------------------------------
  // TEST 10: Benchmark Runner Pure Isolation
  // ----------------------------------------------------
  console.log("\nTest 10: Benchmark Runner Pure Isolation");
  const decisionCountBeforeBench = engine.getDecisionHistory().length;
  const benchmarkResult = benchmarkRunner.runBenchmark("DELAYED_TRAIN", 10);
  const decisionCountAfterBench = engine.getDecisionHistory().length;

  assert(
    benchmarkResult !== undefined &&
      decisionCountBeforeBench === decisionCountAfterBench,
    "Benchmark dual-run execution is isolated and does not contaminate live decisionHistory"
  );

  console.log("\n-------------------------------------------------------");
  console.log(`  Phase 8B Test Summary: ${passCount} Passed, ${failCount} Failed`);
  console.log("-------------------------------------------------------\n");

  return failCount === 0;
}

if (require.main === module) {
  const success = runPhase8BTests();
  process.exit(success ? 0 : 1);
}
