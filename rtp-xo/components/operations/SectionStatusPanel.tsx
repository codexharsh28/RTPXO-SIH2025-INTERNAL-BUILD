"use client";

import React from "react";
import { RailwaySection } from "@/types/railway";
import { SectionUtilization } from "@/types/metrics";

interface SectionStatusPanelProps {
  sections: RailwaySection[];
  utilizations: SectionUtilization[];
  selectedSection: RailwaySection | null;
  onSelectSection: (section: RailwaySection) => void;
}

export const SectionStatusPanel: React.FC<SectionStatusPanelProps> = ({
  sections,
  utilizations,
  selectedSection,
  onSelectSection,
}) => {
  const getCongestionStyle = (state?: string) => {
    switch (state) {
      case "SATURATED":
        return "bg-red-100 text-red-800 border-red-300";
      case "CONGESTED":
        return "bg-amber-100 text-amber-800 border-amber-300";
      case "MODERATE":
        return "bg-slate-100 text-slate-800 border-slate-300";
      case "FREE_FLOW":
      default:
        return "bg-emerald-100 text-emerald-800 border-emerald-300";
    }
  };

  return (
    <div className="rounded-lg border border-slate-300 bg-white p-4 shadow-xs">
      <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
        <div>
          <h3 className="font-mono text-xs font-black uppercase tracking-wider text-slate-900">
            SECTION OCCUPANCY & TRACK BLOCKS
          </h3>
          <p className="text-[11px] text-slate-500">
            Absolute Block Section Signaling Status & Throughput Flow
          </p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2.5">
        {sections.map((section) => {
          const util = utilizations.find((u) => u.sectionId === section.id);
          const isSelected = selectedSection?.id === section.id;
          const isOccupied = section.status === "OCCUPIED" || (section.occupiedTrains && section.occupiedTrains.length > 0);
          const occupyingTrains = section.occupiedTrains || (section.occupiedBy ? [section.occupiedBy] : []);

          return (
            <div
              key={section.id}
              onClick={() => onSelectSection(section)}
              className={`cursor-pointer rounded-sm border p-3 transition-all duration-150 ${
                isSelected
                  ? "border-slate-900 bg-slate-100 shadow-xs"
                  : isOccupied
                  ? "border-amber-300 bg-amber-50/60 hover:border-amber-400"
                  : "border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-slate-900">
                  {section.id}
                </span>
                <span
                  className={`rounded-sm border px-1.5 py-0.2 font-mono text-[9px] font-bold uppercase ${getCongestionStyle(
                    util?.congestionState
                  )}`}
                >
                  {util ? util.congestionState.replace("_", " ") : section.status}
                </span>
              </div>

              <p className="mt-1 text-xs font-semibold text-slate-800">
                {section.name}
              </p>

              <div className="mt-2.5 flex items-center justify-between font-mono text-[10px] text-slate-500 border-t border-slate-200 pt-1.5">
                <span>Length: {section.lengthKm} km</span>
                <span>Max: {section.maximumSpeed} km/h</span>
              </div>

              {util && (
                <div className="mt-1 flex items-center justify-between font-mono text-[10px] text-slate-700">
                  <span>Throughput: <strong className="text-slate-900">{util.sectionThroughput} T/h</strong></span>
                  <span>Avg Speed: <strong className="text-slate-900">{util.averageSpeedKmH} km/h</strong></span>
                </div>
              )}

              <div className="mt-1.5 flex items-center justify-between font-mono text-[10px]">
                <span className="text-slate-500">Occupancy:</span>
                <span className={occupyingTrains.length > 0 ? "font-bold text-amber-800" : "text-emerald-700 font-semibold"}>
                  {occupyingTrains.length > 0 ? occupyingTrains.join(", ") : "Clear"}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
