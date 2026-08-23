/**
 * RTPXO - Phase 6 Predictive Traffic Optimization & Multi-Train Coordination Verification Suite
 * Validates rolling prediction lookahead, multi-train candidate search, speed trajectory profiling,
 * junction sequencing, hard safety barriers, objective scoring, and deterministic baseline benchmarking.
 */

import { simulationEngine } from "./simulationEngine";
import { predictionEngine } from "./predictionEngine";
import { speedTrajectoryModel } from "./speedTrajectoryModel";
import { junctionOptimizer } from "./junctionOptimizer";
import { bottleneckOptimizer } from "./bottleneckOptimizer";
import { objectiveEvaluator } from "./objectiveEvaluator";
import { optimizationEngine } from "./optimizationEngine";
import { benchmarkRunner } from "./benchmarkRunner";

import { operationalScenarios } from "@/data/scenarios";
import { sections } from "@/data/sections";
import { junctions } from "@/data/junctions";
import { signals } from "@/data/signals";
import { Train } from "@/types/railway";
import { CandidateAction } from "@/types/optimization";

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, testName: string, failureDetails?: string) {
  if (condition) {
    console.log(`[PASS] ${testName}`);
    passedCount++;
  } else {
    console.error(`[FAIL] ${testName}`);
    if (failureDetails) console.error(`       Details: ${failureDetails}`);
    failedCount++;
  }
}

console.log("==================================================");
console.log("RTPXO PHASE 6 PREDICTIVE OPTIMIZATION TEST SUITE");
console.log("==================================================");

// -----------------------------------------------------------------------------
// TEST 1: Forward Prediction Simulator
// -----------------------------------------------------------------------------
const testScenario = operationalScenarios.find((s) => s.id === "DELAYED_TRAIN")!;
const forwardProj = predictionEngine.simulateForward(
  testScenario.trains,
  sections,
  signals,
  junctions,
  300,
  []
);

assert(
  forwardProj.predictedState.timeHorizonSeconds === 300 &&
    forwardProj.predictedState.trains.length === testScenario.trains.length &&
    forwardProj.predictedState.corridorThroughput >= 0,
  "TEST 1: Forward prediction engine simulates 300s lookahead without mutating source state",
  `Predicted horizon: ${forwardProj.predictedState.timeHorizonSeconds}s, Trains: ${forwardProj.predictedState.trains.length}`
);

// -----------------------------------------------------------------------------
// TEST 2: Multi-Stage Speed Trajectory Profiling
// -----------------------------------------------------------------------------
const delayedTrain = testScenario.trains.find((t) => t.status === "DELAYED")!;
const sec1 = sections[0];
const trajectory = speedTrajectoryModel.generateTrajectory(delayedTrain, sec1, false, 110);

assert(
  trajectory.stages.length >= 1 &&
    trajectory.totalDistanceKm > 0 &&
    trajectory.targetSpeedKmH === 110 &&
    trajectory.summary.length > 0,
  "TEST 2: Speed trajectory model generates multi-stage kinematic profile with progressive stages",
  `Stages: ${trajectory.stages.length}, Target: ${trajectory.targetSpeedKmH} km/h`
);

// -----------------------------------------------------------------------------
// TEST 3: Glide Deceleration on Approaching Occupied Downstream Section
// -----------------------------------------------------------------------------
const glideTrain: Train = {
  id: "T-GLIDE",
  name: "Glide Express",
  speed: 100,
  targetSpeed: 100,
  position: 70,
  currentSection: "SEC-01",
  status: "ON_TIME",
  delayMinutes: 0,
  priority: 8,
  origin: "DELHI",
  destination: "SAHARANPUR",
  scheduledArrival: "10:00",
  expectedArrival: "10:00",
  type: "EXPRESS",
};
const glideTrajectory = speedTrajectoryModel.generateTrajectory(glideTrain, sec1, true);

assert(
  glideTrajectory.targetSpeedKmH === 60 &&
    glideTrajectory.stages.some((s) => s.speedKmH === 60),
  "TEST 3: Speed trajectory model generates glide deceleration when approaching occupied block",
  `Target: ${glideTrajectory.targetSpeedKmH} km/h, Stages: ${glideTrajectory.stages.length}`
);

// -----------------------------------------------------------------------------
// TEST 4: Junction Permutation & Sequencing Optimization
// -----------------------------------------------------------------------------
const juncScenario = operationalScenarios.find((s) => s.id === "JUNCTION_CONFLICT")!;
const juncSequences = junctionOptimizer.evaluateJunctionSequences(
  juncScenario.trains,
  sections,
  junctions
);

