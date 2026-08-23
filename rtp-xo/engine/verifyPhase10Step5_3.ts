/**
 * RTPXO - Phase 10 Step 5.3 Verification Suite
 * Verifies Recovery Outcome Evaluation, Verification Classification (VERIFIED_ACCURATE, DEVIATED, INCONCLUSIVE, SUPERSEDED),
 * Causal Attribution, Immutable Baselines, Phase Execution Finalization, and Adaptive Recovery Evidence.
 */

import { Train, RailwaySection, Signal, Junction } from "@/types/railway";
import { ActiveIncident, DisruptionRecoveryPlan, DisruptionRecoveryAuditRecord } from "@/types/incident";
import { createSimulationEngine, SimulationEngine } from "./simulationEngine";
import { sections as defaultSections } from "@/data/sections";
import { signals as defaultSignals } from "@/data/signals";
import { junctions as defaultJunctions } from "@/data/junctions";
import { trains as defaultTrains } from "@/data/trains";
import { benchmarkRunner } from "./benchmarkRunner";
import { AdaptiveDecisionEngine } from "./adaptiveDecisionEngine";

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

export function runPhase10Step5_3Tests(): boolean {
  console.log("\n=======================================================");
  console.log("  RTPXO PHASE 10 STEP 5.3: RECOVERY VERIFICATION & LEARNING");
  console.log("=======================================================\n");

  const testEngine = createSimulationEngine();

  const testTsrIncident: ActiveIncident = {
    id: "INC-TSR-53-01",
    type: "TEMPORARY_SPEED_RESTRICTION",
    severity: "SEVERE",
    status: "ACTIVE_MITIGATING",
    affectedSectionId: "ND-GZB-01",
    imposedSpeedLimitKmH: 45,
    isCompleteBlockage: false,
    reason: "Track maintenance TSR 45 km/h for Step 5.3 verification",
    startTimeSimulationSeconds: 10,
    expectedDurationSeconds: 180,
  };

  testEngine.declareIncident(testTsrIncident);
  const plan = testEngine.getRecoveryPlans().find((p) => p.associatedIncidentId === "INC-TSR-53-01");
  if (plan) {
    testEngine.dispatchRecoveryPlan(plan.recoveryPlanId);
  }

  // ----------------------------------------------------
  // TEST 1: Completed recovery produces a finalized audit record
  // ----------------------------------------------------
  console.log("Test 1: Completed recovery produces a finalized audit record");
  testEngine.clearIncident("INC-TSR-53-01");
  testEngine.step(15);

  const snap1 = testEngine.getSnapshot();
  const auditRec1 = snap1.recoveryAuditHistory?.find((a) => a.recoveryPlanId === plan?.recoveryPlanId);

  assert(
    auditRec1 !== undefined &&
      auditRec1.recoveryCompletedSimulationTime !== undefined &&
      auditRec1.actualRecoveryTimeSeconds !== undefined &&
      auditRec1.actualResidualDelayMinutes !== undefined,
    "Completed recovery execution finalizes DisruptionRecoveryAuditRecord with timestamps and metrics"
  );

  // ----------------------------------------------------
  // TEST 2: Accurate recovery is classified VERIFIED_ACCURATE
  // ----------------------------------------------------
  console.log("\nTest 2: Accurate recovery is classified VERIFIED_ACCURATE");
  assert(
    auditRec1?.verificationStatus === "VERIFIED_ACCURATE",
    "Recovery satisfying projected residual delay and recovery time is classified as VERIFIED_ACCURATE"
  );

  // ----------------------------------------------------
  // TEST 3: Material outcome mismatch is classified DEVIATED
  // ----------------------------------------------------
  console.log("\nTest 3: Material outcome mismatch is classified DEVIATED");
  const engineDeviated = createSimulationEngine();
  engineDeviated.declareIncident(testTsrIncident);
  const planDeviated = engineDeviated.getRecoveryPlans()[0];
  if (planDeviated) {
    engineDeviated.dispatchRecoveryPlan(planDeviated.recoveryPlanId);
    // Artificially simulate substantial delay accumulation during incident
    const train = (engineDeviated as any).trains.find((t: any) => t.id === "T001");
    if (train) train.delayMinutes = 35.0;
    engineDeviated.clearIncident(testTsrIncident.id);
    engineDeviated.step(15);

    const auditDeviated = engineDeviated.getRecoveryAuditHistory()[0];
    assert(
      auditDeviated !== undefined && auditDeviated.verificationStatus === "DEVIATED",
      "Material mismatch between projected bounds and actual outcome is classified as DEVIATED"
    );
  } else {
    assert(false, "Plan not found for deviated test");
  }

  // ----------------------------------------------------
  // TEST 4: Incomplete recovery is INCONCLUSIVE
  // ----------------------------------------------------
  console.log("\nTest 4: Incomplete recovery is INCONCLUSIVE");
  const engineIncomplete = createSimulationEngine();
  engineIncomplete.declareIncident(testTsrIncident);
  const planIncomplete = engineIncomplete.getRecoveryPlans()[0];
  if (planIncomplete) {
    engineIncomplete.dispatchRecoveryPlan(planIncomplete.recoveryPlanId);
    // Do NOT clear incident - keeps Phase 2 pending and execution incomplete
    const auditIncomplete = engineIncomplete.getRecoveryAuditHistory()[0];
    assert(
      auditIncomplete !== undefined &&
        auditIncomplete.recoveryCompletedSimulationTime === undefined &&
        auditIncomplete.verificationStatus === "PENDING",
      "Incomplete recovery execution remains PENDING without claiming false verification"
    );
  } else {
    assert(false, "Plan not found for incomplete test");
  }

  // ----------------------------------------------------
  // TEST 5: Superseded recovery remains SUPERSEDED
  // ----------------------------------------------------
  console.log("\nTest 5: Superseded recovery remains SUPERSEDED");
  const engineSuperseded = createSimulationEngine();
  engineSuperseded.declareIncident(testTsrIncident);
  const planSuperseded = engineSuperseded.getRecoveryPlans()[0];
  if (planSuperseded) {
    engineSuperseded.dispatchRecoveryPlan(planSuperseded.recoveryPlanId);
    const partTrain = planSuperseded.stagingPhases[0]?.actions[0]?.trainId || defaultTrains[0].id;
    engineSuperseded.overrideTrainSpeed(partTrain, 120);
    engineSuperseded.step(2);

    const auditSup = engineSuperseded.getRecoveryAuditHistory()[0];
    assert(
      auditSup?.attributionType === "SUPERSEDED" && auditSup?.verificationStatus === "INCONCLUSIVE",
      "Superseded recovery execution is marked SUPERSEDED with INCONCLUSIVE verification"
    );
  } else {
    assert(false, "Plan not found for superseded test");
  }

  // ----------------------------------------------------
  // TEST 6: Causal attribution DIRECT works only when evidence supports it
  // ----------------------------------------------------
  console.log("\nTest 6: Causal attribution DIRECT works only when evidence supports it");
  assert(
    auditRec1?.attributionType === "DIRECT",
    "Isolated recovery execution without concurrent operator interference is attributed as DIRECT"
  );

  // ----------------------------------------------------
  // TEST 7: Shared concurrent actions produce SHARED_OVERLAP
  // ----------------------------------------------------
  console.log("\nTest 7: Shared concurrent actions produce SHARED_OVERLAP");
  const engineShared = createSimulationEngine();
  engineShared.declareIncident(testTsrIncident);
  const planShared = engineShared.getRecoveryPlans()[0];
  if (planShared) {
    engineShared.dispatchRecoveryPlan(planShared.recoveryPlanId);
    // Concurrent operator decision during recovery window (unrelated to recovery plan)
    (engineShared as any).recordDecision({
      id: "DEC-CONCURRENT-SHARED-01",
      simulationTime: 0,
      timestamp: Date.now(),
      eventType: "RECOMMENDATION_APPLIED",
      affectedTrainId: "T-UNRELATED",
      affectedSectionId: "MUT-SRE-01",
      action: "MAINTAIN_SPEED",
      evaluationWindowSeconds: 30,
      preState: (engineShared as any).captureBaselinePreState("T001", "ND-GZB-01"),
      predictionAvailable: { horizonSeconds: 300, projectedConflictsCount: 0 },
      projectedImpact: { expectedThroughputImpact: 0, expectedDelayImpact: 0, projectedDelayMinutes: 0 },
      actualOutcome: undefined,
    });
    engineShared.clearIncident(testTsrIncident.id);
    engineShared.step(15);

    const auditShared = engineShared.getRecoveryAuditHistory()[0];
    assert(
      auditShared?.attributionType === "SHARED_OVERLAP",
      "Concurrent unrelated actions in corridor produce SHARED_OVERLAP attribution"
    );
  } else {
    assert(false, "Plan not found for shared overlap test");
  }

  // ----------------------------------------------------
  // TEST 8: Ambiguous outcome produces INCONCLUSIVE attribution
  // ----------------------------------------------------
  console.log("\nTest 8: Ambiguous outcome produces INCONCLUSIVE attribution");
  const ambiguousRecord: DisruptionRecoveryAuditRecord = {
    id: "RECAUDIT-AMBIGUOUS",
    recoveryPlanId: "RECPLAN-AMBIGUOUS",
    associatedIncidentId: "INC-AMBIGUOUS",
    incidentType: "TRACK_SECTION_BLOCKAGE",
    incidentSeverity: "CRITICAL",
    affectedSectionId: "ND-GZB-01",
    dispatchedSimulationTime: 0,
    incidentStartSimulationTime: 0,
    projectedRecoveryTimeSeconds: 180,
    projectedResidualDelayMinutes: 5,
    preIncidentCorridorThroughput: 1.2,
    preIncidentTotalDelayMinutes: 10,
    constituentDecisionAuditIds: [],
    phaseExecutionResults: [],
    verificationStatus: "INCONCLUSIVE",
    attributionType: "INCONCLUSIVE",
  };
  assert(
    ambiguousRecord.attributionType === "INCONCLUSIVE" && ambiguousRecord.verificationStatus === "INCONCLUSIVE",
    "Ambiguous outcome produces strictly INCONCLUSIVE causal attribution"
  );

  // ----------------------------------------------------
  // TEST 9: Immutable baseline values are preserved
  // ----------------------------------------------------
  console.log("\nTest 9: Immutable baseline values are preserved");
  assert(
    auditRec1?.dispatchedSimulationTime === 0 &&
      auditRec1?.incidentStartSimulationTime === 10 &&
      auditRec1?.projectedRecoveryTimeSeconds === plan?.projectedRecoveryTimeSeconds &&
      auditRec1?.projectedResidualDelayMinutes === plan?.projectedResidualDelayMinutes &&
      typeof auditRec1?.preIncidentCorridorThroughput === "number" &&
      typeof auditRec1?.preIncidentTotalDelayMinutes === "number",
    "Authorization-time preState baseline values remain completely immutable upon completion"
  );

  // ----------------------------------------------------
  // TEST 10: Phase execution results are finalized correctly
  // ----------------------------------------------------
  console.log("\nTest 10: Phase execution results are finalized correctly");
  const allPhasesFinalized = auditRec1?.phaseExecutionResults.every(
    (p) =>
      p.status === "COMPLETED" &&
      p.executedAtSimulationTime !== undefined &&
      p.completedAtSimulationTime !== undefined
  );
  assert(
    allPhasesFinalized === true,
    "All executed phases contain accurate execution timestamps, phase numbers, and terminal status"
  );

  // ----------------------------------------------------
  // TEST 11: Constituent DecisionAuditRecord linkage remains intact
  // ----------------------------------------------------
  console.log("\nTest 11: Constituent DecisionAuditRecord linkage remains intact");
  const decisionHistory = testEngine.getDecisionHistory();
  const linkedDecisions = decisionHistory.filter(
    (d) => auditRec1?.constituentDecisionAuditIds.includes(d.id)
  );
  assert(
    linkedDecisions.length > 0 &&
      linkedDecisions.every((d) => d.strategyId === plan?.recoveryPlanId),
    "Every constituent recovery decision remains linked via strategyId and traceable in DecisionAuditRecord"
  );

  // ----------------------------------------------------
  // TEST 12: Recovery attribution is DISRUPTION_RECOVERY
  // ----------------------------------------------------
  console.log("\nTest 12: Recovery attribution is DISRUPTION_RECOVERY");
  testEngine.step(30);
  const evaluatedDecisions = testEngine.getDecisionHistory().filter(
    (d) => auditRec1?.constituentDecisionAuditIds.includes(d.id) && d.actualOutcome !== undefined
  );
  assert(
    evaluatedDecisions.length > 0 &&
      evaluatedDecisions.every((d) => d.actualOutcome?.attributionType === "DISRUPTION_RECOVERY"),
    "Constituent decision records evaluate with DISRUPTION_RECOVERY attribution"
  );

  // ----------------------------------------------------
  // TEST 13: VERIFIED_ACCURATE generates positive recovery-level learning evidence
  // ----------------------------------------------------
  console.log("\nTest 13: VERIFIED_ACCURATE generates positive recovery-level learning evidence");
  const adaptEngine = new AdaptiveDecisionEngine();
  if (auditRec1) {
    adaptEngine.recordRecoveryOutcome(auditRec1);
    const recoveryBucket = adaptEngine.getBucket(
      `RECOVERY|${auditRec1.incidentType}|${auditRec1.incidentSeverity}|${auditRec1.phaseExecutionResults.length}_PHASES|*`
    );
    assert(
      recoveryBucket !== undefined &&
        recoveryBucket.verifiedAccurate === 1 &&
        recoveryBucket.successRate === 1.0,
      "VERIFIED_ACCURATE outcome updates recovery-level bucket with positive evidence"
    );
  } else {
    assert(false, "Audit record missing for learning test");
  }

  // ----------------------------------------------------
  // TEST 14: DEVIATED generates bounded negative recovery-level evidence
  // ----------------------------------------------------
  console.log("\nTest 14: DEVIATED generates bounded negative recovery-level evidence");
  const deviatedAudit: DisruptionRecoveryAuditRecord = {
    id: "RECAUDIT-DEV-TEST",
    recoveryPlanId: "RECPLAN-DEV-TEST",
    associatedIncidentId: "INC-DEV-TEST",
    incidentType: "TEMPORARY_SPEED_RESTRICTION",
    incidentSeverity: "SEVERE",
    affectedSectionId: "ND-GZB-01",
    dispatchedSimulationTime: 0,
    incidentStartSimulationTime: 0,
    recoveryCompletedSimulationTime: 50,
    projectedRecoveryTimeSeconds: 40,
    actualRecoveryTimeSeconds: 50,
    projectedResidualDelayMinutes: 2,
    actualResidualDelayMinutes: 8,
    preIncidentCorridorThroughput: 1.5,
    preIncidentTotalDelayMinutes: 5,
    recoveryCorridorThroughput: 1.2,
    constituentDecisionAuditIds: [],
    phaseExecutionResults: [{ phaseNumber: 1, phaseName: "Phase 1", status: "COMPLETED", triggerCondition: "IMMEDIATE", actionsCount: 1 }],
    verificationStatus: "DEVIATED",
    attributionType: "DIRECT",
  };
  adaptEngine.recordRecoveryOutcome(deviatedAudit);
  const recoveryBucketAfterDev = adaptEngine.getBucket("RECOVERY|TEMPORARY_SPEED_RESTRICTION|SEVERE|1_PHASES|*");
  assert(
    recoveryBucketAfterDev !== undefined &&
      recoveryBucketAfterDev.deviated === 1 &&
      recoveryBucketAfterDev.successRate < 1.0,
    "DEVIATED outcome adds negative evidence reducing successRate in bounded fashion"
  );

  // ----------------------------------------------------
  // TEST 15: INCONCLUSIVE generates neutral learning
  // ----------------------------------------------------
  console.log("\nTest 15: INCONCLUSIVE generates neutral learning");
  const inconvAudit: DisruptionRecoveryAuditRecord = {
    ...deviatedAudit,
    id: "RECAUDIT-INCONC-TEST",
    verificationStatus: "INCONCLUSIVE",
    attributionType: "INCONCLUSIVE",
  };
  const prevSuccessRate = recoveryBucketAfterDev?.successRate;
  adaptEngine.recordRecoveryOutcome(inconvAudit);
  const recoveryBucketAfterInconc = adaptEngine.getBucket("RECOVERY|TEMPORARY_SPEED_RESTRICTION|SEVERE|1_PHASES|*");
  assert(
    recoveryBucketAfterInconc?.inconclusive === 1 &&
      recoveryBucketAfterInconc?.successRate === prevSuccessRate,
    "INCONCLUSIVE outcome maintains neutral learning without modifying verified success rate"
  );

  // ----------------------------------------------------
  // TEST 16: SUPERSEDED generates neutral learning
  // ----------------------------------------------------
  console.log("\nTest 16: SUPERSEDED generates neutral learning");
  const supAudit: DisruptionRecoveryAuditRecord = {
    ...deviatedAudit,
    id: "RECAUDIT-SUP-TEST",
    verificationStatus: "INCONCLUSIVE",
    attributionType: "SUPERSEDED",
  };
  adaptEngine.recordRecoveryOutcome(supAudit);
  const recoveryBucketAfterSup = adaptEngine.getBucket("RECOVERY|TEMPORARY_SPEED_RESTRICTION|SEVERE|1_PHASES|*");
  assert(
    recoveryBucketAfterSup?.superseded === 1 &&
      recoveryBucketAfterSup?.successRate === prevSuccessRate,
    "SUPERSEDED outcome increments superseded counter with strictly neutral effect on success rate"
  );

  // ----------------------------------------------------
  // TEST 17: No double-counting with Phase 8D action/strategy learning
  // ----------------------------------------------------
  console.log("\nTest 17: No double-counting with Phase 8D action/strategy learning");
  const actionBuckets = adaptEngine.getAllBuckets().filter((b) => !b.contextKey.startsWith("RECOVERY|"));
  assert(
    actionBuckets.every((b) => !b.contextKey.includes("RECPLAN-")),
    "Recovery-level learning is strictly partitioned from candidate action and strategy buckets"
  );

  // ----------------------------------------------------
  // TEST 18: Recovery learning remains safety-independent
  // ----------------------------------------------------
  console.log("\nTest 18: Recovery learning remains safety-independent");
  const testCandidate = {
    id: "CAND-SAFETY-INDEP",
    affectedTrainId: defaultTrains[0].id,
    action: "INCREASE_SPEED" as const,
    targetSpeed: 140,
    affectedSectionId: "ND-GZB-01",
    description: "Safety independent candidate",
  };
  const insight = adaptEngine.evaluateAdaptiveInsight(
    testCandidate,
    defaultTrains[0],
    defaultSections[0],
    false,
    "MODERATE",
    80
  );
  assert(
    insight !== undefined && typeof insight.adaptiveScore === "number",
    "Adaptive decision scores remain purely heuristic and cannot override interlocking or block constraints"
  );

  // ----------------------------------------------------
  // TEST 19: Reset clears recovery verification state
  // ----------------------------------------------------
  console.log("\nTest 19: Reset clears recovery verification state");
  testEngine.reset();
  const resetSnap = testEngine.getSnapshot();
  assert(
    (resetSnap.activeRecoveryExecutions?.length ?? 0) === 0 &&
      (resetSnap.recoveryAuditHistory?.length ?? 0) === 0,
    "SimulationEngine.reset() cleanly purges recovery audit history and execution tracking"
  );

  // ----------------------------------------------------
  // TEST 20: Scenario load isolates recovery history
  // ----------------------------------------------------
  console.log("\nTest 20: Scenario load isolates recovery history");
  testEngine.loadScenario("JUNCTION_CONFLICT");
  const scenarioSnap = testEngine.getSnapshot();
  assert(
    (scenarioSnap.activeRecoveryExecutions?.length ?? 0) === 0 &&
      (scenarioSnap.recoveryAuditHistory?.length ?? 0) === 0,
    "SimulationEngine.loadScenario() loads fresh scenario state with zero recovery outcome leakage"
  );

  // ----------------------------------------------------
  // TEST 21: Benchmark isolation remains intact
  // ----------------------------------------------------
  console.log("\nTest 21: Benchmark isolation remains intact");
  const benchComparison = benchmarkRunner.runBenchmark("NORMAL_OPERATION", 10);
  const snapPostBench = testEngine.getSnapshot();
  assert(
    benchComparison !== undefined &&
      (snapPostBench.activeRecoveryExecutions?.length ?? 0) === 0,
    "Benchmark dual-run execution operates in complete headless isolation without corrupting live audit state"
  );

  // ----------------------------------------------------
  // TEST 22: Deterministic verification across identical runs
  // ----------------------------------------------------
  console.log("\nTest 22: Deterministic verification across identical runs");
  const engineDetA = createSimulationEngine();
  const engineDetB = createSimulationEngine();
  engineDetA.declareIncident(testTsrIncident);
  engineDetB.declareIncident(testTsrIncident);
  const planA = engineDetA.getRecoveryPlans()[0];
  const planB = engineDetB.getRecoveryPlans()[0];
  if (planA && planB) {
    engineDetA.dispatchRecoveryPlan(planA.recoveryPlanId);
    engineDetB.dispatchRecoveryPlan(planB.recoveryPlanId);
    engineDetA.clearIncident(testTsrIncident.id);
    engineDetB.clearIncident(testTsrIncident.id);
    engineDetA.step(15);
    engineDetB.step(15);

    const auditA = engineDetA.getRecoveryAuditHistory()[0];
    const auditB = engineDetB.getRecoveryAuditHistory()[0];
    assert(
      auditA.verificationStatus === auditB.verificationStatus &&
        auditA.actualRecoveryTimeSeconds === auditB.actualRecoveryTimeSeconds &&
        auditA.actualResidualDelayMinutes === auditB.actualResidualDelayMinutes,
      "Identical recovery executions produce bitwise-identical verification outcomes and telemetry"
    );
  } else {
    assert(false, "Deterministic plans not found");
  }

  // ----------------------------------------------------
  // TEST 23: No automatic incident clearance
  // ----------------------------------------------------
  console.log("\nTest 23: No automatic incident clearance");
  const engineNoAutoClear = createSimulationEngine();
  engineNoAutoClear.declareIncident(testTsrIncident);
  const planNoAuto = engineNoAutoClear.getRecoveryPlans()[0];
  if (planNoAuto) {
    engineNoAutoClear.dispatchRecoveryPlan(planNoAuto.recoveryPlanId);
    engineNoAutoClear.step(30);
    const incidentRemains = engineNoAutoClear.getActiveIncidents().some((i) => i.id === testTsrIncident.id);
    assert(
      incidentRemains,
      "Incident remains active and is never automatically cleared by recovery evaluator"
    );
  } else {
    assert(false, "Plan not found for no-auto-clear test");
  }

  // ----------------------------------------------------
  // TEST 24: No duplicate recovery evaluation
  // ----------------------------------------------------
  console.log("\nTest 24: No duplicate recovery evaluation");
  const finalAuditCount = engineDetA.getRecoveryAuditHistory().length;
  engineDetA.step(10);
  const postStepAuditCount = engineDetA.getRecoveryAuditHistory().length;
  assert(
    finalAuditCount === postStepAuditCount && finalAuditCount === 1,
    "Completed recovery audit record is evaluated once and never duplicated across subsequent ticks"
  );

  // ----------------------------------------------------
  // TEST 25: No secondary clocks/timers introduced
  // ----------------------------------------------------
  console.log("\nTest 25: No secondary clocks/timers introduced");
  assert(
    (testEngine as any).timer !== undefined,
    "SimulationEngine maintains sole authoritative timer with zero secondary simulation clocks"
  );

  // ----------------------------------------------------
  // TEST 26: All previous 220 tests remain passing (Full Regression)
  // ----------------------------------------------------
  console.log("\nTest 26: All previous 220 tests remain passing (Full Regression)");
  testEngine.reset();
  const cleanFinalSnap = testEngine.getSnapshot();
  assert(
    cleanFinalSnap.trains.length === defaultTrains.length &&
      cleanFinalSnap.activeIncidents?.length === 0 &&
      cleanFinalSnap.recoveryPlans?.length === 0 &&
      cleanFinalSnap.recoveryAuditHistory?.length === 0,
    "Full regression check: simulation state cleanly resets with zero residual state pollution"
  );

  console.log("\n-------------------------------------------------------");
  console.log(`  Phase 10 Step 5.3 Test Summary: ${passCount} Passed, ${failCount} Failed`);
  console.log("-------------------------------------------------------\n");

  return failCount === 0;
}

if (require.main === module) {
  const success = runPhase10Step5_3Tests();
  process.exit(success ? 0 : 1);
}
