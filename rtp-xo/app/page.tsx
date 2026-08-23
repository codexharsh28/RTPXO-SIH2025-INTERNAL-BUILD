"use client";

import { useEffect, useState } from "react";
import { Train, RailwaySection } from "@/types/railway";
import { SimulationSnapshot } from "@/types/simulation";
import { AIRecommendation } from "@/types/advisor";
import { simulationEngine } from "@/engine/simulationEngine";
import { LiveHeader, CommandWorkspace } from "@/components/operations/LiveHeader";
import { NetworkMap } from "@/components/railway/NetworkMap";
import { CompactFleetRoster } from "@/components/operations/CompactFleetRoster";
import { CompactNetworkHealth } from "@/components/operations/CompactNetworkHealth";
import { CompactAdvisorHub } from "@/components/operations/CompactAdvisorHub";
import { TrainDetailDrawer } from "@/components/operations/TrainDetailDrawer";
import { SpeedTrajectoryVisualizer } from "@/components/operations/SpeedTrajectoryVisualizer";
import { OperatorWorkflowTour } from "@/components/operations/OperatorWorkflowTour";
import { BenchmarkPanel } from "@/components/operations/BenchmarkPanel";
import { IncidentControlPanel } from "@/components/operations/IncidentControlPanel";
import { DecisionAuditDrawer } from "@/components/operations/DecisionAuditDrawer";
import { EventLogPanel } from "@/components/operations/EventLogPanel";
import { TrainTable } from "@/components/operations/TrainTable";
import { SectionStatusPanel } from "@/components/operations/SectionStatusPanel";
import { ThroughputPanel } from "@/components/operations/ThroughputPanel";
import { MultiLineNetworkExplorer } from "@/components/operations/MultiLineNetworkExplorer";
import { StrategyOrchestrationPanel } from "@/components/operations/StrategyOrchestrationPanel";
import { TimelineScrubber } from "@/components/operations/TimelineScrubber";
import { ScenarioControlPanel } from "@/components/operations/ScenarioControlPanel";

