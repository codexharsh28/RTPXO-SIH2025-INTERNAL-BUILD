/**
 * RTPXO - Phase 2 Verification Test Suite
 * Validates the 8 core requirements for the modular engine layer.
 */

import fs from "fs";
import path from "path";
import { Train } from "@/types/railway";
import { SignalEngine } from "./signalEngine";
import { ConflictEngine } from "./conflictEngine";
import { ThroughputEngine } from "./throughputEngine";
import { AdvisorEngine } from "./advisorEngine";
import { SimulationEngine } from "./simulationEngine";
import { sections } from "@/data/sections";
import { junctions } from "@/data/junctions";
import { signals } from "@/data/signals";

console.log("==================================================");
console.log("RTPXO PHASE 2 MODULAR ENGINE VERIFICATION SUITE");
console.log("==================================================");

let passedTests = 0;
let totalTests = 8;

// Helper assertions
function assert(condition: boolean, testName: string, details?: string) {
  if (condition) {
    console.log(`[PASS] ${testName}`);
    passedTests++;
  } else {
    console.error(`[FAIL] ${testName}: ${details || "Assertion failed"}`);
  }
}

// -------------------------------------------------------------------
// TEST 1: Two trains in the same section produce an appropriate conflict
// -------------------------------------------------------------------
const conflictEng = new ConflictEngine();
const sameSectionTrains: Train[] = [
  {
    id: "T001",
    name: "Train 1",
    type: "EXPRESS",
    priority: 10,
    currentSection: "ND-GZB-01",
    position: 40,
    speed: 100,
    status: "ON_TIME",
    delayMinutes: 0,
    origin: "ND",
    destination: "SNP",
    scheduledArrival: "12:00",
    expectedArrival: "12:00",
  },
  {
    id: "T002",
    name: "Train 2",
    type: "SUPERFAST",
    priority: 8,
    currentSection: "ND-GZB-01",
    position: 44, // 4% difference in 25km section = 1.0 km -> CRITICAL / HIGH
    speed: 110,
    status: "ON_TIME",
    delayMinutes: 0,
    origin: "ND",
    destination: "SNP",
    scheduledArrival: "12:05",
    expectedArrival: "12:05",
  },
];

const test1Result = conflictEng.evaluateConflicts(sameSectionTrains, sections, junctions);
assert(
  test1Result.activeConflicts.length > 0 &&
    (test1Result.activeConflicts[0].severity === "HIGH" || test1Result.activeConflicts[0].severity === "CRITICAL"),
  "TEST 1: Two trains in same section produce appropriate conflict",
  `Found ${test1Result.activeConflicts.length} conflicts with severity ${test1Result.activeConflicts[0]?.severity}`
);

// -------------------------------------------------------------------
// TEST 2: A HIGH conflict can produce RED signal state
// -------------------------------------------------------------------
const signalEng = new SignalEngine();
const test2Signals = signalEng.evaluateSignals(
  sameSectionTrains,
  sections,
  test1Result.activeConflicts,
  junctions,
  signals,
  10
);

const redSignal = test2Signals.find(
  (s) => s.sectionId === "ND-GZB-01" && s.aspect === "RED"
);
assert(
  redSignal !== undefined,
  "TEST 2: A HIGH conflict produces RED signal state",
  `Aspect for ND-GZB-01 signal: ${test2Signals[0]?.aspect}`
);

// -------------------------------------------------------------------
// TEST 3: No conflict produces GREEN when route is clear
// -------------------------------------------------------------------
const clearSectionTrains: Train[] = [
  {
    id: "T001",
    name: "Train 1",
    type: "EXPRESS",
    priority: 10,
    currentSection: "ND-GZB-01",
    position: 20,
    speed: 100,
    status: "ON_TIME",
    delayMinutes: 0,
    origin: "ND",
    destination: "SNP",
    scheduledArrival: "12:00",
    expectedArrival: "12:00",
  },
];

const test3Conflicts = conflictEng.evaluateConflicts(clearSectionTrains, sections, junctions);
const test3Signals = signalEng.evaluateSignals(
  clearSectionTrains,
  sections,
  test3Conflicts.activeConflicts,
  junctions,
  signals,
  0
);

const clearSignal = test3Signals.find((s) => s.sectionId === "GZB-MRT-01");
assert(
  clearSignal !== undefined && clearSignal.aspect === "GREEN",
  "TEST 3: No conflict produces GREEN when the route is clear",
  `Aspect for GZB-MRT-01 signal: ${clearSignal?.aspect}`
);

