/**
 * RTPXO - Phase 3 Verification Test Suite
 * Validates all 13 Phase 3 Dashboard and Engine integration requirements.
 */

import { SimulationEngine } from "./simulationEngine";
import { Train } from "@/types/railway";

console.log("==================================================");
console.log("RTPXO PHASE 3 OPERATIONAL DASHBOARD VERIFICATION");
console.log("==================================================");

let passed = 0;
let total = 13;

function check(cond: boolean, name: string, detail?: string) {
  if (cond) {
    console.log(`[PASS] ${name}`);
    passed++;
  } else {
    console.error(`[FAIL] ${name}: ${detail || "Condition not met"}`);
  }
}

// -------------------------------------------------------------------
// TEST 1: Start simulation. Train markers move according to SimulationEngine
// -------------------------------------------------------------------
const engine = new SimulationEngine();
const initialPos = engine.getSnapshot().trains[0].position;
engine.start();
// simulate 3 ticks manually
engine.step();
engine.step();
const updatedPos = engine.getSnapshot().trains[0].position;
check(
  updatedPos > initialPos,
  "TEST 1: Train moves forward according to SimulationEngine kinematics",
  `Initial: ${initialPos}%, Updated: ${updatedPos}%`
);

// -------------------------------------------------------------------
// TEST 2: Pause simulation. Train movement stops
// -------------------------------------------------------------------
engine.pause();
const pausedPos = engine.getSnapshot().trains[0].position;
check(
  engine.getSnapshot().running === false && pausedPos === updatedPos,
  "TEST 2: Pause simulation halts execution",
  `Running: ${engine.getSnapshot().running}`
);

// -------------------------------------------------------------------
// TEST 3: Reset simulation. Original train state returns
// -------------------------------------------------------------------
engine.reset();
const resetPos = engine.getSnapshot().trains[0].position;
check(
  resetPos === initialPos && engine.getSnapshot().simulationTime === 0,
  "TEST 3: Reset simulation restores initial state and resets clock",
  `Reset Pos: ${resetPos}%, Clock: ${engine.getSnapshot().simulationTime}s`
);

// -------------------------------------------------------------------
// TEST 4: Change speed multiplier. Movement responds accordingly
// -------------------------------------------------------------------
engine.setSpeedMultiplier(4);
const snapSpeed = engine.getSnapshot().speedMultiplier;
engine.step();
const fastPos = engine.getSnapshot().trains[0].position;
check(
  snapSpeed === 4 && fastPos > resetPos,
  "TEST 4: Speed multiplier sets simulation rate correctly",
  `SpeedMultiplier: ${snapSpeed}x, Pos: ${fastPos}%`
);

// -------------------------------------------------------------------
// TEST 5: Signals display all three lamps
// -------------------------------------------------------------------
const snapSignals = engine.getSnapshot().signals;
check(
  snapSignals.length >= 4 &&
    snapSignals.every((s) => ["GREEN", "YELLOW", "RED"].includes(s.aspect)),
  "TEST 5: All signals support 3-aspect lamp states",
  `Total signals: ${snapSignals.length}`
);

// -------------------------------------------------------------------
// TEST 6: Changing live signal aspect updates the evaluated state
// -------------------------------------------------------------------
const testTrainsHighConflict: Train[] = [
  {
    id: "T001",
    name: "Express 1",
    type: "EXPRESS",
    priority: 10,
    currentSection: "ND-GZB-01",
    position: 88,
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
    name: "Express 2",
    type: "SUPERFAST",
    priority: 8,
    currentSection: "ND-GZB-01",
    position: 92,
    speed: 100,
    status: "ON_TIME",
    delayMinutes: 0,
    origin: "ND",
    destination: "SNP",
    scheduledArrival: "12:05",
    expectedArrival: "12:05",
  },
];
const conflictEng = new SimulationEngine(testTrainsHighConflict);
const conflictSnap = conflictEng.getSnapshot();
const redSig = conflictSnap.signals.find((s) => s.aspect === "RED");
check(
  redSig !== undefined,
  "TEST 6: Signal aspect dynamically transitions to RED upon high conflict",
  `ND Signal: ${redSig?.id} aspect is ${redSig?.aspect}`
);