export default function Home() {
  // Subscribe to the unified SimulationEngine (single authoritative source of truth)
  const [snapshot, setSnapshot] = useState<SimulationSnapshot>(() =>
    simulationEngine.getSnapshot()
  );

  // Local UI Navigation & Inspection State
  const [activeWorkspace, setActiveWorkspace] = useState<CommandWorkspace>("OPERATIONS");
  const [selectedTrainId, setSelectedTrainId] = useState<string | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [inspectingRec, setInspectingRec] = useState<AIRecommendation | null>(null);
  const [showTourModal, setShowTourModal] = useState<boolean>(false);

  useEffect(() => {
    const unsubscribe = simulationEngine.subscribe((newSnapshot) => {
      setSnapshot(newSnapshot);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Resolve selected domain objects from the live snapshot
  const selectedTrain =
    snapshot.trains.find((t) => t.id === selectedTrainId) || null;
  const selectedSection =
    snapshot.sections.find((s) => s.id === selectedSectionId) || null;

  const handleSelectTrain = (train: Train) => {
    setSelectedTrainId((prev) => (prev === train.id ? null : train.id));
  };

  const handleSelectTrainById = (trainId: string) => {
    setSelectedTrainId(trainId);
  };

  const handleSelectSection = (section: RailwaySection) => {
    setSelectedSectionId((prev) => (prev === section.id ? null : section.id));
  };

  const handleSelectSectionById = (sectionId: string) => {
    setSelectedSectionId((prev) => (prev === sectionId ? null : sectionId));
  };

  return (
    <div className="h-screen w-screen bg-[#090d16] text-slate-100 flex flex-col font-sans select-none overflow-hidden">
      {/* 1. TOP COMMAND BAR & 2. SECONDARY NAVIGATION */}
      <LiveHeader
        snapshot={snapshot}
        activeWorkspace={activeWorkspace}
        onSelectWorkspace={setActiveWorkspace}
        onOpenTour={() => setShowTourModal(true)}
      />

      {/* MAIN VIEWPORT-LOCKED CONTENT (Zero outer page scrolling, continuous simulation) */}
      <main className="flex-1 p-2 flex flex-col gap-2 min-h-0 overflow-hidden">
        {/* WORKSPACE 1: LIVE OPERATIONS (Single-Screen Primary Command Console) */}
        {activeWorkspace === "OPERATIONS" && (
          <div className="flex-1 flex flex-col gap-1.5 min-h-0 overflow-hidden">
            {/* Main Operations Area: Dominant Railway Network Visualization (~52% height) */}
            <div className="flex-[52] min-h-[175px] flex flex-col overflow-hidden">
              <NetworkMap
                snapshot={snapshot}
                selectedTrain={selectedTrain}
                selectedSection={selectedSection}
                onSelectTrain={handleSelectTrain}
                onSelectSection={handleSelectSection}
              />
            </div>

            {/* Lower Operational Strip: 3-Column Tactical Hub (~48% height) */}
            <div className="flex-[48] min-h-[165px] grid grid-cols-1 md:grid-cols-12 gap-1.5 overflow-hidden">
              {/* Area 1: Active Trains Fleet (Col span 4) */}
              <div className="md:col-span-4 h-full min-h-0 overflow-hidden">
                <CompactFleetRoster
                  trains={snapshot.trains}
                  selectedTrainId={selectedTrainId}
                  conflicts={snapshot.conflicts}
                  bottlenecks={snapshot.networkAssessment?.activeBottlenecks}
                  onSelectTrain={handleSelectTrain}
                />
              </div>

              {/* Area 2: Network Health & Safety Assurance (Col span 4) */}
              <div className="md:col-span-4 h-full min-h-0 overflow-hidden">
                <CompactNetworkHealth
                  conflicts={snapshot.conflicts}
                  predictedConflicts={snapshot.predictedConflicts}
                  throughputMetrics={snapshot.throughputMetrics}
                  sectionUtilizations={snapshot.telemetry.sectionUtilizations}
                  sections={snapshot.sections}
                  blocks={snapshot.blocks}
                  occupiedBlocks={snapshot.occupiedBlocks}
                  clearBlocks={snapshot.clearBlocks}
                  congestedSections={snapshot.congestedSections}
                  networkHealth={snapshot.networkHealth}
                  networkCapacity={snapshot.networkCapacity}
                  averageDelay={snapshot.averageDelay}
                  throughput={snapshot.throughput}
                  trains={snapshot.trains}
                  telemetry={snapshot.telemetry}
                  onSelectTrainById={handleSelectTrainById}
                  onSelectSectionById={handleSelectSectionById}
                />
              </div>

              {/* Area 3: RTPXO Decision Support Advisor & Dispatch (Col span 4) */}
              <div className="md:col-span-4 h-full min-h-0 overflow-hidden">
                <CompactAdvisorHub
                  snapshot={snapshot}
                  onOpenExplain={(rec) => setInspectingRec(rec)}
                  onOpenRecoveryTab={() => setActiveWorkspace("RECOVERY")}
                  onSelectTrainById={handleSelectTrainById}
                />
              </div>
            </div>
          </div>
        )}

        {/* WORKSPACE 2: NETWORK TOPOLOGY & MULTI-LINE EXPLORER */}
        {activeWorkspace === "NETWORK" && (
          <div className="flex-1 flex flex-col gap-2 min-h-0 overflow-hidden">
            <div className="h-[42%] min-h-[190px]">
              <NetworkMap
                snapshot={snapshot}
                selectedTrain={selectedTrain}
                selectedSection={selectedSection}
                onSelectTrain={handleSelectTrain}
                onSelectSection={handleSelectSection}
              />
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">
              <MultiLineNetworkExplorer
                snapshot={snapshot}
                onSelectTrain={handleSelectTrain}
                onSelectSection={handleSelectSection}
              />
            </div>
          </div>
        )}

        {/* WORKSPACE 3: PREDICTION (Rolling Lookahead, Timeline Scrubber & Benchmarks) */}
        {activeWorkspace === "PREDICTION" && (
          <div className="flex-1 flex flex-col gap-2 min-h-0 overflow-hidden">
            <div className="h-[42%] min-h-[190px]">
              <NetworkMap
                snapshot={snapshot}
                selectedTrain={selectedTrain}
                selectedSection={selectedSection}
                onSelectTrain={handleSelectTrain}
                onSelectSection={handleSelectSection}
              />
            </div>
            <div className="flex-1 min-h-0 flex flex-col gap-2 overflow-hidden">
              <TimelineScrubber snapshot={snapshot} />
              <div className="flex-1 min-h-0 overflow-y-auto bg-slate-900 border border-slate-800 rounded-sm p-3">
                <BenchmarkPanel
                  benchmarkResult={snapshot.benchmarkComparison}
                  activeScenarioId={snapshot.activeScenarioId}
                  currentHorizonSeconds={snapshot.predictionHorizonSeconds}
                />
              </div>
            </div>
          </div>
        )}

        {/* WORKSPACE 4: FLEET (Comprehensive Fleet Kinematics & Train Table) */}
        {activeWorkspace === "FLEET" && (
          <div className="flex-1 flex flex-col gap-2 min-h-0 overflow-hidden">
            <div className="h-[38%] min-h-[180px]">
              <NetworkMap
                snapshot={snapshot}
                selectedTrain={selectedTrain}
                selectedSection={selectedSection}
                onSelectTrain={handleSelectTrain}
                onSelectSection={handleSelectSection}
              />
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">
              <TrainTable
                trains={snapshot.trains}
                selectedTrain={selectedTrain}
                conflicts={snapshot.conflicts}
                bottlenecks={snapshot.networkAssessment?.activeBottlenecks}
                onSelectTrain={handleSelectTrain}
              />
            </div>
          </div>
        )}

        {/* WORKSPACE 5: STRATEGIES (Phase 9 Coordinated Multi-Train Strategies) */}
        {activeWorkspace === "STRATEGIES" && (
          <div className="flex-1 flex flex-col gap-2 min-h-0 overflow-hidden">
            <div className="h-[35%] min-h-[160px]">
              <NetworkMap
                snapshot={snapshot}
                selectedTrain={selectedTrain}
                selectedSection={selectedSection}
                onSelectTrain={handleSelectTrain}
                onSelectSection={handleSelectSection}
              />
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto bg-slate-900 border border-slate-800 rounded-sm p-2">
              <StrategyOrchestrationPanel
                snapshot={snapshot}
                onSelectTrain={handleSelectTrainById}
                onOpenAuditDrawer={() => setActiveWorkspace("AUDIT")}
              />
            </div>
          </div>
        )}

        {/* WORKSPACE 6: RECOVERY (Phase 10 Incident Disruption & Staged Recovery Console) */}
        {activeWorkspace === "RECOVERY" && (
          <div className="flex-1 flex flex-col gap-2 min-h-0 overflow-hidden">
            <div className="h-[35%] min-h-[160px]">
              <NetworkMap
                snapshot={snapshot}
                selectedTrain={selectedTrain}
                selectedSection={selectedSection}
                onSelectTrain={handleSelectTrain}
                onSelectSection={handleSelectSection}
              />
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto bg-slate-900 border border-slate-800 rounded-sm p-2">
              <IncidentControlPanel
                snapshot={snapshot}
                onSelectTrain={handleSelectTrainById}
                onSelectSection={handleSelectSectionById}
              />
            </div>
          </div>
        )}

        {/* WORKSPACE 7: AUDIT (Closed-Loop Decision Audit & Operational Events Trace) */}
        {activeWorkspace === "AUDIT" && (
          <div className="flex-1 grid grid-cols-1 xl:grid-cols-12 gap-2 min-h-0 overflow-hidden">
            <div className="xl:col-span-6 h-full overflow-y-auto bg-slate-900 border border-slate-800 rounded-sm p-2">
              <DecisionAuditDrawer snapshot={snapshot} />
            </div>
            <div className="xl:col-span-6 h-full overflow-y-auto bg-slate-900 border border-slate-800 rounded-sm p-2">
              <EventLogPanel events={snapshot.events} />
            </div>
          </div>
        )}

        {/* WORKSPACE 8: ENGINEERING (Technical Diagnostics, Throughput & Section Block Telemetry) */}
        {activeWorkspace === "ENGINEERING" && (
          <div className="flex-1 grid grid-cols-1 xl:grid-cols-12 gap-2 min-h-0 overflow-hidden">
            <div className="xl:col-span-6 h-full flex flex-col gap-2 min-h-0 overflow-hidden">
              <div className="flex-1 min-h-0 overflow-y-auto bg-slate-900 border border-slate-800 rounded-sm p-2">
                <ThroughputPanel
                  metrics={snapshot.throughputMetrics}
                  sectionUtilizations={snapshot.telemetry.sectionUtilizations}
                />
              </div>
              <div className="h-[38%] min-h-[160px] overflow-y-auto bg-slate-900 border border-slate-800 rounded-sm p-2">
                <ScenarioControlPanel
                  activeScenarioId={snapshot.activeScenarioId}
                  availableScenarios={snapshot.availableScenarios}
                />
              </div>
            </div>

            <div className="xl:col-span-6 h-full overflow-y-auto bg-slate-900 border border-slate-800 rounded-sm p-2">
              <SectionStatusPanel
                sections={snapshot.sections}
                utilizations={snapshot.telemetry.sectionUtilizations}
                selectedSection={selectedSection}
                onSelectSection={handleSelectSection}
              />
            </div>
          </div>
        )}
      </main>

      {/* Minimal Unobtrusive Dashboard Footer Credit */}
      <footer className="h-5 px-3 bg-[#070a0e] border-t border-slate-800/60 flex items-center justify-between text-[10px] text-slate-500 font-mono select-none shrink-0">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/80 inline-block" />
          <span>RTPXO ENGINE ONLINE · REAL-TIME CTC DISPATCH</span>
        </div>
        <div>
          <span>RTPXO · Built by Team TVARIT · SIH 2026</span>
        </div>
      </footer>

      {/* SLIDE-OVER INSPECTOR: Train Telemetry & Manual Override */}
      {selectedTrain && (
        <TrainDetailDrawer
          train={selectedTrain}
          onClose={() => setSelectedTrainId(null)}
        />
      )}

      {/* MODAL: 7-Point AI Explainability & Trajectory Visualizer */}
      {inspectingRec && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-slate-950 border border-slate-700 rounded-lg shadow-2xl p-4">
            <SpeedTrajectoryVisualizer
              recommendation={inspectingRec}
              onClose={() => setInspectingRec(null)}
            />
          </div>
        </div>
      )}

      {/* MODAL: Operator Workflow Tour */}
      {showTourModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-slate-950 border border-slate-700 rounded-lg shadow-2xl p-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2 mb-3">
              <h3 className="font-mono text-sm font-bold text-sky-400">
                📖 RTPXO OPERATOR WORKFLOW TOUR
              </h3>
              <button
                type="button"
                onClick={() => setShowTourModal(false)}
                className="text-slate-400 hover:text-white px-2 py-1"
              >
                ✕ Close
              </button>
            </div>
            <OperatorWorkflowTour
              snapshot={snapshot}
              activeWorkspace={activeWorkspace}
              onSelectWorkspace={(ws) => {
                setActiveWorkspace(ws);
                setShowTourModal(false);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
