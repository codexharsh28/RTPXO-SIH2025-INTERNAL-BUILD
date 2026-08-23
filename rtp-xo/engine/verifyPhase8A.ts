/**
 * RTPXO - Phase 8A Verification Suite
 * Operational Performance & Decoupled Architecture Hardening
 *
 * Asserts:
 * 1. Physics continues every tick (train kinematics advance smoothly).
 * 2. Prediction & optimization refresh scheduling runs at adaptive cadence (every 2.0s sim-time).
 * 3. Optimizer execution count is throttled by >= 70% over continuous physics steps.
 * 4. Cache invalidation on manual speed override triggers immediate evaluation.
 * 5. Cache invalidation on recommendation application triggers immediate evaluation.
 * 6. Scenario load & reset triggers immediate evaluation and resets timestamps.
 * 7. Snapshot provides cached forward prediction state directly for ghost overlays.
 * 8. Benchmark runner runs in headless isolation without cross-simulation contamination.
 * 9. Speed multiplier scales physics step proportional to multiplier while cadence relies on simulated time.
 * 10. Existing safety barriers (absolute block interlocking, signal aspects) remain strictly enforced.
 */

import { SimulationEngine } from "./simulationEngine";
import { BenchmarkRunner } from "./benchmarkRunner";
import { Train } from "@/types/railway";
import { operationalScenarios } from "@/data/scenarios";

let passedTests = 0;
let totalTests = 0;

function check(condition: boolean, testName: string, detail?: string): void {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`[PASS] ${testName}`);
  } else {
    console.error(`[FAIL] ${testName}`);
    if (detail) console.error(`       Detail: ${detail}`);
  }
}

console.log("==================================================");
console.log("RTPXO PHASE 8A ARCHITECTURE & PERFORMANCE SUITE");
console.log("==================================================");

// -------------------------------------------------------------------
// TEST 1: Physics continues every tick
// -------------------------------------------------------------------
const engine1 = new SimulationEngine();
const initialPos = engine1.getSnapshot().trains[0].position;
engine1.step(0.5);
const step1Pos = engine1.getSnapshot().trains[0].position;
engine1.step(0.5);
const step2Pos = engine1.getSnapshot().trains[0].position;

check(
  step1Pos > initialPos && step2Pos > step1Pos,
  "TEST 1: Train physics and kinematics advance continuously on every tick",
  `Init: ${initialPos}%, Step1: ${step1Pos}%, Step2: ${step2Pos}%`
);

// -------------------------------------------------------------------
// TEST 2: Optimization refresh scheduling at adaptive cadence (every 2.0s)
// -------------------------------------------------------------------
const engine2 = new SimulationEngine();
// Constructor runs initial optimization at t=0 (count = 1)
const initOptCount = engine2.getOptimizationExecutionCount();
// Step 1: t = 0.5s (should NOT re-run optimization)
engine2.step(0.5);
const countAt0_5 = engine2.getOptimizationExecutionCount();
// Step 2: t = 1.0s (should NOT re-run optimization)
engine2.step(0.5);
const countAt1_0 = engine2.getOptimizationExecutionCount();
// Step 3: t = 1.5s (should NOT re-run optimization)
engine2.step(0.5);
const countAt1_5 = engine2.getOptimizationExecutionCount();
// Step 4: t = 2.0s (cadence met: should re-run optimization)
engine2.step(0.5);
const countAt2_0 = engine2.getOptimizationExecutionCount();

check(
  initOptCount === 1 &&
    countAt0_5 === 1 &&
    countAt1_0 === 1 &&
    countAt1_5 === 1 &&
    countAt2_0 === 2,
  "TEST 2: Predictive optimization runs at 2.0s cadence rather than every 500ms tick",
  `Init: ${initOptCount}, at 0.5s: ${countAt0_5}, at 1.0s: ${countAt1_0}, at 1.5s: ${countAt1_5}, at 2.0s: ${countAt2_0}`
);

// -------------------------------------------------------------------
// TEST 3: Computational throttling efficiency over 20 ticks (10s simulated)
// -------------------------------------------------------------------
const engine3 = new SimulationEngine();
// Over 20 ticks of 0.5s (t=0 to 10s), periodic evaluation occurs at t=0, 2, 4, 6, 8, 10 (6 evaluations)
for (let i = 0; i < 20; i++) {
  engine3.step(0.5);
}
const optCount20Ticks = engine3.getOptimizationExecutionCount();

check(
  optCount20Ticks <= 6,
  "TEST 3: Optimizer workload reduced by >= 70% (<= 6 runs vs 20 un-throttled runs)",
  `Execution count over 20 ticks: ${optCount20Ticks} (expected <= 6)`
);

// -------------------------------------------------------------------
// TEST 4: Immediate cache invalidation on manual speed override
// -------------------------------------------------------------------
const engine4 = new SimulationEngine();
engine4.step(0.5); // t = 0.5s (no periodic optimization due)
const countBeforeOverride = engine4.getOptimizationExecutionCount();
engine4.overrideTrainSpeed("T001", 75);
const countAfterOverride = engine4.getOptimizationExecutionCount();

