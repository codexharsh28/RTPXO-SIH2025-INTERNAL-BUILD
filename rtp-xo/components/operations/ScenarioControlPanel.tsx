"use client";

import React from "react";
import { ScenarioDefinition } from "@/types/scenarios";
import { simulationEngine } from "@/engine/simulationEngine";

interface ScenarioControlPanelProps {
  activeScenarioId: string;
  availableScenarios: ScenarioDefinition[];
}

export const ScenarioControlPanel: React.FC<ScenarioControlPanelProps> = ({
  activeScenarioId,
  availableScenarios,
}) => {
  const currentScenario =
    availableScenarios.find((s) => s.id === activeScenarioId) ||
    availableScenarios[0];

  const handleSelectScenario = (e: React.ChangeEvent<HTMLSelectElement>) => {
    simulationEngine.loadScenario(e.target.value);
  };

  const handleResetScenario = () => {
    simulationEngine.resetScenario();
  };

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case "NOMINAL":
        return "bg-emerald-100 text-emerald-800 border-emerald-300";
      case "DISRUPTION":
        return "bg-amber-100 text-amber-800 border-amber-300";
      case "CONVERGENCE":
        return "bg-slate-200 text-slate-800 border-slate-400";
      case "SATURATION":
        return "bg-red-100 text-red-800 border-red-300";
      case "RESTRICTION":
        return "bg-amber-100 text-amber-800 border-amber-300";
      case "RECOVERY":
        return "bg-sky-100 text-sky-800 border-sky-300";
      default:
        return "bg-slate-100 text-slate-700 border-slate-300";
    }
  };

  return (
    <div className="rounded-lg border border-slate-300 bg-white p-4 shadow-xs">
      <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
        <div>
          <h3 className="font-mono text-xs font-black uppercase tracking-wider text-slate-900">
            OPERATIONAL SCENARIO BENCHMARK
          </h3>
          <p className="text-[11px] text-slate-500">
            Deterministic Traffic Situation Benchmark Testing
          </p>
        </div>

        {currentScenario && (
          <span
            className={`rounded-sm border px-2 py-0.5 font-mono text-[10px] font-bold uppercase ${getCategoryBadge(
              currentScenario.category
            )}`}
          >
            {currentScenario.category}
          </span>
        )}
      </div>

      <div className="mt-3 flex flex-col md:flex-row items-stretch md:items-center gap-2.5">
        {/* Scenario Select Dropdown */}
        <div className="flex-1">
          <label className="block font-mono text-[10px] uppercase font-semibold text-slate-600 mb-1">
            Select Operational Situation:
          </label>
          <select
            value={activeScenarioId}
            onChange={handleSelectScenario}
            className="w-full rounded-sm border border-slate-300 bg-slate-50 px-3 py-1.5 font-mono text-xs font-medium text-slate-900 transition focus:border-slate-800 focus:bg-white focus:outline-none"
          >
            {availableScenarios.map((scenario) => (
              <option key={scenario.id} value={scenario.id}>
                {scenario.name} ({scenario.category})
              </option>
            ))}
          </select>
        </div>

        {/* Reset Scenario Button */}
        <div className="flex items-end">
          <button
            type="button"
            onClick={handleResetScenario}
            className="rounded-sm border border-slate-300 bg-slate-100 hover:bg-slate-200 px-3.5 py-1.5 font-mono text-xs font-bold text-slate-800 transition"
          >
            RESET SCENARIO
          </button>
        </div>
      </div>

      {/* Active Scenario Details Card */}
      {currentScenario && (
        <div className="mt-3 rounded-sm border border-slate-200 bg-slate-50 p-3 font-mono text-xs">
          <div className="flex items-center justify-between text-slate-900">
            <span className="font-bold">{currentScenario.name}</span>
            <span className="text-[10px] text-slate-500 font-medium">
              Fleet: {currentScenario.trains.length} Train(s)
            </span>
          </div>

          <p className="mt-1 text-slate-600 text-[11px] leading-relaxed">
            {currentScenario.description}
          </p>

          <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 border-t border-slate-200 pt-2 text-[10px]">
            <div>
              <span className="text-slate-500 font-medium">Target Objective: </span>
              <span className="text-slate-800 font-semibold">
                {currentScenario.targetObjective}
              </span>
            </div>
            <div>
              <span className="text-slate-500 font-medium">Expected Outcome: </span>
              <span className="text-emerald-700 font-semibold">
                {currentScenario.expectedBehavior}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
