"use client";

import React, { useState } from "react";
import { SimulationSnapshot } from "@/types/simulation";
import { simulationEngine } from "@/engine/simulationEngine";
import { CommandWorkspace } from "./LiveHeader";

interface OperatorWorkflowTourProps {
  snapshot: SimulationSnapshot;
  activeWorkspace: CommandWorkspace;
  onSelectWorkspace: (workspace: CommandWorkspace) => void;
}

export type WorkflowStepId =
  | "SCENARIO"
  | "OBSERVE"
  | "PREDICT"
  | "EXPLAIN"
  | "RECOMMEND"
  | "APPLY"
  | "MEASURE"
  | "RECOVER";

interface WorkflowStep {
  id: WorkflowStepId;
  stepNumber: number;
  label: string;
  icon: string;
  targetWorkspace: CommandWorkspace;
  title: string;
  description: string;
  suggestedActionLabel?: string;
  actionHandler?: (snapshot: SimulationSnapshot) => void;
}

export const OperatorWorkflowTour: React.FC<OperatorWorkflowTourProps> = ({
  snapshot,
  activeWorkspace,
  onSelectWorkspace,
}) => {
  const [activeStep, setActiveStep] = useState<WorkflowStepId>("SCENARIO");
  const [isOpen, setIsOpen] = useState(true);

  const steps: WorkflowStep[] = [
    {
      id: "SCENARIO",
      stepNumber: 1,
      label: "Scenario",
      icon: "📋",
      targetWorkspace: "OPERATIONS",
      title: "1. Select Operational Scenario",
      description:
        "Load a deterministic railway traffic situation (Normal Operation, Delayed Train, Section Congestion, or Junction Conflict).",
      suggestedActionLabel: "Load Junction Conflict Scenario",
      actionHandler: () => {
        simulationEngine.loadScenario("JUNCTION_CONFLICT");
      },
    },
    {
      id: "OBSERVE",
      stepNumber: 2,
      label: "Observe",
      icon: "👀",
      targetWorkspace: "OPERATIONS",
      title: "2. Observe Live Schematic Corridor",
      description:
        "Monitor real-time train positions, track block occupancies, and signal aspects across the 186 km corridor on the Network Map.",
    },
    {
      id: "PREDICT",
      stepNumber: 3,
      label: "Predict",
      icon: "🔮",
      targetWorkspace: "PREDICTION",
      title: "3. Predict Rolling Lookahead (300s/600s/900s)",
      description:
        "PredictionEngine simulates non-mutating forward kinematics to project future train positions, ghost vectors, and upcoming conflicts.",
      suggestedActionLabel: "Set 600s Prediction Horizon",
      actionHandler: () => {
        simulationEngine.setPredictionHorizon(600);
      },
    },
    {
      id: "EXPLAIN",
      stepNumber: 4,
      label: "Explain",
      icon: "🔍",
      targetWorkspace: "OPERATIONS",
      title: "4. Inspect 7-Point AI Explainability",
      description:
        "Inspect transparent root-cause reasons, target speeds, objective score breakdowns, and rejected counterfactual alternatives.",
    },
    {
      id: "RECOMMEND",
      stepNumber: 5,
      label: "Recommend",
      icon: "💡",
      targetWorkspace: "OPERATIONS",
      title: "5. Review Proactive Recommendations",
      description:
        "Evaluate AI proactive dispatch advisories (HOLD, GLIDE, REDUCE, or SPEED) against absolute block safety constraints.",
    },
    {
      id: "APPLY",
      stepNumber: 6,
      label: "Apply",
      icon: "⚡",
      targetWorkspace: "OPERATIONS",
      title: "6. Dispatch Operator Action",
      description:
        "Human dispatcher authorizes safe advisory action to command train speed or hold, preventing downstream saturation.",
      suggestedActionLabel: "Apply Top Pending Recommendation",
      actionHandler: (snap) => {
        const topPending = snap.recommendations.find((r) => r.status === "PENDING");
        if (topPending) {
          simulationEngine.applyRecommendation(topPending.id);
        }
      },
    },
    {
      id: "MEASURE",
      stepNumber: 7,
      label: "Measure",
      icon: "📊",
      targetWorkspace: "PREDICTION",
      title: "7. Measure KPI Gain & Benchmark",
      description:
        "Compare optimized corridor throughput and delay reduction against the conventional Baseline Dispatcher.",
      suggestedActionLabel: "Run Dual-Run Benchmark",
      actionHandler: (snap) => {
        simulationEngine.runBenchmark(snap.activeScenarioId);
      },
    },
    {
      id: "RECOVER",
      stepNumber: 8,
      label: "Recover",
      icon: "🛡️",
      targetWorkspace: "AUDIT",
      title: "8. Verify Recovery & Audit Trail",
      description:
        "Verify conflict clearance, continuous conflict-free time, and audit all timestamped events in the immutable Event Log.",
    },
  ];

  const currentStepObj = steps.find((s) => s.id === activeStep) || steps[0];

  const handleStepClick = (step: WorkflowStep) => {
    setActiveStep(step.id);
    if (activeWorkspace !== step.targetWorkspace) {
      onSelectWorkspace(step.targetWorkspace);
    }
  };

  const handleExecuteAction = () => {
    if (currentStepObj.actionHandler) {
      currentStepObj.actionHandler(snapshot);
    }
  };

  if (!isOpen) {
    return (
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="rounded-sm border border-slate-300 bg-white px-3 py-1 font-mono text-xs text-slate-700 hover:bg-slate-50 transition shadow-xs"
        >
          🧭 Open Operator Workflow Tour (8 Stages)
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-300 bg-white p-3.5 shadow-xs font-mono text-xs">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="flex h-5 w-5 items-center justify-center rounded-sm bg-slate-900 text-white font-black text-xs">
            🧭
          </div>
          <div>
            <h4 className="font-bold tracking-wide text-slate-900 uppercase text-xs">
              RTPXO OPERATIONAL WORKFLOW TOUR
            </h4>
            <p className="text-[10px] text-slate-500 font-normal">
              Deterministic 8-Stage Traffic Optimization & Decision-Support Flow · Built by Team TVARIT (SIH 2026)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="rounded-sm bg-slate-100 border border-slate-300 px-2 py-0.5 text-[9px] text-slate-600 font-semibold">
            Stage {currentStepObj.stepNumber} of 8: {currentStepObj.id}
          </span>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="rounded-sm border border-slate-200 bg-slate-50 px-2 py-0.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            ✕ Dismiss
          </button>
        </div>
      </div>

      {/* 8-Stage Progression Stepper */}
      <div className="mt-2.5 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-1">
        {steps.map((step) => {
          const isActive = activeStep === step.id;
          return (
            <button
              key={step.id}
              type="button"
              onClick={() => handleStepClick(step)}
              className={`flex flex-col items-center justify-center rounded-sm p-1.5 text-center transition-all ${
                isActive
                  ? "border-2 border-slate-900 bg-slate-900 text-white shadow-xs"
                  : "border border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-400 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <span className="text-xs mb-0.5">{step.icon}</span>
              <span className="text-[9px] font-bold uppercase tracking-tight">
                {step.stepNumber}. {step.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Active Stage Description & Direct Action Card */}
      <div className="mt-2.5 rounded-sm border border-slate-200 bg-slate-50 p-2.5 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div>
          <span className="font-bold text-slate-900 text-xs block">
            {currentStepObj.title}
          </span>
          <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed font-normal">
            {currentStepObj.description}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {currentStepObj.suggestedActionLabel && (
            <button
              type="button"
              onClick={handleExecuteAction}
              className="rounded-sm bg-slate-900 hover:bg-slate-800 text-white px-3 py-1 font-bold text-[11px] transition shadow-xs"
            >
              ⚡ {currentStepObj.suggestedActionLabel}
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              const nextIndex = (currentStepObj.stepNumber % 8);
              handleStepClick(steps[nextIndex]);
            }}
            className="rounded-sm border border-slate-300 bg-white hover:bg-slate-100 text-slate-800 px-2.5 py-1 font-bold text-[11px] transition"
          >
            Next Stage →
          </button>
        </div>
      </div>
    </div>
  );
};
