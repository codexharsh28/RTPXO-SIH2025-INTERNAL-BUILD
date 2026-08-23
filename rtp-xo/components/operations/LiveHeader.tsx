"use client";

import React from "react";
import { SimulationSnapshot } from "@/types/simulation";
import { simulationEngine } from "@/engine/simulationEngine";

import { useNetworkState } from "@/hooks/useNetworkState";

export type CommandWorkspace =
  | "OPERATIONS"
  | "NETWORK"
  | "PREDICTION"
  | "FLEET"
  | "STRATEGIES"
  | "RECOVERY"
  | "AUDIT"
  | "ENGINEERING";

interface LiveHeaderProps {
  snapshot?: SimulationSnapshot;
  activeWorkspace?: CommandWorkspace;
  onSelectWorkspace?: (workspace: CommandWorkspace) => void;
  onOpenTour?: () => void;
}

function formatSimulationClock(seconds: number): string {
  const totalSecs = Math.floor(seconds);
  const hours = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;

  return [
    String(hours).padStart(2, "0"),
    String(mins).padStart(2, "0"),
    String(secs).padStart(2, "0"),
  ].join(":");
}

const SPEED_MULTIPLIERS = [1, 2, 4, 8, 10];

export const LiveHeader: React.FC<LiveHeaderProps> = ({
  snapshot: propSnapshot,
  activeWorkspace = "OPERATIONS",
  onSelectWorkspace,
  onOpenTour,
}) => {
  const net = useNetworkState();
  const snapshot = propSnapshot || net.rawSnapshot;
  const {
    running,
    simulationTimeSeconds: simulationTime,
    speedMultiplier,
    activeScenarioId,
    activeIncidents,
    availableStrategies,
    conflicts,
    healthStatus,
    aiScore,
    throughput,
  } = net;

  const telemetry = snapshot.telemetry;
  const availableScenarios = snapshot.availableScenarios || [];
  const recommendations = snapshot.recommendations || [];
  const events = snapshot.events || [];

  const pendingRecs = recommendations.filter((r) => r.status === "PENDING").length;
  const criticalConflicts = conflicts.filter((c) => c.severity === "CRITICAL" || c.severity === "HIGH").length;

  const getAssessmentBadgeStyle = (status: string) => {
    switch (status) {
      case "NORMAL":
      case "OPTIMAL":
        return "border-emerald-500/40 bg-emerald-950/60 text-emerald-300";
      case "WARNING":
      case "OPTIMIZING":
        return "border-amber-500/40 bg-amber-950/60 text-amber-300";
      case "CONGESTED":
        return "border-amber-500/60 bg-amber-950/80 text-amber-200 font-bold";
      case "CRITICAL":
        return "border-red-500/50 bg-red-950/70 text-red-300 animate-pulse font-black";
      default:
        return "border-slate-700 bg-slate-800 text-slate-300";
    }
  };

  const workspaces: {
    id: CommandWorkspace;
    label: string;
    icon: string;
    badge?: string | number;
    badgeColor?: string;
  }[] = [
    {
      id: "OPERATIONS",
      label: "LIVE OPERATIONS",
      icon: "⚡",
      badge: pendingRecs > 0 ? `${pendingRecs} REC` : undefined,
      badgeColor: "bg-sky-600 text-white font-bold animate-pulse",
    },
    {
      id: "NETWORK",
      label: "NETWORK",
      icon: "🛤️",
      badge: `${telemetry.activeTrains} TRAINS`,
      badgeColor: "bg-slate-800 text-slate-300 border border-slate-700",
    },
    {
      id: "PREDICTION",
      label: "PREDICTION",
      icon: "🔮",
      badge: `${snapshot.predictionHorizonSeconds || 300}s`,
      badgeColor: "bg-slate-800 text-slate-300 border border-slate-700",
    },
    {
      id: "FLEET",
      label: "FLEET",
      icon: "🚆",
      badge: `${snapshot.trains.length} ROSTER`,
      badgeColor: "bg-slate-800 text-slate-300 border border-slate-700",
    },
    {
      id: "STRATEGIES",
      label: "STRATEGIES",
      icon: "🎯",
      badge: availableStrategies.length > 0 ? `${availableStrategies.length} STRAT` : undefined,
      badgeColor: "bg-purple-950 text-purple-200 border border-purple-500 font-bold",
    },
    {
      id: "RECOVERY",
      label: "RECOVERY",
      icon: "🚨",
      badge:
        activeIncidents.length > 0
          ? `${activeIncidents.length} ACTIVE • ${activeIncidents[0].severity}`
          : "0 ACTIVE",
      badgeColor:
        activeIncidents.length > 0
          ? "bg-red-950 text-red-200 border border-red-500 font-black animate-pulse"
          : "bg-slate-900 text-emerald-400 border border-slate-700 font-bold",
    },
    {
      id: "AUDIT",
      label: "AUDIT",
      icon: "🛡️",
      badge: `${events.length} EVT`,
      badgeColor: "bg-slate-800 text-slate-400 border border-slate-700",
    },
    {
      id: "ENGINEERING",
      label: "ENGINEERING",
      icon: "⚙️",
      badge: "SYSTEM",
      badgeColor: "bg-slate-800 text-slate-400 border border-slate-700",
    },
  ];

  return (
    <header className="border-b border-slate-800/80 bg-slate-950 text-white select-none flex-shrink-0 z-30 shadow-md">
      {/* 1. TOP COMMAND BAR */}
      <div className="px-3 py-1.5 flex items-center justify-between gap-2 border-b border-slate-900 overflow-x-auto">
        {/* Brand & Project Identity */}
        <div className="flex items-center gap-2.5 flex-shrink-0">
          <div className="flex h-7 w-7 items-center justify-center rounded-sm bg-sky-950/80 border border-sky-600/50 shadow-xs">
            <span className="font-mono text-[11px] font-black tracking-tighter text-sky-300">
              RX
            </span>
          </div>
          <div>
            <div className="flex items-center gap-1.5 leading-none">
              <h1 className="font-mono text-xs font-black tracking-wider text-slate-100">
                RTPXO
              </h1>
              <span className="rounded-2xs bg-slate-900 border border-slate-700 px-1 py-0.2 font-mono text-[8px] font-bold text-sky-400">
                CTC-OPS
              </span>
              <span className="text-[8px] font-mono text-slate-500 font-normal ml-0.5">
                by Team TVARIT
              </span>
            </div>
            <span className="text-[9px] font-mono text-slate-400 leading-none">
              Real-Time Proactive Execution Optimizer · SIH 2026
            </span>
          </div>
        </div>

        {/* Master Simulation Controls & Clock Strip */}
        <div className="flex items-center gap-2 flex-shrink-0 font-mono text-xs">
          {/* Start/Pause Master Action */}
          <button
            type="button"
            onClick={() => simulationEngine.toggle()}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-sm text-[10px] font-extrabold tracking-wide transition-all ${
              running
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/50 hover:bg-amber-500/30"
                : "bg-emerald-600 text-white hover:bg-emerald-500 shadow-sm"
            }`}
          >
            <span>{running ? "⏸ PAUSE" : "▶ START"}</span>
          </button>

          {/* Master Clock & Staging Status */}
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-sm bg-slate-900 border border-slate-800 text-[11px]">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                running ? "bg-emerald-400 animate-ping" : simulationTime === 0 ? "bg-cyan-400" : "bg-amber-400"
              }`}
            />
            <span className="font-mono font-black text-slate-100 tracking-wider">
              {formatSimulationClock(simulationTime)}
            </span>
            {!running && (
              <span className="text-[8px] px-1 py-0.2 rounded-2xs font-bold bg-slate-800 text-cyan-300 border border-slate-700">
                {simulationTime === 0 ? "STAGED" : "PAUSED"}
              </span>
            )}
          </div>

          {/* Speed Multiplier Pill Group */}
          <div className="flex items-center rounded-sm bg-slate-900 border border-slate-800 p-0.5">
            {SPEED_MULTIPLIERS.map((multiplier) => (
              <button
                key={multiplier}
                type="button"
                onClick={() => simulationEngine.setSpeedMultiplier(multiplier)}
                className={`px-1.5 py-0.5 text-[9px] font-bold rounded-2xs transition ${
                  speedMultiplier === multiplier
                    ? "bg-sky-600 text-white shadow-xs"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {multiplier}×
              </button>
            ))}
          </div>

          {/* Scenario Selector */}
          <div className="flex items-center gap-1 rounded-sm bg-slate-900 border border-slate-800 px-1.5 py-0.5">
            <span className="text-[9px] text-slate-500 uppercase font-semibold">SCENARIO:</span>
            <select
              value={activeScenarioId}
              onChange={(e) => simulationEngine.loadScenario(e.target.value)}
              className="bg-transparent text-[10px] font-bold text-sky-300 outline-none cursor-pointer max-w-[150px] truncate"
            >
              {availableScenarios.map((s) => (
                <option key={s.id} value={s.id} className="bg-slate-900 text-slate-200">
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Master Reset */}
          <button
            type="button"
            onClick={() => simulationEngine.resetScenario()}
            title="Reset Scenario"
            className="px-2 py-1 rounded-sm bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[10px] text-slate-400 hover:text-slate-200"
          >
            ↺ RESET
          </button>
        </div>

        {/* Telemetry Ribbons: Trains, Delayed, Conflicts, Throughput, Health, AI */}
        <div className="flex items-center gap-1.5 font-mono text-[10px] flex-shrink-0">
          {/* Active Trains */}
          <div className="px-2 py-0.5 rounded-sm bg-slate-900 border border-slate-800 text-center">
            <span className="text-slate-500 block text-[8px] uppercase">TRAINS</span>
            <strong className="text-slate-100 font-extrabold">{telemetry.activeTrains}</strong>
          </div>

          {/* Delayed Trains */}
          <div
            className={`px-2 py-0.5 rounded-sm border text-center ${
              telemetry.delayedTrains > 0
                ? "bg-amber-950/40 border-amber-600/40 text-amber-300"
                : "bg-slate-900 border-slate-800 text-slate-300"
            }`}
          >
            <span className="text-slate-500 block text-[8px] uppercase">DELAYED</span>
            <strong className="font-extrabold">{telemetry.delayedTrains}</strong>
          </div>

          {/* Active Safety Conflicts */}
          <div
            className={`px-2 py-0.5 rounded-sm border text-center ${
              telemetry.activeConflicts > 0
                ? "bg-red-950/50 border-red-500/50 text-red-300 animate-pulse"
                : "bg-slate-900 border-slate-800 text-emerald-400"
            }`}
            title="Interlocking Safety & Signal Separation Status"
          >
            <span className="text-slate-500 block text-[8px] uppercase">SAFETY CONFLICTS</span>
            <strong className="font-extrabold">
              {telemetry.activeConflicts > 0 ? `${telemetry.activeConflicts} CRITICAL` : "0 (SIL-4 SECURE)"}
            </strong>
          </div>

          {/* Corridor Throughput */}
          <div className="px-2 py-0.5 rounded-sm bg-slate-900 border border-slate-800 text-center">
            <span className="text-slate-500 block text-[8px] uppercase">THROUGHPUT</span>
            <strong className="text-slate-200 font-extrabold flex items-center justify-center gap-1">
              <span>{telemetry.throughput.corridorThroughput} T/h</span>
              <span
                className={`text-[8px] font-bold ${
                  snapshot.throughputMetrics.throughputImprovement > 0
                    ? "text-emerald-400"
                    : snapshot.throughputMetrics.throughputImprovement < 0
                    ? "text-rose-400"
                    : "text-slate-400"
                }`}
              >
                ({snapshot.throughputMetrics.throughputImprovement > 0 ? "↑" : snapshot.throughputMetrics.throughputImprovement < 0 ? "↓" : "→"}{" "}
                {snapshot.throughputMetrics.throughputImprovement > 0 ? `+${snapshot.throughputMetrics.throughputImprovement}%` : `${snapshot.throughputMetrics.throughputImprovement}%`})
              </span>
            </strong>
          </div>

          {/* Primary Dashboard Compact Recovery Status */}
          <button
            type="button"
            onClick={() => onSelectWorkspace?.("RECOVERY")}
            className={`px-2 py-0.5 rounded-sm border text-center transition cursor-pointer ${
              activeIncidents.length > 0
                ? "bg-red-950/70 border-red-500/70 text-red-300 animate-pulse hover:bg-red-900/80"
                : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
            }`}
            title="Open Recovery Console"
          >
            <span className="text-slate-500 block text-[8px] uppercase">RECOVERY</span>
            <strong className="text-[10px] font-extrabold flex items-center gap-1 justify-center">
              {activeIncidents.length > 0 ? (
                <>
                  <span className="text-red-400">{activeIncidents.length} ACTIVE</span>
                  <span className="text-[8px] bg-red-900/80 text-red-200 px-1 rounded-2xs">
                    {activeIncidents[0].severity}
                  </span>
                </>
              ) : (
                <span className="text-emerald-400">0 ACTIVE</span>
              )}
            </strong>
          </button>

          {/* Network Health Assessment & Unacknowledged Alarm Strip */}
          <div
            className={`flex items-center gap-1.5 px-2 py-1 rounded-sm border font-bold ${getAssessmentBadgeStyle(
              healthStatus
            )}`}
          >
            <span className="text-[8px] text-slate-400">HEALTH:</span>
            <span className="text-[10px]">{healthStatus}</span>
          </div>

          {/* Unacknowledged Alarm Banner */}
          {net.unacknowledgedCount > 0 && (
            <button
              type="button"
              onClick={() => net.acknowledgeAllAlerts()}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-sm bg-red-950/90 border border-red-500 text-red-200 text-[10px] font-black animate-pulse hover:bg-red-900 shadow-md transition"
              title="Click to acknowledge all active critical safety alarms"
            >
              <span>🚨</span>
              <span>{net.unacknowledgedCount} UNACK ALARM{net.unacknowledgedCount > 1 ? "S" : ""}</span>
              <span className="bg-red-800 text-white px-1 py-0.2 rounded-2xs text-[8px] uppercase">ACK ALL</span>
            </button>
          )}

          {/* Alarm Audio Mute/Unmute Toggle */}
          <button
            type="button"
            onClick={() => net.toggleAlarmAudio()}
            className={`px-1.5 py-1 rounded-sm border text-[10px] font-bold transition ${
              net.isAlarmAudioMuted
                ? "bg-slate-900 border-slate-700 text-slate-500 hover:text-slate-300"
                : "bg-cyan-950/60 border-cyan-500/50 text-cyan-300 hover:bg-cyan-900/60"
            }`}
            title={net.isAlarmAudioMuted ? "Alarm Audio Muted (Click to Unmute)" : "Alarm Audio Active (Click to Mute)"}
          >
            {net.isAlarmAudioMuted ? "🔇" : "🔊"}
          </button>

          {/* AI State */}
          <div className="flex items-center gap-1 px-2 py-1 rounded-sm bg-slate-900 border border-slate-800">
            <span className="text-[8px] text-slate-400 font-bold">AI SCORE:</span>
            <strong className="text-cyan-400 font-extrabold font-data text-xs tracking-tight glow-ai" style={{ color: "var(--ai-accent)" }}>
              {aiScore}%
            </strong>
          </div>

          {/* Tour / Help Modal Trigger */}
          {onOpenTour && (
            <button
              type="button"
              onClick={onOpenTour}
              className="px-2 py-1 rounded-sm bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-[10px] font-bold"
              title="Workflow Tour"
            >
              📖 TOUR
            </button>
          )}
        </div>
      </div>

      {/* 2. SECONDARY NAVIGATION BAR */}
      <div className="px-3 bg-slate-950 flex items-center justify-between border-b border-slate-900/60 relative">
        <nav className="flex items-center gap-1 py-0.5 font-mono text-[11px]">
          {workspaces.map((ws) => {
            const isActive = activeWorkspace === ws.id;
            return (
              <button
                key={ws.id}
                type="button"
                onClick={() => onSelectWorkspace?.(ws.id)}
                className={`flex items-center gap-1.5 px-3 py-1 font-extrabold tracking-wide transition-all border-b-2 whitespace-nowrap ${
                  isActive
                    ? "bg-slate-900 text-sky-400 border-sky-500 shadow-inner"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 border-transparent"
                }`}
              >
                <span className="text-xs">{ws.icon}</span>
                <span>{ws.label}</span>
                {ws.badge && (
                  <span className={`px-1 py-0.1 text-[8px] rounded-2xs ${ws.badgeColor}`}>
                    {ws.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="hidden lg:flex items-center gap-3 text-[9px] font-mono text-slate-400">
          <span>CORRIDOR: <strong className="text-slate-300">NDLS → SRE (186 km)</strong></span>
          <span>•</span>
          <span className="text-emerald-400 font-semibold">SIL-4 ABSOLUTE BLOCK INTERLOCKING</span>
          <span>•</span>
          <span className="text-sky-400">OPERATOR AUTHORIZATION MANDATORY</span>
        </div>
      </div>

      {/* Real-Time Dispatch Action Toast */}
      {net.activeToast && (
        <div className="absolute top-14 right-6 z-50 rounded-sm border border-cyan-400/80 bg-slate-950/95 px-3 py-1.5 font-mono text-xs text-cyan-200 shadow-2xl backdrop-blur flex items-center gap-2 animate-fade-in">
          <span className="h-2 w-2 rounded-full bg-cyan-400 animate-ping" />
          <span>{net.activeToast}</span>
        </div>
      )}

      {/* Two-Step Confirmation Modal for Irreversible Actions */}
      {net.pendingConfirmation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs font-mono select-none">
          <div className="w-full max-w-md rounded-sm border border-amber-500/80 bg-slate-950 p-4 shadow-2xl text-slate-100 space-y-3 animate-scale-in">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2 text-amber-400 font-black text-sm">
                <span>⚠️</span>
                <span>OPERATOR CONFIRMATION REQUIRED</span>
              </div>
              <span className="text-[9px] bg-slate-900 border border-slate-700 px-1.5 py-0.5 rounded text-slate-400">
                SIL-4 SAFETY GATE
              </span>
            </div>

            <div className="space-y-1.5 text-xs">
              <h4 className="font-bold text-white text-sm">
                {net.pendingConfirmation.title}
              </h4>
              <p className="text-slate-300 leading-relaxed font-sans text-xs">
                {net.pendingConfirmation.description}
              </p>
              <div className="rounded bg-slate-900/80 border border-slate-800 p-2 text-[11px] text-amber-200">
                <strong>Projected Impact:</strong> {net.pendingConfirmation.impactSummary}
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-800">
              <span className="text-[10px] text-slate-500">
                Actor: <strong className="text-slate-300">{net.pendingConfirmation.actor}</strong>
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => net.cancelConfirmation()}
                  className="rounded-2xs border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-bold text-slate-300 hover:bg-slate-800"
                >
                  CANCEL
                </button>
                <button
                  type="button"
                  onClick={() => net.confirmPendingAction()}
                  className="rounded-2xs bg-amber-500 hover:bg-amber-400 text-slate-950 font-black px-4 py-1.5 text-xs shadow-lg transition"
                >
                  CONFIRM & DISPATCH
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