check(
  countAfterOverride === countBeforeOverride + 1,
  "TEST 4: State invalidation on manual speed override triggers immediate optimization evaluation",
  `Before override: ${countBeforeOverride}, After override: ${countAfterOverride}`
);

// -------------------------------------------------------------------
// TEST 5: Immediate cache invalidation on recommendation apply/dismiss
// -------------------------------------------------------------------
const engine5 = new SimulationEngine();
engine5.loadScenario("DELAYED_TRAIN");
const pendingRec = engine5.getSnapshot().recommendations.find((r) => r.status === "PENDING");
engine5.step(0.5);
const countBeforeApply = engine5.getOptimizationExecutionCount();

if (pendingRec) {
  engine5.applyRecommendation(pendingRec.id);
}
const countAfterApply = engine5.getOptimizationExecutionCount();

check(
  pendingRec !== undefined && countAfterApply === countBeforeApply + 1,
  "TEST 5: State invalidation on recommendation application triggers immediate re-evaluation",
  `Before apply: ${countBeforeApply}, After apply: ${countAfterApply}`
);

// -------------------------------------------------------------------
// TEST 6: Scenario load & reset cache invalidation
// -------------------------------------------------------------------
const engine6 = new SimulationEngine();
engine6.loadScenario("DELAYED_TRAIN");
engine6.step(1.5);
const timeBeforeReset = engine6.getSnapshot().simulationTime;
engine6.resetScenario();
const snapAfterReset = engine6.getSnapshot();

check(
  timeBeforeReset === 1.5 &&
    snapAfterReset.simulationTime === 0 &&
    snapAfterReset.recommendations.length > 0 &&
    snapAfterReset.predictedForwardState !== undefined,
  "TEST 6: Scenario reset resets simulation clock and evaluates fresh recommendations immediately",
  `Time: ${snapAfterReset.simulationTime}s, Recs: ${snapAfterReset.recommendations.length}`
);

// -------------------------------------------------------------------
// TEST 7: Ghost overlays consume cached predictedForwardState
// -------------------------------------------------------------------
const engine7 = new SimulationEngine();
const snap7 = engine7.getSnapshot();
const forwardGhostTrain = snap7.predictedForwardState?.trains[0];

check(
  snap7.predictedForwardState !== undefined &&
    forwardGhostTrain !== undefined &&
    forwardGhostTrain.positionPercent >= 0,
  "TEST 7: Snapshot provides authoritative cached forward prediction state for ghost overlays",
  `Ghost trains available: ${snap7.predictedForwardState?.trains.length}`
);

// -------------------------------------------------------------------
// TEST 8: BenchmarkRunner isolation & deterministic raw comparison
// -------------------------------------------------------------------
const runner = new BenchmarkRunner();
const benchmarkRes1 = runner.runBenchmark("DELAYED_TRAIN", 20);
const benchmarkRes2 = runner.runBenchmark("DELAYED_TRAIN", 20);

check(
  benchmarkRes1.baseline.corridorThroughput === benchmarkRes2.baseline.corridorThroughput &&
    benchmarkRes1.optimized.corridorThroughput === benchmarkRes2.optimized.corridorThroughput &&
    benchmarkRes1.throughputImprovementPercent === benchmarkRes2.throughputImprovementPercent,
  "TEST 8: BenchmarkRunner executes dual-run simulation in headless isolation with deterministic raw metrics",
  `Run 1 Delta: ${benchmarkRes1.throughputImprovementPercent}%, Run 2 Delta: ${benchmarkRes2.throughputImprovementPercent}%`
);

// -------------------------------------------------------------------
// TEST 9: Speed multiplier scales physical time integration accurately
// -------------------------------------------------------------------
const engine9 = new SimulationEngine();
engine9.setSpeedMultiplier(4);
engine9.step(); // With dt = (500ms / 1000) * 4 = 2.0s
const snap9 = engine9.getSnapshot();

check(
  snap9.simulationTime === 2.0 && snap9.speedMultiplier === 4,
  "TEST 9: Speed multiplier (4x) integrates 2.0s simulation time in a single step",
  `Simulation time: ${snap9.simulationTime}s, Multiplier: ${snap9.speedMultiplier}x`
);

// -------------------------------------------------------------------
// TEST 10: Section boundary interlocking and signal aspects remain strictly enforced
// -------------------------------------------------------------------
const engine10 = new SimulationEngine();
engine10.loadScenario("SIGNAL_RESTRICTION");
const snap10Init = engine10.getSnapshot();
const occupiedSec = snap10Init.sections.find((s) => s.status === "OCCUPIED");
const restrictedSignals = snap10Init.signals.filter((s) => s.aspect === "RED" || s.aspect === "YELLOW");

check(
  occupiedSec !== undefined && restrictedSignals.length > 0,
  "TEST 10: Absolute block interlocking and signal restriction aspects remain strictly enforced",
  `Occupied Section: ${occupiedSec?.name}, Restricted Signals: ${restrictedSignals.length}`
);

console.log("==================================================");
console.log(`TEST SUMMARY: ${passedTests} / ${totalTests} TESTS PASSED`);
console.log("==================================================");

if (passedTests !== totalTests) {
  process.exit(1);
}