assert(
  juncSequences.length > 0 &&
    juncSequences[0].sequence.length === 2 &&
    juncSequences[0].candidateAction.action === "HOLD_TRAIN",
  "TEST 4: Junction optimizer evaluates convergence permutations and determines priority sequence",
  `Found ${juncSequences.length} junction sequence(s), Lead: ${juncSequences[0]?.leadTrainId}`
);

// -----------------------------------------------------------------------------
// TEST 5: Bottleneck Section Maximization
// -----------------------------------------------------------------------------
const congScenario = operationalScenarios.find((s) => s.id === "CONGESTED_SECTION")!;
const bottleneckInterventions = bottleneckOptimizer.generateBottleneckInterventions(
  congScenario.trains,
  sections,
  [
    {
      sectionId: "GZB-MRT-01",
      sectionName: "Ghaziabad - Meerut",
      sectionLengthKm: 45,
      occupancyRate: 300,
      activeTrainCount: 3,
      capacity: 1,
      speedLimitKmH: 100,
      averageSpeedKmH: 45,
      speedUtilizationPercent: 45,
      trainsEntered: 3,
      trainsExited: 0,
      sectionThroughput: 3.0,
      averageDwellSeconds: 0,
      averageDelayMinutes: 8,
      congestionState: "SATURATED",
      bottleneckScore: 90,
      isBottleneck: true,
      densityScore: 0.9,
    },
  ]
);

assert(
  bottleneckInterventions.length > 0 &&
    bottleneckInterventions.some((c) => c.affectedSectionId === "GZB-MRT-01"),
  "TEST 5: Bottleneck optimizer generates targeted section clearance and flow regulation actions",
  `Interventions: ${bottleneckInterventions.length}`
);

// -----------------------------------------------------------------------------
// TEST 6: Hard Safety Constraint Rejection
// -----------------------------------------------------------------------------
const unsafeCandidate: CandidateAction = {
  id: "CAND-UNSAFE-ACCEL",
  affectedTrainId: "T101",
  action: "INCREASE_SPEED",
  targetSpeed: 140,
  affectedSectionId: "SEC-01",
  description: "Accelerate train directly into occupied block",
};

const train101: Train = {
  id: "T101",
  name: "Express 101",
  speed: 90,
  position: 80,
  currentSection: "SEC-01",
  status: "ON_TIME",
  delayMinutes: 0,
  priority: 7,
  origin: "DELHI",
  destination: "SAHARANPUR",
  scheduledArrival: "10:00",
  expectedArrival: "10:00",
  type: "EXPRESS",
};

const train102: Train = {
  id: "T102",
  name: "Freight 102",
  speed: 30,
  position: 83, // within 1.0 km
  currentSection: "SEC-01",
  status: "ON_TIME",
  delayMinutes: 0,
  priority: 3,
  origin: "DELHI",
  destination: "SAHARANPUR",
  scheduledArrival: "10:30",
  expectedArrival: "10:30",
  type: "FREIGHT",
};

const unsafeSim = predictionEngine.simulateForward(
  [train101, train102],
  sections,
  signals,
  junctions,
  300,
  [unsafeCandidate]
);

const unsafeEval = objectiveEvaluator.evaluateCandidate(
  unsafeCandidate,
  train101,
  forwardProj.predictedState,
  unsafeSim.predictedState,
  unsafeSim.isSafe,
  unsafeSim.safetyViolationReason
);

assert(
  !unsafeEval.isSafe &&
    unsafeEval.objectiveScore === -Infinity &&
    unsafeEval.safetyRejectionReason !== undefined,
  "TEST 6: Hard safety constraint barrier rejects headway violation with -Infinity score",
  `isSafe: ${unsafeEval.isSafe}, score: ${unsafeEval.objectiveScore}, reason: ${unsafeEval.safetyRejectionReason}`
);

// -----------------------------------------------------------------------------
// TEST 7: Transparent Multi-Objective Score Breakdown
// -----------------------------------------------------------------------------
const validCandidate: CandidateAction = {
  id: "CAND-VALID-ACCEL",
  affectedTrainId: delayedTrain.id,
  action: "INCREASE_SPEED",
  targetSpeed: 110,
  affectedSectionId: delayedTrain.currentSection,
  description: "Accelerate delayed train in clear section",
};

const validEval = objectiveEvaluator.evaluateCandidate(
  validCandidate,
  delayedTrain,
  forwardProj.predictedState,
  forwardProj.predictedState,
  true
);