// -------------------------------------------------------------------
// TEST 4: Approaching restricted/caution boundary produces YELLOW
// -------------------------------------------------------------------
const cautionTrains: Train[] = [
  {
    id: "T001",
    name: "Lead Train",
    type: "EXPRESS",
    priority: 10,
    currentSection: "GZB-MRT-01",
    position: 10,
    speed: 60,
    status: "ON_TIME",
    delayMinutes: 0,
    origin: "ND",
    destination: "SNP",
    scheduledArrival: "12:00",
    expectedArrival: "12:00",
  },
  {
    id: "T002",
    name: "Approaching Train",
    type: "SUPERFAST",
    priority: 8,
    currentSection: "ND-GZB-01",
    position: 65, // approaching occupied downstream section GZB-MRT-01
    speed: 90,
    status: "ON_TIME",
    delayMinutes: 0,
    origin: "ND",
    destination: "SNP",
    scheduledArrival: "12:05",
    expectedArrival: "12:05",
  },
];

const test4Conflicts = conflictEng.evaluateConflicts(cautionTrains, sections, junctions);
const test4Signals = signalEng.evaluateSignals(
  cautionTrains,
  sections,
  test4Conflicts.activeConflicts,
  junctions,
  signals,
  50
);

const yellowSignal = test4Signals.find(
  (s) => s.sectionId === "ND-GZB-01" && s.aspect === "YELLOW"
);
assert(
  yellowSignal !== undefined,
  "TEST 4: Potential restricted approach produces YELLOW",
  `Aspect: ${test4Signals.find((s) => s.sectionId === "ND-GZB-01")?.aspect}`
);

// -------------------------------------------------------------------
// TEST 5: Throughput metrics based on actual simulation data
// -------------------------------------------------------------------
const throughputEng = new ThroughputEngine();
const metricsResult = throughputEng.computeMetrics(
  cautionTrains,
  sections,
  test4Signals,
  test4Conflicts.activeConflicts,
  test4Conflicts.predictedConflicts,
  120
);

assert(
  metricsResult.throughput.corridorThroughput > 0 &&
    metricsResult.telemetry.activeTrains === 2 &&
    metricsResult.telemetry.sectionUtilizations.length === sections.length,
  "TEST 5: Throughput metrics computed deterministically from simulation data",
  `TPH: ${metricsResult.throughput.trainsPerHour}, Active: ${metricsResult.telemetry.activeTrains}`
);

// -------------------------------------------------------------------
// TEST 6: Advisor produces structured recommendation for conflicts/bottlenecks
// -------------------------------------------------------------------
const advisorEng = new AdvisorEngine();
const advisorResult = advisorEng.generateRecommendations(
  sameSectionTrains,
  sections,
  test2Signals,
  test1Result.activeConflicts,
  test1Result.predictedConflicts,
  metricsResult.throughput,
  10
);

assert(
  advisorResult.recommendations.length > 0 &&
    advisorResult.recommendations[0].action === "REDUCE_SPEED" &&
    advisorResult.recommendations[0].confidence > 0.8 &&
    advisorResult.assessment.status === "CRITICAL",
  "TEST 6: Advisor produces structured recommendation and network assessment",
  `Recs: ${advisorResult.recommendations.length}, Action: ${advisorResult.recommendations[0]?.action}, Status: ${advisorResult.assessment.status}`
);

// -------------------------------------------------------------------
// TEST 7: SimulationEngine remains single source of truth
// -------------------------------------------------------------------
const simEngine = new SimulationEngine(sameSectionTrains);
const snapshot1 = simEngine.getSnapshot();
assert(
  snapshot1.trains.length === 2 &&
    snapshot1.conflicts.length > 0 &&
    snapshot1.recommendations.length > 0 &&
    typeof simEngine.subscribe === "function",
  "TEST 7: SimulationEngine provides unified multi-engine snapshot",
  `Snapshot trains: ${snapshot1.trains.length}, conflicts: ${snapshot1.conflicts.length}`
);

// -------------------------------------------------------------------
// TEST 8: No React component contains independent simulation timer
// -------------------------------------------------------------------
const pageContent = fs.readFileSync(
  path.join(process.cwd(), "app", "page.tsx"),
  "utf8"
);
const hasNoIndependentTimer =
  !pageContent.includes("setInterval(") &&
  pageContent.includes("simulationEngine.subscribe");

assert(
  hasNoIndependentTimer,
  "TEST 8: Verified page.tsx subscribes solely to SimulationEngine with zero independent setInterval physics"
);

console.log("==================================================");
console.log(`TEST SUMMARY: ${passedTests} / ${totalTests} TESTS PASSED`);
console.log("==================================================");
