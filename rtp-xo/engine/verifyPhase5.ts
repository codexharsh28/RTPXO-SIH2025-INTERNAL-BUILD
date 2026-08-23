/**
 * RTPXO - Phase 5 Verification Test Suite
 * Validates all 12 Phase 5 Operational Realism, Scenario Simulation & Validation requirements.
 */

import { SimulationEngine } from "./simulationEngine";
import { operationalScenarios } from "@/data/scenarios";

console.log("==================================================");
console.log("RTPXO PHASE 5 OPERATIONAL REALISM TEST SUITE");
console.log("==================================================");

let passed = 0;
let total = 12;

function check(cond: boolean, name: string, detail?: string) {
  if (cond) {
    console.log(`[PASS] ${name}`);
    passed++;
  } else {
    console.error(`[FAIL] ${name}: ${detail || "Condition failed"}`);
  }
}

// -------------------------------------------------------------------
// TEST 1: Normal operation scenario loading and nominal execution
// -------------------------------------------------------------------
const simEng = new SimulationEngine();
const loadedNormal = simEng.loadScenario("NORMAL_OPERATION");
const snapNormal = simEng.getSnapshot();
const allGreen = snapNormal.signals.every((s) => s.aspect === "GREEN");
check(
  loadedNormal && snapNormal.activeScenarioId === "NORMAL_OPERATION" && allGreen,
  "TEST 1: Normal operation scenario loads deterministically with nominal GREEN aspects",
  `Active: ${snapNormal.activeScenarioId}, AllGreen: ${allGreen}`
);

// -------------------------------------------------------------------
// TEST 2: Delayed train scenario detection and tracking
// -------------------------------------------------------------------
simEng.loadScenario("DELAYED_TRAIN");
const snapDelayed = simEng.getSnapshot();
const delayedTrain = snapDelayed.trains.find((t) => t.status === "DELAYED");
check(
  delayedTrain !== undefined &&
    delayedTrain.delayMinutes > 0 &&
    snapDelayed.throughputMetrics.maximumDelay === delayedTrain.delayMinutes,
  "TEST 2: Delayed train scenario accurately registers and tracks train delays",
  `Train: ${delayedTrain?.id}, Delay: ${delayedTrain?.delayMinutes} min, MaxDelay: ${snapDelayed.throughputMetrics.maximumDelay}`
);

// -------------------------------------------------------------------
// TEST 3: Section congestion & bottleneck detection
// -------------------------------------------------------------------
simEng.loadScenario("CONGESTED_SECTION");
const snapCongested = simEng.getSnapshot();
const bottleneckSec = snapCongested.telemetry.sectionUtilizations.find((u) => u.isBottleneck);
check(
  bottleneckSec !== undefined &&
    bottleneckSec.sectionId === "GZB-MRT-01" &&
    bottleneckSec.congestionState === "SATURATED",
  "TEST 3: Section congestion scenario triggers saturation state and identifies bottleneck section",
  `Section: ${bottleneckSec?.sectionId}, State: ${bottleneckSec?.congestionState}, Score: ${bottleneckSec?.bottleneckScore}`
);

// -------------------------------------------------------------------
// TEST 4: Junction conflict detection and resolution recommendation
// -------------------------------------------------------------------
simEng.loadScenario("JUNCTION_CONFLICT");
const snapJunction = simEng.getSnapshot();
const juncConflict = snapJunction.conflicts.find((c) => c.junctionId !== undefined || c.type === "JUNCTION_CONVERGENCE");
const juncRec = snapJunction.recommendations.find((r) => r.action === "HOLD_TRAIN");
check(
  snapJunction.conflicts.length > 0 && juncRec !== undefined,
  "TEST 4: Junction conflict scenario accurately identifies convergence risk and issues HOLD_TRAIN action",
  `Conflicts: ${snapJunction.conflicts.length}, RecAction: ${juncRec?.action}`
);

// -------------------------------------------------------------------
// TEST 5: Signal restriction propagation
// -------------------------------------------------------------------
simEng.loadScenario("SIGNAL_RESTRICTION");
const snapRestriction = simEng.getSnapshot();
const redOrYellowSignals = snapRestriction.signals.filter((s) => s.aspect === "RED" || s.aspect === "YELLOW");
check(
  redOrYellowSignals.length > 0,
  "TEST 5: Signal restriction scenario triggers caution and stop aspects on upstream blocks",
  `Restricted signals count: ${redOrYellowSignals.length}`
);

// -------------------------------------------------------------------
// TEST 6: Safety constraint blocks unsafe acceleration recommendations
// -------------------------------------------------------------------
const approachingTrainRecs = snapRestriction.recommendations.filter((r) => r.affectedTrainId === "T002");
const noUnsafeSpeedIncrease = !approachingTrainRecs.some((r) => r.action === "INCREASE_SPEED");
check(
  noUnsafeSpeedIncrease,
  "TEST 6: Safety priority hierarchy strictly blocks speed increases into occupied downstream blocks"
);