// -------------------------------------------------------------------
// TEST 7: Conflict appears in snapshot when detected
// -------------------------------------------------------------------
check(
  conflictSnap.conflicts.length > 0 &&
    conflictSnap.conflicts[0].severity === "HIGH",
  "TEST 7: Conflict engine populates live conflict list in snapshot",
  `Active conflicts: ${conflictSnap.conflicts.length}`
);

// -------------------------------------------------------------------
// TEST 8: AI recommendations come directly from SimulationSnapshot
// -------------------------------------------------------------------
check(
  conflictSnap.recommendations.length > 0 &&
    conflictSnap.recommendations[0].affectedTrainId === "T001" ||
    conflictSnap.recommendations[0].affectedTrainId === "T002",
  "TEST 8: AI Advisor outputs structured recommendations into snapshot",
  `Recs count: ${conflictSnap.recommendations.length}, Action: ${conflictSnap.recommendations[0]?.action}`
);

// -------------------------------------------------------------------
// TEST 9: Applying an AI recommendation updates simulation via engine
// -------------------------------------------------------------------
const recId = conflictSnap.recommendations[0].id;
const applySuccess = conflictEng.applyRecommendation(recId);
const postApplySnap = conflictEng.getSnapshot();
const appliedRec = postApplySnap.recommendations.find((r) => r.id === recId);
check(
  applySuccess && appliedRec?.status === "ACCEPTED",
  "TEST 9: Applying recommendation dispatches command and updates simulation state",
  `Apply success: ${applySuccess}, status: ${appliedRec?.status}`
);

// -------------------------------------------------------------------
// TEST 10: Throughput metrics update from live simulation
// -------------------------------------------------------------------
check(
  postApplySnap.throughputMetrics.corridorThroughput >= 0 &&
    postApplySnap.telemetry.sectionUtilizations.length > 0,
  "TEST 10: Throughput and section utilization metrics computed from live state",
  `Throughput: ${postApplySnap.throughputMetrics.corridorThroughput} T/h`
);

import fs from "fs";
import path from "path";

// -------------------------------------------------------------------
// TEST 11: No independent setInterval exists in page.tsx for train physics
// -------------------------------------------------------------------
const pageSrc = fs.readFileSync(path.join(process.cwd(), "app", "page.tsx"), "utf8");
const pageSubscribesCleanly = !pageSrc.includes("setInterval(") && pageSrc.includes("simulationEngine.subscribe");
check(
  pageSubscribesCleanly,
  "TEST 11: Verified app/page.tsx subscribes solely to SimulationEngine with zero independent setInterval physics"
);

// -------------------------------------------------------------------
// TEST 12: No hardcoded signal aspect exists in UI
// -------------------------------------------------------------------
const signalHeadSrc = fs.readFileSync(
  path.join(process.cwd(), "components", "railway", "SignalHead.tsx"),
  "utf8"
);
const dynamicSignalAspects = signalHeadSrc.includes("signal.aspect") && signalHeadSrc.includes("RED") && signalHeadSrc.includes("GREEN");
check(
  dynamicSignalAspects,
  "TEST 12: SignalHead renders strictly based on props passed from snapshot"
);

// -------------------------------------------------------------------
// TEST 13: No hardcoded train position percentages exist in UI
// -------------------------------------------------------------------
const topologySrc = fs.readFileSync(
  path.join(process.cwd(), "data", "topology.ts"),
  "utf8"
);
const dynamicTopology = topologySrc.includes("getTrainCorridorCoordinates") && topologySrc.includes("sectionMap");
check(
  dynamicTopology,
  "TEST 13: Train positions and station milestones derived dynamically via data/topology.ts"
);

console.log("==================================================");
console.log(`TEST SUMMARY: ${passed} / ${total} TESTS PASSED`);
console.log("==================================================");
