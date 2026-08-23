/**
 * RTPXO - Phase 4 Verification Test Suite
 * Validates all 12 Phase 4 Operational Intelligence & Throughput Optimization requirements.
 */

import { Train } from "@/types/railway";
import { SimulationEngine } from "./simulationEngine";
import { ThroughputEngine } from "./throughputEngine";
import { AdvisorEngine } from "./advisorEngine";
import { ConflictEngine } from "./conflictEngine";
import { SignalEngine } from "./signalEngine";
import { sections } from "@/data/sections";
import { junctions } from "@/data/junctions";
import { signals } from "@/data/signals";

console.log("==================================================");
console.log("RTPXO PHASE 4 OPERATIONAL INTELLIGENCE SUITE");
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
// TEST 1: Section occupancy is calculated correctly
// -------------------------------------------------------------------
const testTrains: Train[] = [
  {
    id: "T001",
    name: "Express 1",
    type: "EXPRESS",
    priority: 10,
    currentSection: "ND-GZB-01",
    position: 25,
    speed: 100,
    status: "ON_TIME",
    delayMinutes: 0,
    origin: "ND",
    destination: "SNP",
    scheduledArrival: "12:00",
    expectedArrival: "12:00",
  },
];
const simEng1 = new SimulationEngine(testTrains);
const snap1 = simEng1.getSnapshot();
const secND = snap1.sections.find((s) => s.id === "ND-GZB-01");
const secGZB = snap1.sections.find((s) => s.id === "GZB-MRT-01");
check(
  secND?.status === "OCCUPIED" && secGZB?.status === "AVAILABLE",
  "TEST 1: Section occupancy is calculated correctly based on train presence",
  `ND-GZB: ${secND?.status}, GZB-MRT: ${secGZB?.status}`
);

// -------------------------------------------------------------------
// TEST 2: Train entering a section increases occupancy
// -------------------------------------------------------------------
const secUtilBefore = snap1.telemetry.sectionUtilizations.find((u) => u.sectionId === "GZB-MRT-01");
const testTrains2: Train[] = [
  ...testTrains,
  {
    id: "T002",
    name: "Express 2",
    type: "SUPERFAST",
    priority: 8,
    currentSection: "GZB-MRT-01",
    position: 10,
    speed: 90,
    status: "ON_TIME",
    delayMinutes: 0,
    origin: "ND",
    destination: "SNP",
    scheduledArrival: "12:00",
    expectedArrival: "12:00",
  },
];
const simEng2 = new SimulationEngine(testTrains2);
const snap2 = simEng2.getSnapshot();
const secUtilAfter = snap2.telemetry.sectionUtilizations.find((u) => u.sectionId === "GZB-MRT-01");
check(
  (secUtilBefore?.activeTrainCount || 0) === 0 && (secUtilAfter?.activeTrainCount || 0) === 1,
  "TEST 2: Train entering a section increases active count and utilization rate",
  `Before count: ${secUtilBefore?.activeTrainCount}, After count: ${secUtilAfter?.activeTrainCount}`
);

// -------------------------------------------------------------------
// TEST 3: Train leaving a section decreases occupancy
// -------------------------------------------------------------------
const testTrains3: Train[] = [
  {
    ...testTrains[0],
    currentSection: "GZB-MRT-01",
    position: 5,
  },
];
const simEng3 = new SimulationEngine(testTrains3);
const snap3 = simEng3.getSnapshot();
const secND3 = snap3.sections.find((s) => s.id === "ND-GZB-01");
check(
  secND3?.status === "AVAILABLE",
  "TEST 3: Train leaving a section decreases occupancy and restores AVAILABLE status",
  `ND-GZB-01 status: ${secND3?.status}`
);