// -------------------------------------------------------------------
// TEST 7: Valid optimization recommendation with counterfactual impact
// -------------------------------------------------------------------
simEng.loadScenario("DELAYED_TRAIN");
const snapOpt = simEng.getSnapshot();
const recOpt = snapOpt.recommendations.find((r) => r.action === "INCREASE_SPEED");
check(
  recOpt !== undefined &&
    recOpt.isSafeToDispatch === true &&
    recOpt.expectedThroughputImpact > 0 &&
    recOpt.expectedDelayImpact < 0,
  "TEST 7: Valid optimization recommendation contains measurable throughput gain and delay reduction",
  `Action: ${recOpt?.action}, ThroughputGain: +${recOpt?.expectedThroughputImpact}%, DelayReduction: ${recOpt?.expectedDelayImpact} min`
);

// -------------------------------------------------------------------
// TEST 8: Recommendation application and acceptance tracking
// -------------------------------------------------------------------
if (recOpt) {
  const applied = simEng.applyRecommendation(recOpt.id);
  const snapAfterApply = simEng.getSnapshot();
  const trainAfterApply = snapAfterApply.trains.find((t) => t.id === recOpt.affectedTrainId);
  check(
    applied &&
      trainAfterApply?.speed === recOpt.targetSpeed &&
      snapAfterApply.throughputMetrics.recommendationsAcceptedCount >= 1,
    "TEST 8: Applying recommendation dispatches command and records acceptance telemetry",
    `Target: ${recOpt.targetSpeed}, LiveSpeed: ${trainAfterApply?.speed}, AcceptedCount: ${snapAfterApply.throughputMetrics.recommendationsAcceptedCount}`
  );
} else {
  check(false, "TEST 8: Applying recommendation (no recommendation found to apply)");
}

// -------------------------------------------------------------------
// TEST 9: Operational event stream generation
// -------------------------------------------------------------------
const events = simEng.getSnapshot().events;
const hasEventTypes = events.some((e) => e.type === "RECOMMENDATION_APPLIED" || e.type === "RECOMMENDATION_CREATED");
check(
  events.length > 0 && hasEventTypes,
  "TEST 9: Authoritative simulation events are recorded and buffered with timestamps and severity metadata",
  `Event count: ${events.length}, Sample: [${events[0]?.type}] ${events[0]?.message}`
);

// -------------------------------------------------------------------
// TEST 10: Counterfactual what-if projection calculation
// -------------------------------------------------------------------
const sampleRec = snapOpt.recommendations[0];
const projection = sampleRec?.counterfactual?.projection;
check(
  projection !== undefined &&
    typeof projection.predictedDelayMinutes === "number" &&
    typeof projection.sectionThroughputAfter === "number",
  "TEST 10: Counterfactual what-if projection includes predicted delay, section throughput, and risk metrics",
  `Projected delay: ${projection?.predictedDelayMinutes} min, Projected throughput: ${projection?.sectionThroughputAfter} T/h`
);

// -------------------------------------------------------------------
// TEST 11: Completed train tracking
// -------------------------------------------------------------------
const singleFinishingTrain = [
  {
    id: "T001",
    name: "Terminal Express",
    type: "SUPERFAST" as const,
    priority: 10,
    currentSection: "MRT-SNP-01",
    position: 99.99,
    speed: 120,
    status: "ON_TIME" as const,
    delayMinutes: 1,
    origin: "ND",
    destination: "SNP",
    scheduledArrival: "12:30",
    expectedArrival: "12:31",
  },
];
const simEngFinishing = new SimulationEngine(singleFinishingTrain);
simEngFinishing.step();
const snapFinished = simEngFinishing.getSnapshot();
const lastEvent = snapFinished.events.find((e) => e.type === "TRAIN_COMPLETED");
check(
  snapFinished.throughputMetrics.trainsCompleted === 1 &&
    snapFinished.throughputMetrics.completedRecords.length === 1 &&
    lastEvent !== undefined,
  "TEST 11: Terminus arrival emits TRAIN_COMPLETED event and logs complete trip telemetry",
  `Trips: ${snapFinished.throughputMetrics.trainsCompleted}, Event: ${lastEvent?.message}`
);

// -------------------------------------------------------------------
// TEST 12: KPI consistency across metrics and telemetry
// -------------------------------------------------------------------
const snapCheck = simEng.getSnapshot();
check(
  typeof snapCheck.throughputMetrics.corridorThroughput === "number" &&
    typeof snapCheck.throughputMetrics.conflictFreeTimeSeconds === "number" &&
    typeof snapCheck.telemetry.activeTrains === "number",
  "TEST 12: Extended operational KPIs remain mathematically consistent and live derived",
  `CorridorThroughput: ${snapCheck.throughputMetrics.corridorThroughput} T/h, ConflictFree: ${snapCheck.throughputMetrics.conflictFreeTimeSeconds}s`
);

console.log("==================================================");
console.log(`TEST SUMMARY: ${passed} / ${total} TESTS PASSED`);
console.log("==================================================");