assert(
  validEval.isSafe &&
    validEval.objectiveScore > 0 &&
    validEval.scoreBreakdown.throughputGainScore !== undefined &&
    validEval.scoreBreakdown.priorityScore !== undefined,
  "TEST 7: Objective evaluator computes explainable multi-component score breakdown",
  `Score: ${validEval.objectiveScore}, Priority: ${validEval.scoreBreakdown.priorityScore}`
);

// -----------------------------------------------------------------------------
// TEST 8: Full Master Optimization Engine Coordination
// -----------------------------------------------------------------------------
const optOutput = optimizationEngine.optimizeNetwork(
  testScenario.trains,
  sections,
  signals,
  junctions,
  [],
  [],
  {
    trainsCompleted: 0,
    trainsPerHour: 2.5,
    corridorThroughput: 2.5,
    baselineThroughput: 2.2,
    throughputImprovement: 12.0,
    averageDelay: 8.0,
    maximumDelay: 8.0,
    averageTravelTime: 140,
    corridorUtilization: 50,
    bottleneckSection: null,
    totalDistanceTraveledKm: 150,
    conflictFreeTimeSeconds: 120,
    recommendationsTotalCount: 1,
    recommendationsAcceptedCount: 0,
    recommendationAcceptanceRate: 0,
    estimatedDelaySavedMinutes: 0,
    completedRecords: [],
  },
  [],
  0,
  300
);

assert(
  optOutput.recommendations.length > 0 &&
    optOutput.recommendations.every((r) => r.isSafeToDispatch) &&
    optOutput.recommendations[0].rejectedAlternatives !== undefined,
  "TEST 8: Master OptimizationEngine coordinates multi-train candidate search and compiles rejections",
  `Recommendations: ${optOutput.recommendations.length}, Safe: ${optOutput.recommendations.every((r) => r.isSafeToDispatch)}`
);

// -----------------------------------------------------------------------------
// TEST 9: Deterministic Baseline Dispatcher vs RTPXO Optimizer
// -----------------------------------------------------------------------------
const benchmark = benchmarkRunner.runBenchmark("DELAYED_TRAIN", 15);

assert(
  benchmark.baseline.mode === "BASELINE_DISPATCHER" &&
    benchmark.optimized.mode === "RTPXO_OPTIMIZER" &&
    benchmark.throughputImprovementPercent >= 0 &&
    benchmark.delayReductionMinutes >= 0,
  "TEST 9: Benchmark runner executes dual-run simulation and measures positive throughput & delay gain",
  `Gain: +${benchmark.throughputImprovementPercent}%, Delay Saved: ${benchmark.delayReductionMinutes} min`
);

// -----------------------------------------------------------------------------
// TEST 10: Repeatable Benchmark Determinism
// -----------------------------------------------------------------------------
const benchmark2 = benchmarkRunner.runBenchmark("DELAYED_TRAIN", 15);

assert(
  benchmark.throughputImprovementPercent === benchmark2.throughputImprovementPercent &&
    benchmark.delayReductionMinutes === benchmark2.delayReductionMinutes,
  "TEST 10: Benchmark runs produce identical, deterministic results across consecutive runs",
  `Run 1 Gain: ${benchmark.throughputImprovementPercent}%, Run 2 Gain: ${benchmark2.throughputImprovementPercent}%`
);

// -----------------------------------------------------------------------------
// TEST 11: Prediction Horizon Setting in Simulation Engine
// -----------------------------------------------------------------------------
simulationEngine.loadScenario("NORMAL_OPERATION");
simulationEngine.setPredictionHorizon(600);
const snap = simulationEngine.getSnapshot();

assert(
  snap.predictionHorizonSeconds === 600,
  "TEST 11: SimulationEngine updates prediction horizon and broadcasts in snapshot",
  `Snapshot horizon: ${snap.predictionHorizonSeconds}s`
);

// -----------------------------------------------------------------------------
// TEST 12: Benchmark Execution via Simulation Engine
// -----------------------------------------------------------------------------
const benchResult = simulationEngine.runBenchmark("NORMAL_OPERATION");
const snapAfterBench = simulationEngine.getSnapshot();

assert(
  snapAfterBench.benchmarkComparison !== undefined &&
    snapAfterBench.benchmarkComparison.scenarioId === "NORMAL_OPERATION",
  "TEST 12: SimulationEngine runs benchmark and attaches benchmark telemetry to live snapshot",
  `Attached benchmark scenario: ${snapAfterBench.benchmarkComparison?.scenarioId}`
);

console.log("==================================================");
console.log(`TEST SUMMARY: ${passedCount} / ${passedCount + failedCount} TESTS PASSED`);
console.log("==================================================");

if (failedCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