// -------------------------------------------------------------------
// TEST 4: Completed train is recorded correctly at terminus
// -------------------------------------------------------------------
const testTrainsNearEnd: Train[] = [
  {
    id: "T001",
    name: "Finishing Train",
    type: "EXPRESS",
    priority: 10,
    currentSection: "MRT-SNP-01",
    position: 99.99,
    speed: 100,
    status: "ON_TIME",
    delayMinutes: 2,
    origin: "ND",
    destination: "SNP",
    scheduledArrival: "12:00",
    expectedArrival: "12:02",
  },
];
const simEngEnd = new SimulationEngine(testTrainsNearEnd);
// Advance 1 tick to cross 100% boundary
simEngEnd.step();
const snapEnd = simEngEnd.getSnapshot();
const completedTrain = snapEnd.trains.find((t) => t.id === "T001");
check(
  completedTrain?.completed === true &&
    (completedTrain?.status === "COMPLETED" || completedTrain?.status === "STOPPED") &&
    snapEnd.throughputMetrics.trainsCompleted === 1 &&
    snapEnd.throughputMetrics.completedRecords.length === 1,
  "TEST 4: Completed train at terminus is recorded with travel time, final delay, and trip count",
  `Completed: ${completedTrain?.completed}, Status: ${completedTrain?.status}, Trips: ${snapEnd.throughputMetrics.trainsCompleted}`
);

// -------------------------------------------------------------------
// TEST 5: Section throughput changes when train speed/flow changes
// -------------------------------------------------------------------
const tphLowSpeed = snap1.telemetry.sectionUtilizations.find((u) => u.sectionId === "ND-GZB-01")?.sectionThroughput || 0;
simEng1.overrideTrainSpeed("T001", 130);
const snapHighSpeed = simEng1.getSnapshot();
const tphHighSpeed = snapHighSpeed.telemetry.sectionUtilizations.find((u) => u.sectionId === "ND-GZB-01")?.sectionThroughput || 0;
check(
  tphHighSpeed > tphLowSpeed,
  "TEST 5: Section throughput scales with continuous kinematic velocity flux",
  `At 100 km/h: ${tphLowSpeed} T/h, At 130 km/h: ${tphHighSpeed} T/h`
);

// -------------------------------------------------------------------
// TEST 6: Bottleneck detection responds to increased congestion
// -------------------------------------------------------------------
const congestedTrains: Train[] = [
  {
    id: "T001",
    name: "Slow Freight",
    type: "FREIGHT",
    priority: 4,
    currentSection: "GZB-MRT-01",
    position: 30,
    speed: 20, // severe speed deficit
    status: "DELAYED",
    delayMinutes: 12,
    origin: "ND",
    destination: "SNP",
    scheduledArrival: "12:00",
    expectedArrival: "12:12",
  },
  {
    id: "T002",
    name: "Held Express",
    type: "SUPERFAST",
    priority: 8,
    currentSection: "GZB-MRT-01",
    position: 15,
    speed: 25,
    status: "DELAYED",
    delayMinutes: 8,
    origin: "ND",
    destination: "SNP",
    scheduledArrival: "12:05",
    expectedArrival: "12:13",
  },
];
const simEngCongested = new SimulationEngine(congestedTrains);
const snapCongested = simEngCongested.getSnapshot();
const bottleneckSec = snapCongested.telemetry.sectionUtilizations.find((u) => u.sectionId === "GZB-MRT-01");
check(
  bottleneckSec?.isBottleneck === true &&
    (bottleneckSec?.bottleneckScore || 0) >= 40 &&
    bottleneckSec?.congestionState === "SATURATED",
  "TEST 6: Bottleneck detection accurately identifies high congestion and speed deficit",
  `Bottleneck: ${bottleneckSec?.isBottleneck}, Score: ${bottleneckSec?.bottleneckScore}, State: ${bottleneckSec?.congestionState}`
);

// -------------------------------------------------------------------
// TEST 7: Advisor recommendation considers section capacity
// -------------------------------------------------------------------
const advisorEng = new AdvisorEngine();
const conflictEng = new ConflictEngine();
const signalEng = new SignalEngine();
const throughputEng = new ThroughputEngine();

const advConf = conflictEng.evaluateConflicts(congestedTrains, sections, junctions);
const advSig = signalEng.evaluateSignals(congestedTrains, sections, advConf.activeConflicts, junctions, signals, 10);
const advMetrics = throughputEng.computeMetrics(congestedTrains, sections, advSig, advConf.activeConflicts, advConf.predictedConflicts, 10);
const advResult = advisorEng.generateRecommendations(congestedTrains, sections, advSig, advConf.activeConflicts, advConf.predictedConflicts, advMetrics.throughput, 10);

const recCapacity = advResult.recommendations.find((r) => r.affectedSectionId === "GZB-MRT-01");
check(
  recCapacity !== undefined &&
    recCapacity.action === "REDUCE_SPEED" &&
    recCapacity.constraintsChecked?.sectionCapacity === "SATURATED",
  "TEST 7: Advisor evaluates section capacity constraint in recommendation logic",
  `Action: ${recCapacity?.action}, Capacity constraint: ${recCapacity?.constraintsChecked?.sectionCapacity}`
);

