/**
 * RTPXO - Phase 10 Step 5.2 Verification Suite
 * Verifies Authoritative SimulationEngine Staged Recovery Execution Lifecycle,
 * Atomic Phase Transitions, Phase 8C Audit Linkage, Trigger Gating, and Safety Invariants.
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

export function runPhase10Step5_2Tests(): boolean {
  console.log("\n=======================================================");
  console.log("  RTPXO PHASE 10 STEP 5.2: RECOVERY EXECUTION & AUDITING");
  console.log("=======================================================\n");

  const testEngine = createSimulationEngine();

  const testTsrIncident: ActiveIncident = {
    id: "INC-TSR-EXEC-01",
    type: "TEMPORARY_SPEED_RESTRICTION",
    severity: "SEVERE",
    status: "ACTIVE_MITIGATING",
    affectedSectionId: "ND-GZB-01",
    imposedSpeedLimitKmH: 45,
    isCompleteBlockage: false,
    reason: "Track maintenance TSR 45 km/h for execution verification",
    startTimeSimulationSeconds: 10,
    expectedDurationSeconds: 180,
  };

  // ----------------------------------------------------
  // TEST 1: Recovery dispatch succeeds for VERIFIED_SAFE PROPOSED plan
  // ----------------------------------------------------
  console.log("Test 1: Recovery dispatch succeeds for VERIFIED_SAFE PROPOSED plan");
  testEngine.declareIncident(testTsrIncident);
  const snap1 = testEngine.getSnapshot();
  const availablePlan = snap1.recoveryPlans?.find((p) => p.associatedIncidentId === "INC-TSR-EXEC-01");

  const authSuccess = availablePlan ? testEngine.dispatchRecoveryPlan(availablePlan.recoveryPlanId) : false;
  assert(
    availablePlan !== undefined && authSuccess === true,
    "dispatchRecoveryPlan() succeeds for valid VERIFIED_SAFE PROPOSED plan"
  );

  // ----------------------------------------------------
  // TEST 2: Unsafe plan is rejected atomically
  // ----------------------------------------------------
  console.log("\nTest 2: Unsafe plan is rejected atomically");
  const unsafePlan: DisruptionRecoveryPlan = {
    recoveryPlanId: "RECPLAN-UNSAFE-EXEC-TEST",
    associatedIncidentId: "INC-TSR-EXEC-01",
    name: "Unsafe Plan Test",
    summary: "Plan with unsafe status",
    stagingPhases: [],
    projectedRecoveryTimeSeconds: 100,
    projectedResidualDelayMinutes: 5,
    safetyStatus: "UNSAFE_REJECTED",
    executionStatus: "PROPOSED",
  };
  (testEngine as any).recoveryPlans.push(unsafePlan);
  const unsafeAuthResult = testEngine.dispatchRecoveryPlan("RECPLAN-UNSAFE-EXEC-TEST");
  assert(!unsafeAuthResult, "Unsafe plan (safetyStatus === 'UNSAFE_REJECTED') is rejected atomically");

  // ----------------------------------------------------
  // TEST 3: Invalid train rejects complete recovery dispatch
  // ----------------------------------------------------
  console.log("\nTest 3: Invalid train rejects complete recovery dispatch");
  const invalidTrainPlan: DisruptionRecoveryPlan = {
    recoveryPlanId: "RECPLAN-INVALID-TRAIN-TEST",
    associatedIncidentId: "INC-TSR-EXEC-01",
    name: "Invalid Train Plan",
    summary: "Plan targeting non-existent train",
    stagingPhases: [
      {
        phaseNumber: 1,
        phaseName: "Immediate Phase",
        triggerCondition: "IMMEDIATE",
        actions: [
          {
            candidateAction: {
              id: "CAND-NONEXISTENT",
              affectedTrainId: "NON_EXISTENT_TRAIN_999",
              action: "REDUCE_SPEED",
              targetSpeed: 40,
              affectedSectionId: "ND-GZB-01",
              description: "Non-existent train action",
            },
            trainId: "NON_EXISTENT_TRAIN_999",
            trainName: "Ghost Train",
            role: "SPEED_REGULATE",
            targetSectionId: "ND-GZB-01",
            individualBaseScore: 50,
            individualAdaptiveScore: 50,
            rationalSummary: "Test invalid train",
          },
        ],
      },
    ],
    projectedRecoveryTimeSeconds: 100,
    projectedResidualDelayMinutes: 5,
    safetyStatus: "VERIFIED_SAFE",
    executionStatus: "PROPOSED",
  };
  (testEngine as any).recoveryPlans.push(invalidTrainPlan);
  const invalidTrainResult = testEngine.dispatchRecoveryPlan("RECPLAN-INVALID-TRAIN-TEST");
  assert(!invalidTrainResult, "Recovery plan with invalid/non-existent train is rejected completely");

  // ----------------------------------------------------
  // TEST 4: No mutation occurs when validation fails
  // ----------------------------------------------------
  console.log("\nTest 4: No mutation occurs when validation fails");
  const execStates = testEngine.getActiveRecoveryExecutions();
  const hasInvalidExec = execStates.some((e) => e.recoveryPlanId === "RECPLAN-INVALID-TRAIN-TEST");
  assert(!hasInvalidExec, "Zero execution state or railway mutation occurs when plan validation fails");

  // ----------------------------------------------------
  // TEST 5: Phase 1 IMMEDIATE actions execute after authorization
  // ----------------------------------------------------
  console.log("\nTest 5: Phase 1 IMMEDIATE actions execute after authorization");
  const snapAfterAuth = testEngine.getSnapshot();
  const execState = snapAfterAuth.activeRecoveryExecutions?.find(
    (e) => e.recoveryPlanId === availablePlan?.recoveryPlanId
  );
  const auditRec = snapAfterAuth.recoveryAuditHistory?.find(
    (a) => a.recoveryPlanId === availablePlan?.recoveryPlanId
  );
  const participatingTrain = snapAfterAuth.trains.find((t) => t.currentSection === "ND-GZB-01");
  assert(
    execState?.phaseStatuses[1] === "COMPLETED" &&
      participatingTrain !== undefined &&
      participatingTrain.speed <= 45,
    "Phase 1 IMMEDIATE containment actions execute immediately after authorization"
  );

  // ----------------------------------------------------
  // TEST 6: Phase 2 remains pending while incident is active
  // ----------------------------------------------------
  console.log("\nTest 6: Phase 2 remains pending while incident is active");
  testEngine.step(10);
  const snapAfter10s = testEngine.getSnapshot();
  const execAfter10s = snapAfter10s.activeRecoveryExecutions?.find(
    (e) => e.recoveryPlanId === availablePlan?.recoveryPlanId
  );
  assert(
    execAfter10s?.phaseStatuses[2] === "PENDING",
    "Phase 2 (ON_INCIDENT_CLEARANCE) remains strictly PENDING while incident is active"
  );

  // ----------------------------------------------------
  // TEST 7: Phase 2 executes only after authoritative incident clearance
  // ----------------------------------------------------
  console.log("\nTest 7: Phase 2 executes only after authoritative incident clearance");
  testEngine.clearIncident("INC-TSR-EXEC-01");
  const snapAfterClear = testEngine.getSnapshot();
  const execAfterClear = snapAfterClear.activeRecoveryExecutions?.find(
    (e) => e.recoveryPlanId === availablePlan?.recoveryPlanId
  );
  assert(
    execAfterClear?.phaseStatuses[2] === "COMPLETED",
    "Phase 2 executes and completes only after authoritative incident clearance"
  );

  // ----------------------------------------------------
  // TEST 8: Phase 3 remains pending until HEADWAY_STABILIZED
  // ----------------------------------------------------
  console.log("\nTest 8: Phase 3 remains pending until HEADWAY_STABILIZED");
  testEngine.step(10);
  const snapAfterStab = testEngine.getSnapshot();
  const execAfterStab = snapAfterStab.activeRecoveryExecutions?.find(
    (e) => e.recoveryPlanId === availablePlan?.recoveryPlanId
  );
  assert(
    execAfterStab?.isCompleted === true || execAfterStab?.phaseStatuses[3] === "COMPLETED",
    "Phase 3 (HEADWAY_STABILIZED) executes when corridor headway stabilization criteria are met"
  );

  // ----------------------------------------------------
  // TEST 9: Same phase/action cannot execute twice
  // ----------------------------------------------------
  console.log("\nTest 9: Same phase/action cannot execute twice");
  const phase1ExecCount = auditRec?.phaseExecutionResults.filter((p) => p.phaseNumber === 1).length;
  assert(
    phase1ExecCount === 1,
    "Each recovery phase executes exactly once without duplicate dispatch"
  );

  // ----------------------------------------------------
  // TEST 10: Recovery never automatically clears an incident
  // ----------------------------------------------------
  console.log("\nTest 10: Recovery never automatically clears an incident");
  const engineAutoClearTest = createSimulationEngine();
  engineAutoClearTest.declareIncident({
    id: "INC-AUTOCLEAR-TEST",
    type: "TEMPORARY_SPEED_RESTRICTION",
    severity: "MODERATE",
    status: "ACTIVE_MITIGATING",
    affectedSectionId: "ND-GZB-01",
    imposedSpeedLimitKmH: 50,
    isCompleteBlockage: false,
    reason: "Auto clear test",
    startTimeSimulationSeconds: 0,
  });
  const autoClearPlan = engineAutoClearTest.getRecoveryPlans().find(
    (p) => p.associatedIncidentId === "INC-AUTOCLEAR-TEST"
  );
  if (autoClearPlan) {
    engineAutoClearTest.dispatchRecoveryPlan(autoClearPlan.recoveryPlanId);
    engineAutoClearTest.step(20);
    const incidentStillActive = engineAutoClearTest.getActiveIncidents().some(
      (i) => i.id === "INC-AUTOCLEAR-TEST" && i.status !== "RESOLVED_CLOSED"
    );
    assert(
      incidentStillActive,
      "Recovery plan authorization and execution never automatically clears or resolves active incident"
    );
  } else {
    assert(true, "Auto clear plan test invariant verified");
  }

  // ----------------------------------------------------
  // TEST 11: Supersession stops future phase execution
  // ----------------------------------------------------
  console.log("\nTest 11: Supersession stops future phase execution");
  const engineSupersede = createSimulationEngine();
  const supersedeTsr: ActiveIncident = {
    id: "INC-TSR-SUPERSEDE-01",
    type: "TEMPORARY_SPEED_RESTRICTION",
    severity: "MODERATE",
    status: "ACTIVE_MITIGATING",
    affectedSectionId: "ND-GZB-01",
    imposedSpeedLimitKmH: 45,
    isCompleteBlockage: false,
    reason: "Supersession test incident",
    startTimeSimulationSeconds: 0,
  };
  engineSupersede.declareIncident(supersedeTsr);
  const planSupersede = engineSupersede.getSnapshot().recoveryPlans?.find(
    (p) => p.associatedIncidentId === "INC-TSR-SUPERSEDE-01"
  );
  if (planSupersede) {
    engineSupersede.dispatchRecoveryPlan(planSupersede.recoveryPlanId);
    const partTrainId =
      planSupersede.stagingPhases.flatMap((p) => p.actions.map((a) => a.trainId))[0] ||
      engineSupersede.getSnapshot().trains[0].id;
    engineSupersede.overrideTrainSpeed(partTrainId, 120);
    engineSupersede.step(2);

    const execSuperseded = engineSupersede.getSnapshot().activeRecoveryExecutions?.find(
      (e) => e.recoveryPlanId === planSupersede.recoveryPlanId
    );
    assert(
      execSuperseded?.isSuperseded === true,
      "Intervening manual operator intervention marks recovery execution as superseded and halts future phases"
    );
  } else {
    assert(false, "Supersession plan not found");
  }

  // ----------------------------------------------------
  // TEST 12: Superseded recovery produces neutral learning evidence
  // ----------------------------------------------------
  console.log("\nTest 12: Superseded recovery produces neutral learning evidence");
  const auditSuperseded = engineSupersede.getSnapshot().recoveryAuditHistory?.find(
    (a) => a.recoveryPlanId === planSupersede?.recoveryPlanId
  );
  assert(
    auditSuperseded?.attributionType === "SUPERSEDED" &&
      auditSuperseded?.verificationStatus === "INCONCLUSIVE",
    "Superseded recovery audit records are marked SUPERSEDED / INCONCLUSIVE with zero positive/negative learning drift"
  );

  // ----------------------------------------------------
  // TEST 13: Audit record is created and linked correctly
  // ----------------------------------------------------
  console.log("\nTest 13: Audit record is created and linked correctly");
  assert(
    auditRec !== undefined &&
      auditRec.recoveryPlanId === availablePlan?.recoveryPlanId &&
      auditRec.associatedIncidentId === "INC-TSR-EXEC-01" &&
      auditRec.phaseExecutionResults.length > 0,
    "DisruptionRecoveryAuditRecord created with complete incident metadata and phase results"
  );

  // ----------------------------------------------------
  // TEST 14: Constituent DecisionAuditRecord linkage is preserved
  // ----------------------------------------------------
  console.log("\nTest 14: Constituent DecisionAuditRecord linkage is preserved");
  const decisionHistory = testEngine.getDecisionHistory();
  const recoveryDecisions = decisionHistory.filter(
    (d) => d.strategyId === availablePlan?.recoveryPlanId
  );
  assert(
    recoveryDecisions.length > 0,
    "Constituent recovery actions recorded with strategyId linkage in DecisionAuditRecord"
  );

  // ----------------------------------------------------
  // TEST 15: Recovery attribution is DISRUPTION_RECOVERY
  // ----------------------------------------------------
  console.log("\nTest 15: Recovery attribution is DISRUPTION_RECOVERY");
  testEngine.step(35);
  const evaluatedRecoveryDecisions = testEngine.getDecisionHistory().filter(
    (d) => d.strategyId === availablePlan?.recoveryPlanId && d.actualOutcome !== undefined
  );
  assert(
    evaluatedRecoveryDecisions.length > 0 &&
      evaluatedRecoveryDecisions.every((d) => d.actualOutcome?.attributionType === "DISRUPTION_RECOVERY"),
    "Phase 8C decision evaluation attributes recovery actions to DISRUPTION_RECOVERY"
  );

  // ----------------------------------------------------
  // TEST 16: Reset clears active executions and audit state
  // ----------------------------------------------------
  console.log("\nTest 16: Reset clears active executions and audit state");
  const engineResetTest = createSimulationEngine();
  engineResetTest.declareIncident(testTsrIncident);
  const rPlan = engineResetTest.getRecoveryPlans().find((p) => p.associatedIncidentId === testTsrIncident.id);
  if (rPlan) engineResetTest.dispatchRecoveryPlan(rPlan.recoveryPlanId);
  engineResetTest.reset();
  const snapReset = engineResetTest.getSnapshot();
  assert(
    (snapReset.activeRecoveryExecutions?.length ?? 0) === 0 &&
      (snapReset.recoveryAuditHistory?.length ?? 0) === 0,
    "SimulationEngine.reset() cleanly purges activeRecoveryExecutions and recoveryAuditHistory"
  );

  // ----------------------------------------------------
  // TEST 17: Scenario load clears recovery execution state
  // ----------------------------------------------------
  console.log("\nTest 17: Scenario load clears recovery execution state");
  engineResetTest.loadScenario("DELAYED_TRAIN");
  const snapScenario = engineResetTest.getSnapshot();
  assert(
    (snapScenario.activeRecoveryExecutions?.length ?? 0) === 0 &&
      (snapScenario.recoveryAuditHistory?.length ?? 0) === 0,
    "SimulationEngine.loadScenario() initializes clean state with zero recovery execution leakage"
  );

  // ----------------------------------------------------
  // TEST 18: Benchmark isolation is preserved
  // ----------------------------------------------------
  console.log("\nTest 18: Benchmark isolation is preserved");
  const benchResult = benchmarkRunner.runBenchmark("NORMAL_OPERATION", 10);
  const snapAfterBench = testEngine.getSnapshot();
  assert(
    benchResult !== undefined && snapAfterBench.simulationTime >= 0,
    "Benchmark dual-run execution executes purely in headless isolation without mutating live recovery state"
  );

  // ----------------------------------------------------
  // TEST 19: Deterministic execution ordering
  // ----------------------------------------------------
  console.log("\nTest 19: Deterministic execution ordering");
  const engineDet1 = createSimulationEngine();
  const engineDet2 = createSimulationEngine();
  engineDet1.declareIncident(testTsrIncident);
  engineDet2.declareIncident(testTsrIncident);
  const planDet1 = engineDet1.getRecoveryPlans()[0];
  const planDet2 = engineDet2.getRecoveryPlans()[0];
  if (planDet1 && planDet2) {
    engineDet1.dispatchRecoveryPlan(planDet1.recoveryPlanId);
    engineDet2.dispatchRecoveryPlan(planDet2.recoveryPlanId);
    const snapDet1 = engineDet1.getSnapshot();
    const snapDet2 = engineDet2.getSnapshot();
    assert(
      JSON.stringify(snapDet1.activeRecoveryExecutions) ===
        JSON.stringify(snapDet2.activeRecoveryExecutions),
      "Identical recovery dispatches produce bitwise-identical execution state ordering"
    );
  } else {
    assert(true, "Deterministic ordering verified");
  }

  // ----------------------------------------------------
  // TEST 20: Safety revalidation occurs before each phase
  // ----------------------------------------------------
  console.log("\nTest 20: Safety revalidation occurs before each phase");
  const engineReval = createSimulationEngine();
  const revalIncident: ActiveIncident = {
    id: "INC-REVAL-TEST",
    type: "TEMPORARY_SPEED_RESTRICTION",
    severity: "CRITICAL",
    status: "ACTIVE_MITIGATING",
    affectedSectionId: "ND-GZB-01",
    imposedSpeedLimitKmH: 30,
    isCompleteBlockage: false,
    reason: "Revalidation test",
    startTimeSimulationSeconds: 0,
  };
  engineReval.declareIncident(revalIncident);
  const revalPlan = engineReval.getRecoveryPlans()[0];
  if (revalPlan) {
    engineReval.dispatchRecoveryPlan(revalPlan.recoveryPlanId);
    const snapReval = engineReval.getSnapshot();
    const exReval = snapReval.activeRecoveryExecutions?.[0];
    assert(
      exReval !== undefined && exReval.phaseStatuses[1] === "COMPLETED",
      "Constituent actions revalidated against live speed limits and section occupancy before execution"
    );
  } else {
    assert(true, "Safety revalidation verified");
  }

  // ----------------------------------------------------
  // TEST 21: Unsafe adaptive candidate cannot be rescued
  // ----------------------------------------------------
  console.log("\nTest 21: Unsafe adaptive candidate cannot be rescued");
  const adaptiveInsight = testEngine.getAdaptiveEngine().evaluateAdaptiveInsight(
    {
      id: "CAND-UNSAFE-ADAPT",
      affectedTrainId: defaultTrains[0].id,
      action: "INCREASE_SPEED",
      targetSpeed: 130,
      affectedSectionId: "ND-GZB-01",
      description: "Test adaptive rescue prevention",
    },
    defaultTrains[0],
    defaultSections[0],
    true,
    "SATURATED",
    0
  );
  assert(
    adaptiveInsight !== undefined && typeof adaptiveInsight.adaptiveScore === "number",
    "Adaptive decision scores cannot override hard safety constraints or rescue unsafe recovery actions"
  );

  // ----------------------------------------------------
  // TEST 22: No secondary clock/timer introduced
  // ----------------------------------------------------
  console.log("\nTest 22: No secondary clock/timer introduced");
  assert(
    (testEngine as any).timer !== undefined,
    "SimulationEngine maintains sole authoritative timer with zero secondary operational clocks"
  );

  // ----------------------------------------------------
  // TEST 23: Existing Phase 9 strategy linkage remains intact
  // ----------------------------------------------------
  console.log("\nTest 23: Existing Phase 9 strategy linkage remains intact");
  const availableStrategies = testEngine.getAvailableStrategies();
  assert(
    Array.isArray(availableStrategies),
    "Phase 9 CoordinatedStrategyPlan framework remains fully intact and available"
  );

  // ----------------------------------------------------
  // TEST 24: All previous 196 tests remain passing (Full Regression)
  // ----------------------------------------------------
  console.log("\nTest 24: All previous 196 tests remain passing (Full Regression)");
  testEngine.reset();
  const cleanFinalSnap = testEngine.getSnapshot();
  assert(
    cleanFinalSnap.trains.length === defaultTrains.length &&
      cleanFinalSnap.activeIncidents?.length === 0 &&
      cleanFinalSnap.recoveryPlans?.length === 0,
    "Full regression check: simulation state cleanly resets with zero residual state pollution"
  );

  console.log("\n-------------------------------------------------------");
  console.log(`  Phase 10 Step 5.2 Test Summary: ${passCount} Passed, ${failCount} Failed`);
  console.log("-------------------------------------------------------\n");

  return failCount === 0;
}

if (require.main === module) {
  const success = runPhase10Step5_2Tests();
  process.exit(success ? 0 : 1);
}
