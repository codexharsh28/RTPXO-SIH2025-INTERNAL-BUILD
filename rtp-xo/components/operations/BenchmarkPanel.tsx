"use client";

import React, { useState } from "react";
import { BenchmarkComparisonResult, PredictionHorizonSeconds } from "@/types/optimization";
import { simulationEngine } from "@/engine/simulationEngine";

interface BenchmarkPanelProps {
  benchmarkResult?: BenchmarkComparisonResult;
  activeScenarioId: string;
  currentHorizonSeconds: number;
}

export const BenchmarkPanel: React.FC<BenchmarkPanelProps> = ({
  benchmarkResult,
  activeScenarioId,
  currentHorizonSeconds,
}) => {
  const [isRunning, setIsRunning] = useState(false);

  const handleRunBenchmark = () => {
    setIsRunning(true);
    setTimeout(() => {
      simulationEngine.runBenchmark(activeScenarioId);
      setIsRunning(false);
    }, 400);
  };

  const handleSetHorizon = (seconds: PredictionHorizonSeconds) => {
    simulationEngine.setPredictionHorizon(seconds);
  };

  return (
    <div className="rounded-lg border border-slate-300 bg-white p-4 shadow-xs font-mono">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-slate-200 pb-2.5 gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-slate-900" />
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
              PREDICTIVE BENCHMARK & MULTI-TRAIN OPTIMIZER
            </h3>
          </div>
          <p className="mt-0.5 text-[11px] text-slate-500">
            Deterministic Dual-Run Comparison: Conventional FCFS vs RTPXO Optimizer
          </p>
        </div>

        {/* Prediction Horizon Selector */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-[10px] text-slate-500 uppercase font-semibold">Horizon:</span>
          {([300, 600, 900] as const).map((h) => (
            <button
              key={h}
              type="button"
              onClick={() => handleSetHorizon(h)}
              className={`rounded-sm px-2 py-0.5 text-[10px] font-bold transition ${
                currentHorizonSeconds === h
                  ? "bg-slate-900 text-white font-bold"
                  : "bg-slate-100 text-slate-700 hover:text-slate-900 border border-slate-300"
              }`}
            >
              {h / 60}m
            </button>
          ))}

          <button
            type="button"
            onClick={handleRunBenchmark}
            disabled={isRunning}
            className="ml-2 rounded-sm bg-slate-900 hover:bg-slate-800 px-3.5 py-1 text-xs font-bold text-white transition disabled:opacity-50"
          >
            {isRunning ? "RUNNING..." : "RUN BENCHMARK"}
          </button>
        </div>
      </div>

      {/* Benchmark Results */}
      {benchmarkResult ? (
        <div className="mt-3 space-y-3">
          {/* Summary Hero Ribbon */}
          <div className="rounded-sm border border-slate-300 bg-slate-50 p-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-600">
                  Benchmark Scenario: {benchmarkResult.scenarioId}
                </span>
                <p className="text-xs text-slate-900 font-semibold mt-0.5">
                  {benchmarkResult.efficiencyGainSummary}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right">
                  <span className="text-[9px] uppercase text-slate-500 font-semibold block">Throughput Gain</span>
                  <span className="text-lg font-black text-emerald-700">
                    +{benchmarkResult.throughputImprovementPercent}%
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[9px] uppercase text-slate-500 font-semibold block">Delay Saved</span>
                  <span className="text-lg font-black text-slate-900">
                    -{benchmarkResult.delayReductionMinutes}m
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Comparative Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-[10px] text-slate-500 uppercase bg-slate-50">
                  <th className="py-2 px-3 font-semibold">Performance Metric</th>
                  <th className="py-2 px-3 font-semibold text-slate-600">Baseline Dispatcher</th>
                  <th className="py-2 px-3 font-semibold text-slate-900">RTPXO Optimizer</th>
                  <th className="py-2 px-3 font-semibold text-emerald-700">Improvement Delta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-[11px]">
                <tr className="hover:bg-slate-50">
                  <td className="py-2 px-3 font-semibold text-slate-900">Corridor Section Throughput</td>
                  <td className="py-2 px-3 text-slate-600">{benchmarkResult.baseline.corridorThroughput} T/h</td>
                  <td className="py-2 px-3 text-slate-900 font-bold">{benchmarkResult.optimized.corridorThroughput} T/h</td>
                  <td className="py-2 px-3 text-emerald-700 font-bold">+{benchmarkResult.throughputImprovementPercent}%</td>
                </tr>

                <tr className="hover:bg-slate-50">
                  <td className="py-2 px-3 font-semibold text-slate-900">Average Train Delay</td>
                  <td className="py-2 px-3 text-amber-700">{benchmarkResult.baseline.averageDelayMinutes} min</td>
                  <td className="py-2 px-3 text-emerald-800 font-medium">{benchmarkResult.optimized.averageDelayMinutes} min</td>
                  <td className="py-2 px-3 text-slate-900 font-bold">-{benchmarkResult.delayReductionMinutes} min</td>
                </tr>

                <tr className="hover:bg-slate-50">
                  <td className="py-2 px-3 font-semibold text-slate-900">Maximum Single Train Delay</td>
                  <td className="py-2 px-3 text-slate-600">{benchmarkResult.baseline.maximumDelayMinutes} min</td>
                  <td className="py-2 px-3 text-slate-900">{benchmarkResult.optimized.maximumDelayMinutes} min</td>
                  <td className="py-2 px-3 text-emerald-700 font-bold">Optimized</td>
                </tr>

                <tr className="hover:bg-slate-50">
                  <td className="py-2 px-3 font-semibold text-slate-900">Unnecessary Stops / Braking</td>
                  <td className="py-2 px-3 text-red-700">{benchmarkResult.baseline.unnecessaryStopsCount} stops</td>
                  <td className="py-2 px-3 text-emerald-800">{benchmarkResult.optimized.unnecessaryStopsCount} stops</td>
                  <td className="py-2 px-3 text-emerald-700 font-bold">-{benchmarkResult.stopsReducedCount} stops</td>
                </tr>

                <tr className="hover:bg-slate-50">
                  <td className="py-2 px-3 font-semibold text-slate-900">Average Corridor Speed</td>
                  <td className="py-2 px-3 text-slate-600">{benchmarkResult.baseline.averageSpeedKmH} km/h</td>
                  <td className="py-2 px-3 text-slate-900">{benchmarkResult.optimized.averageSpeedKmH} km/h</td>
                  <td className="py-2 px-3 text-slate-800 font-bold">Synchronized Flow</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex flex-col sm:flex-row items-center justify-between rounded-sm border border-dashed border-slate-300 p-3.5 text-xs text-slate-500 gap-3">
          <span>Click &quot;RUN BENCHMARK&quot; to execute deterministic dual-run simulation against Baseline Dispatcher.</span>
          <button
            type="button"
            onClick={handleRunBenchmark}
            className="rounded-sm bg-slate-900 hover:bg-slate-800 px-3 py-1 text-white font-bold"
          >
            RUN NOW
          </button>
        </div>
      )}
    </div>
  );
};
