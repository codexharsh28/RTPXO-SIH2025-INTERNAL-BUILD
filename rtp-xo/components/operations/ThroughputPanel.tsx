"use client";

import React from "react";
import { ThroughputMetrics, SectionUtilization } from "@/types/metrics";
import { corridorTopology } from "@/data/topology";

interface ThroughputPanelProps {
  metrics: ThroughputMetrics;
  sectionUtilizations: SectionUtilization[];
}

export const ThroughputPanel: React.FC<ThroughputPanelProps> = ({
  metrics,
  sectionUtilizations,
}) => {
  const terminusStation = corridorTopology.stations[corridorTopology.stations.length - 1];

  const getCongestionBadge = (state: string) => {
    switch (state) {
      case "FREE_FLOW":
        return "bg-emerald-100 text-emerald-800 border-emerald-300";
      case "MODERATE":
        return "bg-slate-100 text-slate-800 border-slate-300";
      case "CONGESTED":
        return "bg-amber-100 text-amber-800 border-amber-300";
      case "SATURATED":
        return "bg-red-100 text-red-800 border-red-300";
      default:
        return "bg-slate-100 text-slate-700 border-slate-300";
    }
  };

  return (
    <div className="flex flex-col h-full rounded-lg border border-slate-300 bg-white p-4 shadow-xs">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
        <div>
          <h3 className="font-mono text-xs font-black uppercase tracking-wider text-slate-900">
            CORRIDOR THROUGHPUT & UTILIZATION
          </h3>
          <p className="text-[11px] text-slate-500">
            Section Throughput Flow Telemetry
          </p>
        </div>
        <span className="rounded-sm bg-slate-100 border border-slate-300 px-2 py-0.5 font-mono text-[10px] font-bold text-slate-700">
          KPI TELEMETRY
        </span>
      </div>

      {/* Hero Throughput KPI Card */}
      <div className="mt-3 rounded-sm border border-slate-300 bg-slate-50 p-3.5">
        <div className="flex items-center justify-between">
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-slate-600">
            Section Throughput
          </span>
          <span className="rounded-sm bg-emerald-100 border border-emerald-300 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-800">
            +{metrics.throughputImprovement}% GAIN
          </span>
        </div>

        <div className="mt-1.5 flex items-baseline justify-between">
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-3xl font-black tracking-tight text-slate-900">
              {metrics.corridorThroughput}
            </span>
            <span className="font-mono text-xs text-slate-500 font-semibold">
              TRAINS / HOUR
            </span>
          </div>

          <div className="text-right font-mono text-[10px] text-slate-500">
            <span>Baseline: </span>
            <strong className="text-slate-800">{metrics.baselineThroughput} T/h</strong>
          </div>
        </div>

        <p className="mt-1 text-[11px] text-slate-500 font-mono">
          Gain: <strong className="text-emerald-700">((Current - Baseline) / Baseline) × 100%</strong>
        </p>
      </div>

      {/* Core Operational Metrics Grid */}
      <div className="mt-3 grid grid-cols-2 gap-2.5">
        {/* Corridor Utilization */}
        <div className="rounded-sm border border-slate-200 bg-slate-50 p-2.5">
          <span className="block font-mono text-[9px] uppercase font-semibold text-slate-500">
            Corridor Capacity
          </span>
          <div className="mt-0.5 flex items-baseline justify-between">
            <span className="font-mono text-lg font-bold text-slate-900">
              {metrics.corridorUtilization}%
            </span>
            <span className="font-mono text-[9px] text-slate-600 font-medium">
              {metrics.corridorUtilization > 75 ? "High Density" : "Nominal"}
            </span>
          </div>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className={`h-full transition-all duration-500 ${
                metrics.corridorUtilization > 85
                  ? "bg-red-600"
                  : metrics.corridorUtilization > 60
                  ? "bg-amber-500"
                  : "bg-slate-700"
              }`}
              style={{ width: `${metrics.corridorUtilization}%` }}
            />
          </div>
        </div>

        {/* Completed Trains */}
        <div className="rounded-sm border border-slate-200 bg-slate-50 p-2.5">
          <span className="block font-mono text-[9px] uppercase font-semibold text-slate-500">
            Completed Trips
          </span>
          <div className="mt-0.5 flex items-baseline justify-between">
            <span className="font-mono text-lg font-bold text-emerald-700">
              {metrics.trainsCompleted}
            </span>
            <span className="font-mono text-[9px] text-slate-500">
              {metrics.totalDistanceTraveledKm} km total
            </span>
          </div>
          <span className="mt-1 block font-mono text-[8px] text-slate-500">
            Terminus: {terminusStation?.name || "Saharanpur"}
          </span>
        </div>

        {/* Average Delay */}
        <div className="rounded-sm border border-slate-200 bg-slate-50 p-2.5">
          <span className="block font-mono text-[9px] uppercase font-semibold text-slate-500">
            Average Train Delay
          </span>
          <div className="mt-0.5 flex items-baseline justify-between">
            <span
              className={`font-mono text-lg font-bold ${
                metrics.averageDelay > 0 ? "text-amber-700" : "text-emerald-700"
              }`}
            >
              {metrics.averageDelay} min
            </span>
            <span className="font-mono text-[9px] text-slate-500">
              Corridor Avg
            </span>
          </div>
        </div>

        {/* Average Travel Time */}
        <div className="rounded-sm border border-slate-200 bg-slate-50 p-2.5">
          <span className="block font-mono text-[9px] uppercase font-semibold text-slate-500">
            Avg Travel Time
          </span>
          <div className="mt-0.5 flex items-baseline justify-between">
            <span className="font-mono text-lg font-bold text-slate-900">
              {metrics.averageTravelTime} min
            </span>
            <span className="font-mono text-[9px] text-slate-500">
              {corridorTopology.totalLengthKm} km Line
            </span>
          </div>
        </div>
      </div>

      {/* Section Utilization Density Breakdown */}
      <div className="mt-3 flex-1 overflow-y-auto space-y-1.5 pr-1">
        <span className="block font-mono text-[10px] font-bold uppercase text-slate-700">
          SECTION DENSITY & THROUGHPUT
        </span>
        {sectionUtilizations.map((sec) => (
          <div
            key={sec.sectionId}
            className="rounded-sm border border-slate-200 bg-slate-50 p-2 font-mono text-xs"
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-900">{sec.sectionName}</span>
              <span
                className={`rounded-sm border px-1.5 py-0.2 text-[8px] font-bold uppercase ${getCongestionBadge(
                  sec.congestionState
                )}`}
              >
                {sec.congestionState.replace("_", " ")}
              </span>
            </div>

            <div className="mt-1 flex items-center justify-between text-[9px] text-slate-600">
              <span>Throughput: <strong className="text-slate-900">{sec.sectionThroughput} T/h</strong></span>
              <span>Avg Speed: <strong className="text-slate-900">{sec.averageSpeedKmH} km/h</strong></span>
              <span>Density: <strong className={sec.occupancyRate >= 100 ? "text-red-700" : "text-slate-700"}>{sec.occupancyRate}%</strong></span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
