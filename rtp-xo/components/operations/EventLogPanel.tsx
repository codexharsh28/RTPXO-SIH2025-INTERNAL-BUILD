"use client";

import React, { useState } from "react";
import { OperationalEvent, EventSeverity } from "@/types/events";

interface EventLogPanelProps {
  events: OperationalEvent[];
}

export const EventLogPanel: React.FC<EventLogPanelProps> = ({ events }) => {
  const [filter, setFilter] = useState<"ALL" | "ALERTS" | "ACTIONS">("ALL");

  const filteredEvents = events.filter((evt) => {
    if (filter === "ALERTS") {
      return evt.severity === "WARNING" || evt.severity === "CRITICAL";
    }
    if (filter === "ACTIONS") {
      return (
        evt.type === "RECOMMENDATION_APPLIED" ||
        evt.type === "RECOMMENDATION_CREATED" ||
        evt.type === "TRAIN_COMPLETED"
      );
    }
    return true;
  });

  const getSeverityBadge = (severity: EventSeverity) => {
    switch (severity) {
      case "CRITICAL":
        return "text-red-800 bg-red-100 border-red-300 font-bold";
      case "WARNING":
        return "text-amber-800 bg-amber-100 border-amber-300 font-semibold";
      case "SUCCESS":
        return "text-emerald-800 bg-emerald-100 border-emerald-300 font-semibold";
      case "INFO":
      default:
        return "text-slate-800 bg-slate-100 border-slate-300 font-medium";
    }
  };

  const getSeverityDot = (severity: EventSeverity) => {
    switch (severity) {
      case "CRITICAL":
        return "bg-red-600";
      case "WARNING":
        return "bg-amber-500";
      case "SUCCESS":
        return "bg-emerald-600";
      case "INFO":
      default:
        return "bg-slate-500";
    }
  };

  return (
    <div className="flex flex-col h-full rounded-lg border border-slate-300 bg-white p-4 shadow-xs">
      {/* Header & Filter Controls */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-emerald-600" />
            <h3 className="font-mono text-xs font-black uppercase tracking-wider text-slate-900">
              OPERATIONAL EVENT LOG
            </h3>
          </div>
          <p className="text-[11px] text-slate-500 font-mono">
            Authoritative Corridor Activity Stream
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1 font-mono text-[10px]">
          {(["ALL", "ALERTS", "ACTIONS"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-sm px-2 py-1 font-bold transition ${
                filter === f
                  ? "bg-slate-900 text-white font-bold"
                  : "bg-slate-100 text-slate-600 hover:text-slate-900"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Events Stream */}
      <div className="mt-3 flex-1 overflow-y-auto space-y-1.5 pr-1">
        {filteredEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-sm border border-dashed border-slate-300 py-8 text-center text-slate-500 font-mono text-xs">
            <span>No events recorded for selected filter.</span>
          </div>
        ) : (
          filteredEvents.map((evt) => (
            <div
              key={evt.id}
              className="flex items-start gap-2.5 rounded-sm border border-slate-200 bg-slate-50 p-2 font-mono text-xs transition hover:bg-slate-100"
            >
              {/* Severity dot & Timestamp */}
              <div className="flex flex-col items-center gap-1 pt-0.5">
                <span className={`h-2 w-2 rounded-full ${getSeverityDot(evt.severity)}`} />
                <span className="text-[9px] text-slate-500 font-mono whitespace-nowrap">
                  {evt.formattedTime}
                </span>
              </div>

              {/* Event Body */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-900 text-[11px] font-medium leading-tight">
                    {evt.message}
                  </span>
                  <span
                    className={`rounded-sm border px-1.5 py-0.2 text-[8px] font-bold uppercase whitespace-nowrap ${getSeverityBadge(
                      evt.severity
                    )}`}
                  >
                    {evt.type.replace(/_/g, " ")}
                  </span>
                </div>

                {evt.entityId && (
                  <div className="mt-0.5 flex items-center gap-2 text-[9px] text-slate-500">
                    <span>Entity: <strong className="text-slate-700">{evt.entityId}</strong></span>
                    {evt.entityType && (
                      <span className="rounded-sm bg-slate-200 px-1 text-slate-700 font-medium">
                        {evt.entityType}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
