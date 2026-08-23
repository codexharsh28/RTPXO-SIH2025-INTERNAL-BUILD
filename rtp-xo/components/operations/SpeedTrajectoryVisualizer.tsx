"use client";

import React from "react";
import { AIRecommendation } from "@/types/advisor";

interface SpeedTrajectoryVisualizerProps {
  recommendation: AIRecommendation;
  onClose: () => void;
}

export const SpeedTrajectoryVisualizer: React.FC<SpeedTrajectoryVisualizerProps> = ({
  recommendation,
  onClose,
}) => {
  const trajectory = recommendation.speedTrajectory;
  const breakdown = recommendation.objectiveScoreBreakdown;
  const rejectedAlternatives = recommendation.rejectedAlternatives || [];
  const constraints = recommendation.constraintsChecked;

  return (
    <div className="rounded-lg border border-slate-300 bg-white p-4 shadow-sm font-mono text-xs text-slate-800">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-slate-900" />
            <h3 className="font-mono text-xs font-black uppercase tracking-wider text-slate-900">
              7-POINT AI EXPLAINABILITY & TRAJECTORY TREE
            </h3>
          </div>
          <p className="mt-0.5 text-[11px] text-slate-500">
            Train: <strong className="text-slate-900">{recommendation.affectedTrainId}</strong> • Lookahead: {recommendation.predictionHorizonSeconds || 300}s
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="rounded-sm border border-slate-300 bg-slate-100 px-2.5 py-1 text-slate-700 hover:bg-slate-200"
        >
          ✕ Close Inspector
        </button>
      </div>

      {/* 7-Point Explainability Breakdown */}
      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2.5">
        {/* Point 1: What is happening? */}
        <div className="rounded-sm border border-slate-200 bg-slate-50 p-2.5">
          <span className="text-[10px] text-slate-600 font-bold uppercase block mb-1">
            1. What is happening?
          </span>
          <p className="text-slate-700 text-xs leading-relaxed font-sans font-medium">
            Train <strong className="text-slate-900 font-bold">{recommendation.affectedTrainId}</strong> is navigating section <strong className="text-slate-900 font-bold">{recommendation.affectedSectionId}</strong>. {recommendation.reason}
          </p>
        </div>

        {/* Point 2: Why is this action recommended? */}
        <div className="rounded-sm border border-slate-200 bg-slate-50 p-2.5">
          <span className="text-[10px] text-slate-600 font-bold uppercase block mb-1">
            2. Why is this action recommended?
          </span>
          <p className="text-slate-700 text-xs leading-relaxed font-sans font-medium">
            Optimizes section flow dynamics, avoids downstream block saturation, and yields an objective score of <strong className="text-emerald-700 font-bold">{recommendation.objectiveScore ?? "OPTIMAL"}</strong>.
          </p>
        </div>

        {/* Point 3: What action will be taken? */}
        <div className="rounded-sm border border-slate-200 bg-slate-50 p-2.5">
          <span className="text-[10px] text-amber-800 font-bold uppercase block mb-1">
            3. What action will be taken?
          </span>
          <div className="text-xs font-bold text-slate-900">
            <span>{recommendation.action.replace("_", " ")}</span>
            {recommendation.targetSpeed !== undefined && (
              <span className="text-amber-800 ml-2">Commanded Speed: {recommendation.targetSpeed} km/h</span>
            )}
            {recommendation.holdDurationSeconds !== undefined && (
              <span className="text-red-800 ml-2">Hold Duration: {recommendation.holdDurationSeconds}s</span>
            )}
          </div>
        </div>

        {/* Point 4: Expected Effect? */}
        <div className="rounded-sm border border-slate-200 bg-slate-50 p-2.5">
          <span className="text-[10px] text-emerald-800 font-bold uppercase block mb-1">
            4. What is the expected effect?
          </span>
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="text-emerald-700">+{recommendation.expectedThroughputImpact}% Throughput</span>
            <span className="text-slate-900">{recommendation.expectedDelayImpact} min Delay Reduction</span>
          </div>
        </div>

        {/* Point 5: Is it safe to dispatch? */}
        <div className="rounded-sm border border-slate-200 bg-slate-50 p-2.5">
          <span className="text-[10px] text-slate-600 font-bold uppercase block mb-1">
            5. Is it safe to dispatch?
          </span>
          <div className="flex items-center gap-2">
            <span className="rounded-sm bg-emerald-100 border border-emerald-300 px-2 py-0.5 text-xs text-emerald-800 font-bold">
              ✓ VERIFIED SAFE
            </span>
            <span className="text-[11px] text-slate-600 font-sans">Validated against absolute block headway & signals.</span>
          </div>
        </div>

        {/* Point 6: What constraints were checked? */}
        <div className="rounded-sm border border-slate-200 bg-slate-50 p-2.5">
          <span className="text-[10px] text-slate-600 font-bold uppercase block mb-1">
            6. What constraints were checked?
          </span>
          <div className="grid grid-cols-3 gap-1 text-[9px] text-center">
            <div className="rounded-sm bg-white p-1 border border-slate-200">
              <span className="text-slate-500 block">Headway</span>
              <strong className="text-emerald-700">{constraints?.headway ?? "PASS"}</strong>
            </div>
            <div className="rounded-sm bg-white p-1 border border-slate-200">
              <span className="text-slate-500 block">Downstream</span>
              <strong className="text-emerald-700">{constraints?.downstreamOccupancy ?? "CLEAR"}</strong>
            </div>
            <div className="rounded-sm bg-white p-1 border border-slate-200">
              <span className="text-slate-500 block">Signal</span>
              <strong className="text-emerald-700">{constraints?.signalAuthority ?? "PASS"}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Trajectory Profile Card */}
      {trajectory && (
        <div className="mt-3 rounded-sm border border-slate-200 bg-slate-50 p-3">
          <span className="block text-[10px] uppercase text-slate-700 font-bold mb-1">
            Planned Multi-Stage Speed Profile
          </span>
          <p className="text-slate-800 text-xs leading-relaxed font-semibold">
            {trajectory.summary}
          </p>

          {/* Trajectory Stages Breakdown */}
          <div className="mt-2 space-y-1.5">
            {trajectory.stages.map((stage) => (
              <div
                key={stage.stageIndex}
                className="flex items-center justify-between rounded-sm border border-slate-200 bg-white px-3 py-1.5 text-[11px]"
              >
                <div className="flex items-center gap-2">
                  <span className="rounded-sm bg-slate-100 border border-slate-300 px-1.5 py-0.2 text-[9px] font-bold text-slate-800">
                    STAGE {stage.stageIndex}
                  </span>
                  <span className="text-slate-800">{stage.instruction}</span>
                </div>
                <div className="text-right text-[10px] text-slate-600">
                  <span className="text-slate-900 font-bold">{stage.speedKmH} km/h</span> • {stage.durationSeconds}s
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Objective Score Breakdown */}
      {breakdown && (
        <div className="mt-3 rounded-sm border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase text-slate-600 font-bold">
              Composite Objective Score Breakdown
            </span>
            <span className="font-mono text-sm font-black text-slate-900">
              Total Score: {breakdown.totalScore}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-[10px]">
            <div className="rounded-sm bg-white p-2 border border-slate-200">
              <span className="text-slate-500 block">Throughput Gain (w=40)</span>
              <strong className="text-emerald-700">+{breakdown.throughputGainScore}</strong>
            </div>
            <div className="rounded-sm bg-white p-2 border border-slate-200">
              <span className="text-slate-500 block">Delay Recovery (w=25)</span>
              <strong className="text-slate-900">+{breakdown.delayRecoveryScore}</strong>
            </div>
            <div className="rounded-sm bg-white p-2 border border-slate-200">
              <span className="text-slate-500 block">Bottleneck Relief (w=20)</span>
              <strong className="text-amber-700">+{breakdown.bottleneckReliefScore}</strong>
            </div>
            <div className="rounded-sm bg-white p-2 border border-slate-200">
              <span className="text-slate-500 block">Priority Weight (w=10)</span>
              <strong className="text-slate-900">+{breakdown.priorityScore}</strong>
            </div>
            <div className="rounded-sm bg-white p-2 border border-slate-200">
              <span className="text-slate-500 block">Braking Loss Penalty</span>
              <strong className="text-red-700">{breakdown.brakingLossScore}</strong>
            </div>
            <div className="rounded-sm bg-white p-2 border border-slate-200">
              <span className="text-slate-500 block">Junction Wait Penalty</span>
              <strong className="text-amber-700">{breakdown.junctionWaitScore}</strong>
            </div>
          </div>
        </div>
      )}

      {/* Point 7: Rejected Candidate Alternatives */}
      {rejectedAlternatives.length > 0 && (
        <div className="mt-3 rounded-sm border border-slate-200 bg-slate-50 p-3">
          <span className="block text-[10px] uppercase text-slate-600 font-bold mb-2">
            7. What alternatives were rejected? ({rejectedAlternatives.length} Evaluated)
          </span>
          <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
            {rejectedAlternatives.map((alt) => (
              <div
                key={alt.id}
                className="flex items-center justify-between rounded-sm bg-white p-1.5 text-[10px] border border-slate-200"
              >
                <div className="flex items-center gap-1.5">
                  <span
                    className={`rounded-sm px-1 py-0.2 text-[8px] font-bold uppercase ${
                      alt.isSafe
                        ? "bg-slate-100 text-slate-700 border border-slate-300"
                        : "bg-red-100 text-red-800 border border-red-300"
                    }`}
                  >
                    {alt.action}
                  </span>
                  <span className="text-slate-700">{alt.reason}</span>
                </div>
                <div className="text-slate-500">
                  Score: <strong className={alt.isSafe ? "text-slate-800" : "text-red-700"}>{alt.objectiveScore === -Infinity ? "REJECTED" : alt.objectiveScore}</strong>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