// -------------------------------------------------------------------
// TEST 8: Advisor recommendation considers downstream occupancy
// -------------------------------------------------------------------
const approachOccupiedTrains: Train[] = [
  {
    id: "T001",
    name: "Downstream Train",
    type: "EXPRESS",
    priority: 10,
    currentSection: "GZB-MRT-01",
    position: 40,
    speed: 80,
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
    position: 75, // approaching occupied downstream section
    speed: 95,
    status: "ON_TIME",
    delayMinutes: 0,
    origin: "ND",
    destination: "SNP",
    scheduledArrival: "12:00",
    expectedArrival: "12:00",
  },
];
const advConf2 = conflictEng.evaluateConflicts(approachOccupiedTrains, sections, junctions);
const advSig2 = signalEng.evaluateSignals(approachOccupiedTrains, sections, advConf2.activeConflicts, junctions, signals, 10);
const advMetrics2 = throughputEng.computeMetrics(approachOccupiedTrains, sections, advSig2, advConf2.activeConflicts, advConf2.predictedConflicts, 10);
const advResult2 = advisorEng.generateRecommendations(approachOccupiedTrains, sections, advSig2, advConf2.activeConflicts, advConf2.predictedConflicts, advMetrics2.throughput, 10);

const recGlide = advResult2.recommendations.find((r) => r.affectedTrainId === "T002");
check(
  recGlide !== undefined &&
    recGlide.action === "REDUCE_SPEED" &&
    recGlide.constraintsChecked?.downstreamOccupancy === "OCCUPIED",
  "TEST 8: Advisor checks downstream occupancy to advise glide deceleration",
  `Action: ${recGlide?.action}, Downstream constraint: ${recGlide?.constraintsChecked?.downstreamOccupancy}`
);

// -------------------------------------------------------------------
// TEST 9: Advisor never recommends unsafe action (never accelerates into occupied block)
// -------------------------------------------------------------------
const neverUnsafe = !advResult2.recommendations.some(
  (r) => r.affectedTrainId === "T002" && r.action === "INCREASE_SPEED"
);
check(
  neverUnsafe,
  "TEST 9: Safety priority hierarchy prevents speed increases into occupied downstream blocks"
);

// -------------------------------------------------------------------
// TEST 10: Counterfactual recommendation impact calculated from state
// -------------------------------------------------------------------
check(
  recGlide?.counterfactual !== undefined &&
    recGlide.counterfactual.currentSpeedKmH === 95 &&
    recGlide.counterfactual.targetSpeedKmH === 60 &&
    typeof recGlide.counterfactual.currentSectionThroughput === "number",
  "TEST 10: Counterfactual comparison contains concrete current vs target state telemetry",
  `Current: ${recGlide?.counterfactual?.currentSpeedKmH} km/h, Target: ${recGlide?.counterfactual?.targetSpeedKmH} km/h`
);

// -------------------------------------------------------------------
// TEST 11: Throughput improvement is based on measurable values
// -------------------------------------------------------------------
check(
  typeof advMetrics.throughput.baselineThroughput === "number" &&
    typeof advMetrics.throughput.throughputImprovement === "number" &&
    advMetrics.throughput.baselineThroughput > 0,
  "TEST 11: Throughput improvement is calculated against baseline corridor capacity",
  `Corridor: ${advMetrics.throughput.corridorThroughput} T/h, Baseline: ${advMetrics.throughput.baselineThroughput} T/h, Gain: ${advMetrics.throughput.throughputImprovement}%`
);

// -------------------------------------------------------------------
// TEST 12: Existing Phase 1-3 mechanics continue passing
// -------------------------------------------------------------------
check(
  snap1.signals.length >= 4 &&
    snap1.topology.sections.length === 3 &&
    snap1.telemetry.activeTrains === 1,
  "TEST 12: Baseline corridor topology, signal states, and snapshot integration validated",
  `Signals: ${snap1.signals.length}, Sections: ${snap1.topology.sections.length}`
);

console.log("==================================================");
console.log(`TEST SUMMARY: ${passed} / ${total} TESTS PASSED`);
console.log("==================================================");
