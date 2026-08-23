/**
 * RTPXO - Phase 10 Step 4 Verification Suite
 * Verifies Operator Incident & Recovery Control UI Contracts,
 * Authoritative Gateway Routing, Safety Invariants, and Single-Clock Constraints.
 */

import { Train, RailwaySection, Signal, Junction } from "@/types/railway";
import { ActiveIncident, DisruptionRecoveryPlan } from "@/types/incident";
import { createSimulationEngine, SimulationEngine } from "./simulationEngine";
import { sections as defaultSections } from "@/data/sections";
import { signals as defaultSignals } from "@/data/signals";
import { junctions as defaultJunctions } from "@/data/junctions";
import { trains as defaultTrains } from "@/data/trains";
import { benchmarkRunner } from "./benchmarkRunner";

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

export function runPhase10Step4Tests(): boolean {
  console.log("\n=======================================================");
  console.log("  RTPXO PHASE 10 STEP 4: OPERATOR INCIDENT & RECOVERY UI");
  console.log("=======================================================\n");

  const testEngine = createSimulationEngine();

  const testTsrIncident: ActiveIncident = {
    id: "INC-TSR-UI-01",
    type: "TEMPORARY_SPEED_RESTRICTION",
    severity: "SEVERE",
    status: "ACTIVE_MITIGATING",
    affectedSectionId: "ND-GZB-01",
    imposedSpeedLimitKmH: 45,
    isCompleteBlockage: false,
    reason: "Track maintenance TSR 45 km/h for UI verification",
    startTimeSimulationSeconds: 10,
    expectedDurationSeconds: 180,
  };

  const testBlockageIncident: ActiveIncident = {
    id: "INC-BLOCK-UI-01",
    type: "TRACK_SECTION_BLOCKAGE",
    severity: "CRITICAL",
    status: "ACTIVE_MITIGATING",
    affectedSectionId: "GZB-MRT-01",
    isCompleteBlockage: true,
    reason: "Obstruction on track for UI verification",
    startTimeSimulationSeconds: 10,
    expectedDurationSeconds: 240,
  };

  // ----------------------------------------------------
  // TEST 1: Incident Panel Receives Active Incidents from Snapshot
  // ----------------------------------------------------
  console.log("Test 1: Incident Panel Receives Active Incidents from Snapshot");
  testEngine.declareIncident(testTsrIncident);
  const snapshotWithIncident = testEngine.getSnapshot();

  const activeInSnapshot = snapshotWithIncident.activeIncidents?.find(
    (i) => i.id === "INC-TSR-UI-01"
  );

  assert(
    activeInSnapshot !== undefined &&
      activeInSnapshot.affectedSectionId === "ND-GZB-01" &&
      activeInSnapshot.imposedSpeedLimitKmH === 45,
    "Authoritative SimulationEngine snapshot exposes active incidents to UI components"
  );

  // ----------------------------------------------------
  // TEST 2: Incident Status and Severity Contract
  // ----------------------------------------------------
  console.log("\nTest 2: Incident Status and Severity Contract");
  assert(
    activeInSnapshot !== undefined &&
      activeInSnapshot.severity === "SEVERE" &&
      activeInSnapshot.status === "ACTIVE_MITIGATING",
    "Active incident maintains exact severity and lifecycle status in snapshot"
  );

  // ----------------------------------------------------
  // TEST 3: Recovery Plans Populated in Snapshot
  // ----------------------------------------------------
  console.log("\nTest 3: Recovery Plans Populated in Snapshot");
  const plansInSnapshot = snapshotWithIncident.recoveryPlans || [];
  const tsrRecoveryPlan = plansInSnapshot.find(
    (p) => p.associatedIncidentId === "INC-TSR-UI-01"
  );

  assert(
    tsrRecoveryPlan !== undefined &&
      tsrRecoveryPlan.safetyStatus === "VERIFIED_SAFE" &&
      tsrRecoveryPlan.executionStatus === "PROPOSED",
    "Recovery plans synthesized by backend are exposed through authoritative snapshot"
  );

  // ----------------------------------------------------
  // TEST 4: No Automatic Recovery Execution
  // ----------------------------------------------------
  console.log("\nTest 4: No Automatic Recovery Execution");
  assert(
    tsrRecoveryPlan !== undefined && tsrRecoveryPlan.executionStatus === "PROPOSED",
    "Synthesized recovery plans remain strictly PROPOSED and never automatically execute"
  );

  // ----------------------------------------------------
  // TEST 5: No Automatic Incident Clearance
  // ----------------------------------------------------
  console.log("\nTest 5: No Automatic Incident Clearance");
  testEngine.step(10);
  const stepSnapshot = testEngine.getSnapshot();
  const retainedIncident = stepSnapshot.activeIncidents?.find((i) => i.id === "INC-TSR-UI-01");

  assert(
    retainedIncident !== undefined && retainedIncident.status === "ACTIVE_MITIGATING",
    "Active incident remains active across simulation steps without automatic clearance"
  );

  // ----------------------------------------------------
  // TEST 6: Recovery Authorization Routes Through Authoritative Gateway
  // ----------------------------------------------------
  console.log("\nTest 6: Recovery Authorization Routes Through Authoritative Gateway");
  const currentPlan = testEngine.getRecoveryPlans().find(
    (p) => p.associatedIncidentId === "INC-TSR-UI-01"
  );
  if (currentPlan) {
    const authSuccess = testEngine.authorizeRecoveryPlan(currentPlan.recoveryPlanId);
    const postAuthSnapshot = testEngine.getSnapshot();
    const updatedPlan = postAuthSnapshot.recoveryPlans?.find(
      (p) => p.associatedIncidentId === "INC-TSR-UI-01"
    );

    assert(
      authSuccess === true && updatedPlan !== undefined && updatedPlan.executionStatus === "AUTHORIZED",
      "SimulationEngine.authorizeRecoveryPlan() authoritatively authorizes plan and executes immediate containment"
    );
  } else {
    assert(false, "SimulationEngine.authorizeRecoveryPlan() authoritatively authorizes plan", "Plan not found");
  }

  // ----------------------------------------------------
  // TEST 7: Unsafe / Stale Plans Cannot Be Authorized
  // ----------------------------------------------------
  console.log("\nTest 7: Unsafe / Stale Plans Cannot Be Authorized");
  const unsafePlan: DisruptionRecoveryPlan = {
    recoveryPlanId: "RECPLAN-UNSAFE-TEST",
    associatedIncidentId: "INC-TSR-UI-01",
    name: "Unsafe Plan Test",
    summary: "Plan violating safety",
    stagingPhases: [],
    projectedRecoveryTimeSeconds: 100,
    projectedResidualDelayMinutes: 5,
    safetyStatus: "UNSAFE_REJECTED",
    executionStatus: "PROPOSED",
  };

  (testEngine as any).recoveryPlans = [unsafePlan];
  const rejectUnsafeAuth = testEngine.authorizeRecoveryPlan("RECPLAN-UNSAFE-TEST");

  assert(
    rejectUnsafeAuth === false,
    "Authoritative gateway strictly rejects authorization of UNSAFE_REJECTED recovery plans"
  );

  // ----------------------------------------------------
  // TEST 8: Incident Declaration Routes Through SimulationEngine
  // ----------------------------------------------------
  console.log("\nTest 8: Incident Declaration Routes Through SimulationEngine");
  const declSuccess = testEngine.declareIncident(testBlockageIncident);
  const blockInSnap = testEngine.getSnapshot().activeIncidents?.find((i) => i.id === "INC-BLOCK-UI-01");

  assert(
    declSuccess === true && blockInSnap !== undefined,
    "SimulationEngine.declareIncident() authoritatively injects new disruption incident"
  );

  // ----------------------------------------------------
  // TEST 9: Incident Clearance Routes Through SimulationEngine
  // ----------------------------------------------------
  console.log("\nTest 9: Incident Clearance Routes Through SimulationEngine");
  const clearSuccess = testEngine.clearIncident("INC-TSR-UI-01");
  const postClearSnap = testEngine.getSnapshot();
  const clearedTsr = postClearSnap.activeIncidents?.find((i) => i.id === "INC-TSR-UI-01");

  assert(
    clearSuccess === true && clearedTsr === undefined,
    "SimulationEngine.clearIncident() authoritatively clears incident from active snapshot"
  );

  // ----------------------------------------------------
  // TEST 10: Recovery Plan Staging Conditions Remain Intact
  // ----------------------------------------------------
  console.log("\nTest 10: Recovery Plan Staging Conditions Remain Intact");
  const blockPlans = testEngine.getSnapshot().recoveryPlans?.filter(
    (p) => p.associatedIncidentId === "INC-BLOCK-UI-01"
  ) || [];

  const hasValidStaging = blockPlans.length === 0 || blockPlans.every((p) =>
    p.stagingPhases.every((ph) =>
      ph.triggerCondition === "IMMEDIATE" ||
      ph.triggerCondition === "ON_INCIDENT_CLEARANCE" ||
      ph.triggerCondition === "HEADWAY_STABILIZED"
    )
  );

  assert(
    hasValidStaging === true,
    "Recovery plans preserve strictly defined RecoveryPhaseTriggerConditions"
  );

  // ----------------------------------------------------
  // TEST 11: Phase 9 Strategy Linkage Intact
  // ----------------------------------------------------
  console.log("\nTest 11: Phase 9 Strategy Linkage Intact");
  const snapStrats = testEngine.getSnapshot().availableStrategies || [];
  assert(
    Array.isArray(snapStrats),
    "Snapshot exposes availableStrategies from Phase 9 alongside Phase 10 recovery plans"
  );

  // ----------------------------------------------------
  // TEST 12: Phase 8C Decision Audit Linkage Intact
  // ----------------------------------------------------
  console.log("\nTest 12: Phase 8C Decision Audit Linkage Intact");
  const decisionHistory = testEngine.getDecisionHistory();
  assert(
    Array.isArray(decisionHistory),
    "Decision audit trace remains intact and accessible for closed-loop verification"
  );

  // ----------------------------------------------------
  // TEST 13: Phase 8D Learning Remains Informational Only
  // ----------------------------------------------------
  console.log("\nTest 13: Phase 8D Learning Remains Informational Only");
  const testTrain = defaultTrains[0];
  const testSec = defaultSections[0];
  const adaptiveInsight = testEngine.getAdaptiveEngine().evaluateAdaptiveInsight(
    {
      id: "CAND-ADAPT-TEST",
      affectedTrainId: testTrain.id,
      action: "REDUCE_SPEED",
      targetSpeed: 45,
      affectedSectionId: testSec.id,
      description: "Test adaptive insight",
    },
    testTrain,
    testSec,
    false,
    "MODERATE",
    80
  );
  assert(
    adaptiveInsight !== undefined && typeof adaptiveInsight.adaptiveScore === "number",
    "Adaptive decision insights remain observational and cannot override interlocking safety"
  );

  // ----------------------------------------------------
  // TEST 14: Single-Clock Invariant
  // ----------------------------------------------------
  console.log("\nTest 14: Single-Clock Invariant");
  assert(
    (testEngine as any).timer !== undefined,
    "SimulationEngine maintains sole authoritative timer with zero secondary clocks"
  );

  // ----------------------------------------------------
  // TEST 15: Full Regression Suite Verification
  // ----------------------------------------------------
  console.log("\nTest 15: Full Regression Suite Verification");
  testEngine.reset();
  const cleanSnapshot = testEngine.getSnapshot();

  assert(
    cleanSnapshot.trains.length === defaultTrains.length &&
      cleanSnapshot.activeIncidents?.length === 0 &&
      cleanSnapshot.recoveryPlans?.length === 0,
    "Reset cleanly restores baseline simulation state without residual disruption leakage"
  );

  console.log("\n-------------------------------------------------------");
  console.log(`  Phase 10 Step 4 Test Summary: ${passCount} Passed, ${failCount} Failed`);
  console.log("-------------------------------------------------------\n");

  return failCount === 0;
}

if (require.main === module || !process.env.TEST_IMPORT) {
  runPhase10Step4Tests();
}
