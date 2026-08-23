"use client";

import React, { useState, useMemo, useRef, useEffect, memo } from "react";
import { SimulationSnapshot } from "@/types/simulation";
import { Train, RailwaySection, SectionStatus, SignalAspect } from "@/types/railway";
import { AIRecommendation } from "@/types/advisor";
import {
  multiLineNetworkGraph,
  multiLineDefinitions,
  multiLineStations,
  multiLineSections,
  multiLineSwitches,
  multiLineInterlockingZones,
  getTrainSchematic2DPosition,
  getTrainJunctionApproach,
} from "@/data/multiLineTopology";
import { StationTopologyNode } from "@/types/topology";
import { getTrainVisualState } from "@/hooks/useNetworkState";

interface NetworkMapProps {
  snapshot?: SimulationSnapshot;
  trains?: Train[];
  conflicts?: any[];
  recommendations?: AIRecommendation[] | any[];
  onSelectTrain?: (train: any) => void;
  onSelectSection?: (section: any) => void;
  selectedTrain?: Train | null;
  selectedSection?: RailwaySection | null;
  selectedTrainId?: string | null;
  predictionHorizon?: number;
  onSetPredictionHorizon?: (seconds: number) => void;
  lookaheadCheckpoints?: Array<{
    seconds: number;
    trains: Train[];
    conflictsCount: number;
  }>;
  selectedTimelineOffset?: number;
  onSelectTimelineOffset?: (offset: number) => void;
  interlockingStatus?: "NOMINAL" | "RESTRICTED" | "DEGRADED";
}

export const NetworkMap = memo(function NetworkMap({
  snapshot,
  trains = [],
  conflicts = [],
  recommendations = [],
  onSelectTrain,
  onSelectSection,
  selectedTrain,
  selectedSection,
  selectedTrainId,
  predictionHorizon = 300,
  onSetPredictionHorizon,
  lookaheadCheckpoints = [],
  selectedTimelineOffset = 0,
  onSelectTimelineOffset,
  interlockingStatus = "NOMINAL",
}: NetworkMapProps) {
  // Resolve effective state
  const effectiveTrains = trains.length ? trains : snapshot?.trains || [];
  const effectiveConflicts = conflicts.length ? conflicts : snapshot?.conflicts || [];
  const effectiveRecommendations = recommendations.length ? recommendations : snapshot?.recommendations || [];
  const effectiveSelectedTrainId = selectedTrainId || selectedTrain?.id || null;

  // Viewport and Filter State
  const [selectedLineId, setSelectedLineId] = useState<string>("ALL");
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [showGhosts, setShowGhosts] = useState<boolean>(true);
  const [showHeadway, setShowHeadway] = useState<boolean>(false);
  const [showSignals, setShowSignals] = useState<boolean>(true);
  const [showInterlockingZones, setShowInterlockingZones] = useState<boolean>(false);

  // Station Inspection Modal
  const [inspectedStation, setInspectedStation] = useState<StationTopologyNode | null>(null);

  // Zoom handlers
  const handleZoomIn = () => setZoomLevel((prev) => Math.min(prev + 20, 180));
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(prev - 20, 80));
  const handleZoomReset = () => setZoomLevel(100);

  // Dynamic Viewport Container Measurement
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState<{ width: number; height: number }>({
    width: 1200,
    height: 350,
  });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setContainerSize({ width: rect.width, height: rect.height });
      }
    };

    updateSize();

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setContainerSize({ width, height });
        }
      }
    });

    observer.observe(el);
    window.addEventListener("resize", updateSize);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateSize);
    };
  }, []);

  // Compute dynamic viewBox that tightly frames the railway network inside available container
  const dynamicViewBox = useMemo(() => {
    const { width, height } = containerSize;
    const aspect = width > 0 && height > 0 ? width / height : 1200 / 350;

    // True physical bounding box of the complete railway topology:
    // Tracks span X: 30 to 1170. Station text/dots span X: 25 to 1180.
    // Tracks span Y: 85 to 291. Top labels reach Y: 38. Bottom labels reach Y: 325.
    const netMinX = 25;
    const netMaxX = 1180;
    const netMinY = 38;
    const netMaxY = 325;
    const netW = netMaxX - netMinX; // 1155
    const netH = netMaxY - netMinY; // 287
    const netCenterX = (netMinX + netMaxX) / 2; // 602.5
    const netCenterY = (netMinY + netMaxY) / 2; // 181.5

    // Desired network occupancy ratio:
    // Fits network to occupy ~82% - 88% of map width with clean symmetric breathing room.
    const targetHorizOccupancy = 0.86;
    const targetVertOccupancy = 0.88;

    const reqViewWForHoriz = netW / targetHorizOccupancy;
    const reqViewHForVert = netH / targetVertOccupancy;

    const viewWFromVert = reqViewHForVert * aspect;
    const viewHFromHoriz = reqViewWForHoriz / aspect;

    let viewWidth: number;
    let viewHeight: number;

    if (viewWFromVert >= reqViewWForHoriz) {
      viewHeight = reqViewHForVert;
      viewWidth = viewWFromVert;
    } else {
      viewWidth = reqViewWForHoriz;
      viewHeight = viewHFromHoriz;
    }

    const viewX = netCenterX - viewWidth / 2;
    const viewY = netCenterY - viewHeight / 2;

    return `${viewX.toFixed(2)} ${viewY.toFixed(2)} ${viewWidth.toFixed(2)} ${viewHeight.toFixed(2)}`;
  }, [containerSize]);

  // SVG Virtual Canvas Coordinates (Dense Wide Layout: 1200 x 360)
  const SVG_W = 1200;
  const SVG_H = 350;

  // Station Yard Node Positions in Wide Grid Space
  const stationNodes: Record<string, { x: number; y: number; labelY: "top" | "bottom"; platforms: number; km: number; name: string; code: string }> = {
    ND:   { x: 55,   y: 100, labelY: "top",    platforms: 16, km: 0,   name: "New Delhi", code: "NDLS" },
    NZM:  { x: 160,  y: 100, labelY: "top",    platforms: 6,  km: 8,   name: "Hazrat Nizamuddin", code: "NZM" },
    GZB:  { x: 280,  y: 100, labelY: "top",    platforms: 6,  km: 25,  name: "Ghaziabad", code: "GZB" },
    MRT:  { x: 440,  y: 85,  labelY: "top",    platforms: 5,  km: 71,  name: "Meerut", code: "MRT" },
    MB:   { x: 650,  y: 85,  labelY: "top",    platforms: 5,  km: 120, name: "Moradabad", code: "MB" },
    BE:   { x: 820,  y: 85,  labelY: "top",    platforms: 5,  km: 150, name: "Bareilly", code: "BE" },
    SNP:  { x: 1140, y: 85,  labelY: "top",    platforms: 7,  km: 186, name: "Saharanpur", code: "SNP" },

    ALJN: { x: 280,  y: 200, labelY: "top",    platforms: 6,  km: 80,  name: "Aligarh", code: "ALJN" },
    TDL:  { x: 460,  y: 200, labelY: "top",    platforms: 6,  km: 92,  name: "Tundla", code: "TDL" },
    CNB:  { x: 740,  y: 200, labelY: "top",    platforms: 8,  km: 131, name: "Kanpur Central", code: "CNB" },
    LKO:  { x: 1130, y: 200, labelY: "top",    platforms: 8,  km: 175, name: "Lucknow", code: "LKO" },

    DBR:  { x: 100,  y: 285, labelY: "bottom", platforms: 4,  km: 15,  name: "Dadri", code: "DBR" },
    PKA:  { x: 210,  y: 285, labelY: "bottom", platforms: 4,  km: 22,  name: "Pilkhua", code: "PKA" },
    HPU:  { x: 330,  y: 285, labelY: "bottom", platforms: 4,  km: 35,  name: "Hapur", code: "HPU" },
    MNR:  { x: 440,  y: 285, labelY: "bottom", platforms: 4,  km: 45,  name: "Modinagar", code: "MNR" },
    MRD:  { x: 550,  y: 285, labelY: "bottom", platforms: 4,  km: 52,  name: "Muradnagar", code: "MRD" },
  };

  // ---------------------------------------------------------------------------
  // DYNAMIC SVG RAILWAY ROUTE KINEMATICS AND COORDINATE INTERPOLATION
  // ---------------------------------------------------------------------------

  const calculateTrainMapCoordinates = (
    train: Train
  ): { x: number; y: number; angle: number } => {
    const sectionId = train.currentSection || "ND-GZB-01";
    const pos = Math.max(0, Math.min(Number(train.position) || 0, 100)) / 100;

    // Determine physical track vertical alignment
    let trackY = 85;
    if (train.id === "T001" || train.priority >= 9) {
      trackY = 85; // Track 1 Up Main
    } else if (train.id === "T002" || train.status === "DELAYED") {
      trackY = 115; // Track 3 Passing Loop
    } else if (train.type === "FREIGHT" || train.id === "T004") {
      trackY = 121; // Track 4 Freight Siding
    } else {
      trackY = 91; // Track 2 Down Main
    }

    // 1. Line A: New Delhi -> Ghaziabad
    if (sectionId === "ND-GZB-01" || sectionId === "SEC-ND-GZB") {
      const startX = 55;
      const endX = 280;
      const y = trackY === 115 ? 115 : trackY === 121 ? 121 : trackY === 91 ? 106 : 100;
      const x = startX + (endX - startX) * pos;
      return { x, y, angle: 0 };
    }

    // 2. Line A: Ghaziabad -> Meerut (Yard throat curve divergence)
    if (sectionId === "GZB-MRT-01" || sectionId === "SEC-GZB-MRT") {
      const curveEndX = 320;
      const mrtX = 440;
      const curveFraction = 0.15;
      const startY = trackY === 121 || trackY === 91 ? 106 : 100;

      if (pos <= curveFraction) {
        const t = pos / curveFraction;
        const x = 280 + (curveEndX - 280) * t;
        const y = startY + (trackY - startY) * t;
        const angle = (Math.atan2(trackY - startY, curveEndX - 280) * 180) / Math.PI;
        return { x, y, angle };
      } else {
        const t = (pos - curveFraction) / (1 - curveFraction);
        const x = curveEndX + (mrtX - curveEndX) * t;
        return { x, y: trackY, angle: 0 };
      }
    }

    // 3. Line A: Meerut -> Saharanpur (Main Corridor)
    if (sectionId === "MRT-SNP-01" || sectionId === "SEC-MRT-SNP") {
      const startX = 440;
      const endX = 1140;
      const x = startX + (endX - startX) * pos;
      return { x, y: trackY, angle: 0 };
    }

    // 4. Line B: Ghaziabad -> Aligarh (Branch divergence curve)
    if (sectionId === "GZB-ALJN-01" || sectionId === "SEC-GZB-ALJN") {
      const curveFraction = 0.25;
      if (pos <= curveFraction) {
        const t = pos / curveFraction;
        const x = 280 + (330 - 280) * t;
        const y = 100 + (200 - 100) * t;
        const angle = (Math.atan2(100, 50) * 180) / Math.PI;
        return { x, y, angle };
      } else {
        const t = (pos - curveFraction) / (1 - curveFraction);
        const x = 330 + (460 - 330) * t;
        return { x, y: trackY === 91 ? 206 : 200, angle: 0 };
      }
    }

    // 5. Line B: Aligarh -> Kanpur / Lucknow (Trunk Corridor)
    if (
      sectionId === "ALJN-KNP-01" ||
      sectionId === "ALJN-AGC-01" ||
      sectionId.startsWith("ALJN-") ||
      sectionId.startsWith("TDL-") ||
      sectionId.startsWith("CNB-")
    ) {
      const startX = 350;
      const endX = 1130;
      const x = startX + (endX - startX) * pos;
      return { x, y: trackY === 91 ? 206 : 200, angle: 0 };
    }

    // 6. Line E / C: Dadri -> New Delhi (Radial Link)
    if (sectionId === "DBR-ND-01" || sectionId === "ND-ANVT-01" || sectionId === "ANVT-GZB-01") {
      const x = 100 + (55 - 100) * pos;
      const y = 285 + (100 - 285) * pos;
      const angle = (Math.atan2(100 - 285, 55 - 100) * 180) / Math.PI;
      return { x, y, angle };
    }

    // 7. Line C: Dadri -> Muradnagar (Radial Corridor)
    if (sectionId.startsWith("DBR-") || sectionId.startsWith("HPU-") || sectionId.startsWith("MRD-")) {
      const x = 100 + (550 - 100) * pos;
      return { x, y: 285, angle: 0 };
    }

    // 8. Line D: Aligarh -> Meerut Cross-link
    if (sectionId === "ALJN-MRT-01") {
      const x = 280 + (320 - 280) * pos;
      const y = 200 + (85 - 200) * pos;
      const angle = (Math.atan2(85 - 200, 320 - 280) * 180) / Math.PI;
      return { x, y, angle };
    }

    // 9. Generic Topological Fallback
    const sec = multiLineSections[sectionId];
    if (sec) {
      const st1 = stationNodes[sec.startStationId];
      const st2 = stationNodes[sec.endStationId];
      if (st1 && st2) {
        const x = st1.x + (st2.x - st1.x) * pos;
        const y = st1.y + (st2.y - st1.y) * pos;
        const angle = (Math.atan2(st2.y - st1.y, st2.x - st1.x) * 180) / Math.PI;
        return { x, y, angle };
      }
    }

    return { x: 55 + (1140 - 55) * pos, y: 85, angle: 0 };
  };

  // Build authoritative trains with accurate live physical rail placement & collision avoidance
  const displayTrains = useMemo(() => {
    const rawPlacements = effectiveTrains.map((train) => {
      const coords = calculateTrainMapCoordinates(train);
      return {
        train,
        x: coords.x,
        y: coords.y,
        angle: coords.angle,
      };
    });

    // Multi-Train Proximity Collision Resolution (Near Junctions / ALJN / GZB)
    const resolvedTrains: Array<{
      train: Train;
      x: number;
      y: number;
      angle: number;
      hudOffsetY: number;
      hudOffsetX: number;
      hasCollisionOffset: boolean;
    }> = [];

    // Sort by x ascending, then priority descending
    const sorted = [...rawPlacements].sort((a, b) => a.x - b.x || b.train.priority - a.train.priority);

    for (let i = 0; i < sorted.length; i++) {
      const item = sorted[i];
      let hudOffsetY = -13;
      let hudOffsetX = 8;
      let hasCollisionOffset = false;

      // Check collision against already resolved items
      const collidingNeighbours = resolvedTrains.filter(
        (prev) => Math.abs(prev.x - item.x) < 72 && Math.abs((prev.y + prev.hudOffsetY) - (item.y + hudOffsetY)) < 26
      );

      if (collidingNeighbours.length > 0) {
        hasCollisionOffset = true;
        // Cascade vertical offset (alternating top/bottom)
        const candidateOffsets = [-13, 20, -42, 48, -70];
        for (const candidate of candidateOffsets) {
          const wouldCollide = collidingNeighbours.some(
            (prev) => Math.abs((prev.y + prev.hudOffsetY) - (item.y + candidate)) < 24
          );
          if (!wouldCollide) {
            hudOffsetY = candidate;
            break;
          }
        }
      }

      resolvedTrains.push({
        ...item,
        hudOffsetY,
        hudOffsetX,
        hasCollisionOffset,
      });
    }

    return resolvedTrains;
  }, [effectiveTrains]);

  // High-Density Wayside Signals
  const waysideSignals = useMemo(() => [
    // Main Corridor Signals
    { id: "S-01", x: 90,   y: 75,  aspect: "GREEN" },
    { id: "S-02", x: 130,  y: 75,  aspect: "GREEN" },
    { id: "S-03", x: 200,  y: 75,  aspect: "GREEN" },
    { id: "S-04", x: 240,  y: 75,  aspect: "GREEN" },
    { id: "S-05", x: 270,  y: 75,  aspect: "GREEN" },
    { id: "S-06", x: 310,  y: 75,  aspect: "AMBER" },
    { id: "S-07", x: 390,  y: 75,  aspect: "GREEN" },
    { id: "S-08", x: 420,  y: 75,  aspect: "GREEN" },
    { id: "S-09", x: 480,  y: 75,  aspect: "GREEN" },
    { id: "S-10", x: 580,  y: 75,  aspect: "GREEN" },
    { id: "S-11", x: 620,  y: 75,  aspect: "GREEN" },
    { id: "S-12", x: 680,  y: 75,  aspect: "AMBER" },
    { id: "S-13", x: 780,  y: 75,  aspect: "GREEN" },
    { id: "S-14", x: 860,  y: 75,  aspect: "GREEN" },
    { id: "S-15", x: 960,  y: 75,  aspect: "GREEN" },
    { id: "S-16", x: 1080, y: 75,  aspect: "GREEN" },

    // Parallel Passing Track Signals
    { id: "S-17", x: 340,  y: 125, aspect: "AMBER" },
    { id: "S-18", x: 480,  y: 125, aspect: "GREEN" },
    { id: "S-19", x: 610,  y: 125, aspect: "GREEN" },
    { id: "S-20", x: 740,  y: 125, aspect: "GREEN" },
    { id: "S-21", x: 890,  y: 125, aspect: "GREEN" },

    // Middle Corridor Signals
    { id: "S-22", x: 250,  y: 190, aspect: "GREEN" },
    { id: "S-23", x: 320,  y: 190, aspect: "GREEN" },
    { id: "S-24", x: 420,  y: 190, aspect: "GREEN" },
    { id: "S-25", x: 500,  y: 190, aspect: "GREEN" },
    { id: "S-26", x: 610,  y: 190, aspect: "AMBER" },
    { id: "S-27", x: 700,  y: 190, aspect: "GREEN" },
    { id: "S-28", x: 800,  y: 190, aspect: "GREEN" },
    { id: "S-29", x: 950,  y: 190, aspect: "GREEN" },
    { id: "S-30", x: 1080, y: 190, aspect: "GREEN" },

    // Lower Radial Signals
    { id: "S-31", x: 150,  y: 275, aspect: "GREEN" },
    { id: "S-32", x: 260,  y: 275, aspect: "GREEN" },
    { id: "S-33", x: 370,  y: 275, aspect: "GREEN" },
    { id: "S-34", x: 480,  y: 275, aspect: "GREEN" },
    { id: "S-35", x: 530,  y: 275, aspect: "GREEN" },
  ], []);

  // Interlocking Switches & Junction Diamonds
  const switchDiamonds = useMemo(() => [
    { id: "SW-01", x: 280, y: 100 },
    { id: "SW-02", x: 320, y: 85 },
    { id: "SW-03", x: 320, y: 115 },
    { id: "SW-04", x: 440, y: 85 },
    { id: "SW-05", x: 500, y: 100 },
    { id: "SW-06", x: 650, y: 85 },
    { id: "SW-07", x: 710, y: 100 },
    { id: "SW-08", x: 820, y: 85 },
    { id: "SW-09", x: 880, y: 100 },
    { id: "SW-10", x: 280, y: 200 },
    { id: "SW-11", x: 350, y: 200 },
    { id: "SW-12", x: 530, y: 200 },
    { id: "SW-13", x: 740, y: 200 },
    { id: "SW-14", x: 550, y: 285 },
  ], []);

  // Block Section ID Markers
  const blockMarkers = useMemo(() => [
    { id: "ND-01", x: 100, y: 92 },
    { id: "NZM-01", x: 210, y: 92 },
    { id: "GZB-01", x: 250, y: 92 },
    { id: "GZB-02", x: 350, y: 77 },
    { id: "GZB-03", x: 400, y: 77 },
    { id: "MRT-01", x: 490, y: 77 },
    { id: "MRT-02", x: 580, y: 77 },
    { id: "MB-01",  x: 700, y: 77 },
    { id: "MB-02",  x: 770, y: 77 },
    { id: "BE-01",  x: 880, y: 77 },
    { id: "BE-02",  x: 980, y: 77 },
    { id: "SNP-01", x: 1090, y: 77 },

    { id: "ALJN-01", x: 350, y: 192 },
    { id: "TDL-01",  x: 520, y: 192 },
    { id: "CNB-01",  x: 840, y: 192 },
    { id: "LKO-01",  x: 1030, y: 192 },

    { id: "DBR-01",  x: 160, y: 277 },
    { id: "HPU-01",  x: 380, y: 277 },
    { id: "MRD-01",  x: 490, y: 277 },
  ], []);

  return (
    <div className="w-full bg-[#050811] border border-slate-800/90 rounded-sm flex flex-col relative overflow-hidden font-mono select-none">
      {/* ------------------------------------------------------------- */}
      {/* 1. TOP HEADER: LINE SELECTORS + DISPLAY CONTROLS              */}
      {/* ------------------------------------------------------------- */}
      <div className="h-10 bg-[#070b13] border-b border-slate-800/80 px-3 flex items-center justify-between z-20 shrink-0">
        {/* Line Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setSelectedLineId("ALL")}
            className={`px-2.5 py-1 text-[11px] font-bold rounded flex items-center gap-1.5 transition-colors ${
              selectedLineId === "ALL"
                ? "bg-cyan-950/80 text-cyan-300 border border-cyan-500/50 shadow-[0_0_8px_rgba(6,182,212,0.25)]"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-cyan-400" />
            <span>ALL LINES (5)</span>
          </button>

          {multiLineDefinitions.map((line) => {
            const isSelected = selectedLineId === line.id;
            return (
              <button
                key={line.id}
                onClick={() => setSelectedLineId(line.id)}
                className={`px-2 py-1 text-[11px] font-medium rounded flex items-center gap-1.5 transition-colors ${
                  isSelected
                    ? "bg-slate-800 text-white border border-slate-600 shadow-sm"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 border border-transparent"
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: line.color }}
                />
                <span>{line.shortName}</span>
              </button>
            );
          })}
        </div>

        {/* View & Tool Toggles */}
        <div className="flex items-center gap-3 text-[11px]">
          {/* Zoom Controller */}
          <div className="flex items-center gap-1 bg-slate-900/90 border border-slate-800 rounded px-1.5 py-0.5">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mr-1">ZOOM</span>
            <button
              onClick={handleZoomOut}
              className="w-4 h-4 text-slate-300 hover:text-white flex items-center justify-center font-bold"
            >
              −
            </button>
            <button
              onClick={handleZoomReset}
              className="px-1 text-[10px] text-cyan-400 font-bold"
            >
              {zoomLevel}%
            </button>
            <button
              onClick={handleZoomIn}
              className="w-4 h-4 text-slate-300 hover:text-white flex items-center justify-center font-bold"
            >
              +
            </button>
          </div>

          {/* Lookahead Horizons */}
          <div className="flex items-center gap-1 bg-slate-900/90 border border-slate-800 rounded p-0.5">
            {[300, 600, 900].map((horizon) => (
              <button
                key={horizon}
                onClick={() => onSetPredictionHorizon?.(horizon)}
                className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${
                  predictionHorizon === horizon
                    ? "bg-cyan-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {horizon}s
              </button>
            ))}
          </div>

          {/* Headway Toggle */}
          <button
            onClick={() => setShowHeadway(!showHeadway)}
            className={`px-2 py-0.5 text-[10px] font-bold rounded border transition-colors ${
              showHeadway
                ? "bg-indigo-950 text-indigo-300 border-indigo-500/50"
                : "bg-slate-900/90 text-slate-400 border-slate-800 hover:text-slate-200"
            }`}
          >
            ⊞ HEADWAY
          </button>

          {/* Signals Toggle */}
          <button
            onClick={() => setShowSignals(!showSignals)}
            className={`px-2 py-0.5 text-[10px] font-bold rounded border transition-colors ${
              showSignals
                ? "bg-emerald-950 text-emerald-300 border-emerald-500/50"
                : "bg-slate-900/90 text-slate-400 border-slate-800 hover:text-slate-200"
            }`}
          >
            ● SIGNALS
          </button>

          {/* Interlocking Zones Toggle */}
          <button
            onClick={() => setShowInterlockingZones(!showInterlockingZones)}
            className={`px-2 py-0.5 text-[10px] font-bold rounded border transition-colors ${
              showInterlockingZones
                ? "bg-purple-950 text-purple-300 border-purple-500/50"
                : "bg-slate-900/90 text-slate-400 border-slate-800 hover:text-slate-200"
            }`}
          >
            🔒 IXL ZONES
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. DISTANCE SCALE RULER (FULL 95% WIDTH)                      */}
      {/* ------------------------------------------------------------- */}
      <div className="h-6 bg-[#04060c] border-b border-slate-900/80 px-6 flex items-center justify-between text-[10px] text-slate-500 font-mono relative z-10">
        <div className="flex items-center gap-1 font-bold text-slate-400">
          <span>0 KM (NDLS)</span>
        </div>
        <div className="flex items-center gap-1">
          <span>50 KM</span>
        </div>
        <div className="flex items-center gap-1">
          <span>100 KM</span>
        </div>
        <div className="flex items-center gap-1">
          <span>150 KM</span>
        </div>
        <div className="flex items-center gap-1 font-bold text-slate-400">
          <span>200 KM (SNP)</span>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 3. DENSE PHYSICAL RAILWAY INFRASTRUCTURE SVG CANVAS           */}
      {/* ------------------------------------------------------------- */}
      <div
        ref={containerRef}
        className="w-full flex-1 min-h-[160px] relative overflow-hidden bg-[#02050c]"
      >
        <svg
          viewBox={dynamicViewBox}
          preserveAspectRatio="xMidYMid meet"
          className="w-full h-full"
          style={{
            transform: `scale(${zoomLevel / 100})`,
            transformOrigin: "center center",
            transition: "transform 0.2s ease-out",
          }}
        >
          <defs>
            {/* Background Grid Pattern */}
            <pattern id="subtleGrid" width="30" height="30" patternUnits="userSpaceOnUse">
              <path d="M 30 0 L 0 0 0 30" fill="none" stroke="#0b1120" strokeWidth="0.5" strokeDasharray="1,4" />
            </pattern>

            {/* Glowing Glow Filters */}
            <filter id="amberGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="0" stdDeviation="2.5" floodColor="#f59e0b" floodOpacity="0.7" />
            </filter>
            <filter id="cyanGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="0" stdDeviation="2.5" floodColor="#06b6d4" floodOpacity="0.7" />
            </filter>
            <filter id="greenGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="0" stdDeviation="2.5" floodColor="#10b981" floodOpacity="0.7" />
            </filter>
          </defs>

          {/* Grid Background */}
          <rect x="-2000" y="-1000" width="5000" height="3000" fill="url(#subtleGrid)" />

          {/* --------------------------------------------------------- */}
          {/* INTERLOCKING ZONES OVERLAY (IF ENABLED)                   */}
          {/* --------------------------------------------------------- */}
          {showInterlockingZones && (
            <g className="interlocking-zones">
              {Object.values(multiLineInterlockingZones).map((zone) => (
                <g key={zone.id}>
                  <rect
                    x={zone.bounds.x}
                    y={zone.bounds.y}
                    width={zone.bounds.width}
                    height={zone.bounds.height}
                    fill="#a855f7"
                    fillOpacity="0.04"
                    stroke="#a855f7"
                    strokeWidth="1"
                    strokeDasharray="3,3"
                    rx="4"
                  />
                  <text
                    x={zone.bounds.x + 8}
                    y={zone.bounds.y + 14}
                    fill="#c084fc"
                    fontSize="9"
                    fontWeight="bold"
                  >
                    ┌ {zone.name} ({zone.silLevel}) ┐
                  </text>
                </g>
              ))}
            </g>
          )}

          {/* --------------------------------------------------------- */}
          {/* PHYSICAL BALLAST TRACK BEDS (DARK SLEEPER UNDERLAY)       */}
          {/* --------------------------------------------------------- */}
          <g className="ballast-beds" stroke="#0f172a" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none">
            {/* Main Corridor: Track 1 (Up) & Track 2 (Down) */}
            <path d="M 30 100 L 280 100 L 320 85 L 1170 85" />
            <path d="M 30 106 L 280 106 L 320 91 L 1170 91" />

            {/* Main Corridor: Track 3 (Loop / Passing) & Track 4 (Freight Siding) */}
            <path d="M 280 100 L 320 115 L 1170 115" />
            <path d="M 320 121 L 1170 121" />

            {/* Main Crossovers */}
            <path d="M 480 85 L 530 115" />
            <path d="M 530 85 L 480 115" />
            <path d="M 680 85 L 730 115" />
            <path d="M 730 85 L 680 115" />
            <path d="M 860 85 L 900 115" />
            <path d="M 900 85 L 860 115" />
            <path d="M 1040 85 L 1080 115" />

            {/* Middle Corridor Line B: Dual Tracks (GZB -> ALJN -> TDL -> CNB -> LKO) */}
            <path d="M 280 100 L 330 200 L 1170 200" />
            <path d="M 330 206 L 1170 206" />
            <path d="M 440 216 L 760 216" />

            {/* Middle Corridor Crossovers */}
            <path d="M 510 200 L 560 115" />
            <path d="M 720 200 L 770 115" />
            <path d="M 920 200 L 960 115" />

            {/* Lower Radial Corridor Line C & D: (DBR -> PKA -> HPU -> MNR -> MRD -> GZB) */}
            <path d="M 60 285 L 580 285" />
            <path d="M 60 291 L 580 291" />
            <path d="M 550 285 L 590 200" />
            <path d="M 60 285 L 120 200" />
            <path d="M 30 100 L 90 285" />

            {/* Cross-Link Line D (ALJN -> MRT) */}
            <path d="M 280 200 L 320 85" />
          </g>

          {/* --------------------------------------------------------- */}
          {/* ILLUMINATED DUAL RAILS (DATA-DRIVEN STATUS OVERLAYS)      */}
          {/* --------------------------------------------------------- */}
          <g className="steel-rails" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none">
            {/* Line A (Amber - NDLS to SNP Primary Track 1) */}
            <path
              d="M 30 100 L 280 100 L 320 85 L 1170 85"
              stroke="#f59e0b"
              filter="url(#amberGlow)"
              opacity={selectedLineId === "ALL" || selectedLineId === "LINE-A" ? 1 : 0.2}
            />
            {/* Line A Track 2 (Down Track) */}
            <path
              d="M 30 106 L 280 106 L 320 91 L 1170 91"
              stroke="#f59e0b"
              opacity={selectedLineId === "ALL" || selectedLineId === "LINE-A" ? 0.85 : 0.15}
            />
            {/* Line A Track 3 & 4 (Passing Loops & Sidings) */}
            <path
              d="M 280 100 L 320 115 L 1170 115"
              stroke="#f59e0b"
              strokeDasharray="6,2"
              opacity={selectedLineId === "ALL" || selectedLineId === "LINE-A" ? 0.75 : 0.15}
            />
            <path
              d="M 320 121 L 1170 121"
              stroke="#f59e0b"
              strokeDasharray="4,3"
              opacity={selectedLineId === "ALL" || selectedLineId === "LINE-A" ? 0.6 : 0.1}
            />

            {/* Crossovers on Line A */}
            <path d="M 480 85 L 530 115" stroke="#f59e0b" opacity={selectedLineId === "ALL" || selectedLineId === "LINE-A" ? 0.8 : 0.15} />
            <path d="M 530 85 L 480 115" stroke="#f59e0b" opacity={selectedLineId === "ALL" || selectedLineId === "LINE-A" ? 0.8 : 0.15} />
            <path d="M 680 85 L 730 115" stroke="#f59e0b" opacity={selectedLineId === "ALL" || selectedLineId === "LINE-A" ? 0.8 : 0.15} />
            <path d="M 730 85 L 680 115" stroke="#f59e0b" opacity={selectedLineId === "ALL" || selectedLineId === "LINE-A" ? 0.8 : 0.15} />
            <path d="M 860 85 L 900 115" stroke="#f59e0b" opacity={selectedLineId === "ALL" || selectedLineId === "LINE-A" ? 0.8 : 0.15} />
            <path d="M 900 85 L 860 115" stroke="#f59e0b" opacity={selectedLineId === "ALL" || selectedLineId === "LINE-A" ? 0.8 : 0.15} />
            <path d="M 1040 85 L 1080 115" stroke="#f59e0b" opacity={selectedLineId === "ALL" || selectedLineId === "LINE-A" ? 0.8 : 0.15} />

            {/* Line B (Cyan - GZB to LKO Dual Trunk Tracks) */}
            <path
              d="M 280 100 L 330 200 L 1170 200"
              stroke="#06b6d4"
              filter="url(#cyanGlow)"
              opacity={selectedLineId === "ALL" || selectedLineId === "LINE-B" ? 1 : 0.2}
            />
            <path
              d="M 330 206 L 1170 206"
              stroke="#06b6d4"
              opacity={selectedLineId === "ALL" || selectedLineId === "LINE-B" ? 0.85 : 0.15}
            />
            <path
              d="M 440 216 L 760 216"
              stroke="#06b6d4"
              strokeDasharray="5,2"
              opacity={selectedLineId === "ALL" || selectedLineId === "LINE-B" ? 0.65 : 0.1}
            />

            {/* Line B Cross-corridor Links */}
            <path d="M 510 200 L 560 115" stroke="#06b6d4" opacity={selectedLineId === "ALL" || selectedLineId === "LINE-B" ? 0.8 : 0.15} />
            <path d="M 720 200 L 770 115" stroke="#06b6d4" opacity={selectedLineId === "ALL" || selectedLineId === "LINE-B" ? 0.8 : 0.15} />
            <path d="M 920 200 L 960 115" stroke="#06b6d4" opacity={selectedLineId === "ALL" || selectedLineId === "LINE-B" ? 0.8 : 0.15} />

            {/* Line C (Green - DBR to MRD Radial Loop) */}
            <path
              d="M 60 285 L 580 285"
              stroke="#10b981"
              filter="url(#greenGlow)"
              opacity={selectedLineId === "ALL" || selectedLineId === "LINE-C" ? 1 : 0.2}
            />
            <path
              d="M 60 291 L 580 291"
              stroke="#10b981"
              opacity={selectedLineId === "ALL" || selectedLineId === "LINE-C" ? 0.8 : 0.15}
            />
            <path d="M 550 285 L 590 200" stroke="#10b981" opacity={selectedLineId === "ALL" || selectedLineId === "LINE-C" ? 0.8 : 0.15} />

            {/* Line D (Purple Cross-link ALJN -> MRT) */}
            <path
              d="M 280 200 L 320 85"
              stroke="#8b5cf6"
              strokeDasharray="4,2"
              opacity={selectedLineId === "ALL" || selectedLineId === "LINE-D" ? 0.9 : 0.15}
            />

            {/* Line E (Magenta Radial link DBR -> NDLS) */}
            <path
              d="M 30 100 L 90 285"
              stroke="#ec4899"
              opacity={selectedLineId === "ALL" || selectedLineId === "LINE-E" ? 0.9 : 0.15}
            />
          </g>

          {/* --------------------------------------------------------- */}
          {/* BLOCK SECTION BOUNDARY TICKS & LABELS                     */}
          {/* --------------------------------------------------------- */}
          <g className="block-boundaries">
            {blockMarkers.map((blk) => (
              <g key={blk.id} transform={`translate(${blk.x}, ${blk.y})`}>
                <line x1="0" y1="-4" x2="0" y2="4" stroke="#475569" strokeWidth="1" />
                <text x="0" y="-6" fill="#64748b" fontSize="6.5" textAnchor="middle" fontWeight="bold">
                  {blk.id}
                </text>
              </g>
            ))}
          </g>

          {/* --------------------------------------------------------- */}
          {/* INTERLOCKING SWITCH DIAMOND MARKERS                       */}
          {/* --------------------------------------------------------- */}
          <g className="switches">
            {Object.values(multiLineSwitches).map((sw) => (
              <g key={sw.id} transform={`translate(${sw.coordinates.x}, ${sw.coordinates.y})`}>
                <polygon points="0,-3.5 3.5,0 0,3.5 -3.5,0" fill="#38bdf8" stroke="#0284c7" strokeWidth="0.8" />
              </g>
            ))}
          </g>

          {/* --------------------------------------------------------- */}
          {/* WAYSIDE SIGNAL HEADS (IF SIGNALS ENABLED)                 */}
          {/* --------------------------------------------------------- */}
          {showSignals && (
            <g className="wayside-signals">
              {waysideSignals.map((sig) => (
                <g key={sig.id} transform={`translate(${sig.x}, ${sig.y})`}>
                  <rect x="-2.5" y="-2.5" width="5" height="5" rx="1" fill="#020617" stroke="#334155" strokeWidth="0.5" />
                  <circle
                    cx="0"
                    cy="0"
                    r="1.8"
                    fill={sig.aspect === "GREEN" ? "#22c55e" : sig.aspect === "AMBER" ? "#eab308" : "#ef4444"}
                    filter={sig.aspect === "GREEN" ? "url(#greenGlow)" : undefined}
                  />
                </g>
              ))}
            </g>
          )}

          {/* --------------------------------------------------------- */}
          {/* STATIONS, PLATFORM TRACKS & LABELS (16 STATIONS)          */}
          {/* --------------------------------------------------------- */}
          <g className="stations">
            {Object.entries(stationNodes).map(([stKey, pos]) => {
              const node = multiLineStations[stKey] || {
                id: stKey,
                name: pos.name,
                code: pos.code,
                kmPosition: pos.km,
                platforms: pos.platforms,
              };

              const isInspected = inspectedStation?.id === stKey;
              const isTop = pos.labelY === "top";

              return (
                <g
                  key={stKey}
                  className="cursor-pointer group"
                  onClick={() => setInspectedStation(node as StationTopologyNode)}
                >
                  {/* Station Platform Track Shape */}
                  <rect
                    x={pos.x - 14}
                    y={pos.y + (isTop ? 8 : -11)}
                    width="28"
                    height="3.5"
                    rx="1"
                    fill="#334155"
                    stroke="#475569"
                    strokeWidth="0.5"
                    className="group-hover:fill-cyan-400 group-hover:stroke-cyan-300 transition-colors"
                  />

                  {/* Main Station Dot Marker */}
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r={isInspected ? 5.5 : 4}
                    fill={isInspected ? "#38bdf8" : "#020617"}
                    stroke={isInspected ? "#ffffff" : "#cbd5e1"}
                    strokeWidth="1.5"
                    className="group-hover:stroke-cyan-300 transition-colors"
                  />
                  <circle cx={pos.x} cy={pos.y} r="1.5" fill="#ffffff" />

                  {/* Station Info Card Text */}
                  <g transform={`translate(${pos.x}, ${isTop ? pos.y - 12 : pos.y + 22})`}>
                    {/* Station Code */}
                    <text
                      x="0"
                      y={isTop ? -18 : 0}
                      textAnchor="middle"
                      fill="#ffffff"
                      fontSize="10"
                      fontWeight="bold"
                      letterSpacing="0.5"
                    >
                      {pos.code}
                    </text>

                    {/* Station Full Name */}
                    <text
                      x="0"
                      y={isTop ? -8 : 10}
                      textAnchor="middle"
                      fill="#94a3b8"
                      fontSize="8.5"
                      fontWeight="normal"
                    >
                      {pos.name}
                    </text>

                    {/* KM & Platform Subtitle */}
                    <text
                      x="0"
                      y={isTop ? 2 : 20}
                      textAnchor="middle"
                      fill="#64748b"
                      fontSize="7.5"
                      fontWeight="medium"
                    >
                      {pos.km} km • {pos.platforms} Plt
                    </text>
                  </g>
                </g>
              );
            })}
          </g>

          {/* --------------------------------------------------------- */}
          {/* ACTIVE TRAINS (6 LIVE TRAIN HUD MARKERS)                  */}
          {/* --------------------------------------------------------- */}
          <g className="trains z-30">
            {displayTrains.map(({ train, x, y, angle, hudOffsetX, hudOffsetY, hasCollisionOffset }) => {
              const isSelected = effectiveSelectedTrainId === train.id;
              const visual = getTrainVisualState(train, { isSelected });

              return (
                <g
                  key={train.id}
                  transform={`translate(${x}, ${y})`}
                  className="cursor-pointer"
                  onClick={() => onSelectTrain?.(train)}
                >
                  {/* Pulsing Beacon on Real Track Position */}
                  <circle
                    cx="0"
                    cy="0"
                    r={isSelected ? "11" : "7"}
                    fill={visual.badgeBorder}
                    fillOpacity="0.3"
                    className={visual.isPulsing ? "animate-pulse" : ""}
                  />
                  <circle
                    cx="0"
                    cy="0"
                    r="3.5"
                    fill={visual.badgeBorder}
                    stroke="#ffffff"
                    strokeWidth="1"
                  />

                  {/* Direction Heading Indicator */}
                  <g transform={`rotate(${angle || 0})`}>
                    <polygon
                      points="6,0 1.5,-2.5 1.5,2.5"
                      fill="#ffffff"
                      stroke={visual.badgeBorder}
                      strokeWidth="0.5"
                    />
                  </g>

                  {/* Leader Line for Cascaded Offsets */}
                  {hasCollisionOffset && (
                    <line
                      x1="0"
                      y1="0"
                      x2={hudOffsetX}
                      y2={hudOffsetY + 12}
                      stroke="#00B4D8"
                      strokeWidth="0.8"
                      strokeDasharray="2,2"
                      opacity="0.8"
                    />
                  )}

                  {/* Anti-Collision Train HUD Box */}
                  <g transform={`translate(${hudOffsetX}, ${hudOffsetY})`}>
                    <rect
                      x="0"
                      y="0"
                      width="80"
                      height="25"
                      rx="3"
                      fill={visual.badgeBg}
                      fillOpacity="0.95"
                      stroke={visual.badgeBorder}
                      strokeWidth={isSelected ? "1.5" : "1"}
                      filter="drop-shadow(0 2px 4px rgba(0,0,0,0.6))"
                    />

                    {/* Top Row: Train ID & Priority */}
                    <text x="5" y="10" fill="#ffffff" fontSize="8" fontWeight="bold">
                      {train.id}
                    </text>
                    <text x="75" y="10" textAnchor="end" fill="#cbd5e1" fontSize="7" fontWeight="bold">
                      P{train.priority}
                    </text>

                    {/* Bottom Row: Speed & Clean Short Status (Separated Left/Right) */}
                    <text x="5" y="20" fill="#94a3b8" fontSize="7">
                      {Math.round(train.speed)} <tspan dx="1.5" fontSize="5.5">km/h</tspan>
                    </text>
                    <text
                      x="75"
                      y="20"
                      textAnchor="end"
                      fill={visual.dotColor}
                      fontSize="6.5"
                      fontWeight="bold"
                    >
                      {visual.shortStatusText || visual.statusText}
                    </text>
                  </g>
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 4. COMPACT RAILWAY LEGEND BAR                                 */}
      {/* ------------------------------------------------------------- */}
      <div className="h-7 bg-[#0B0E11] border-t border-slate-800/80 px-4 flex items-center justify-between text-[10px] text-slate-400 font-mono">
        <div className="flex items-center gap-4">
          <span className="font-bold text-slate-300 uppercase tracking-wider">LEGEND:</span>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: "var(--signal-green, #10B981)" }} />
            <span>Clear</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: "var(--signal-green-dark, #059669)" }} />
            <span>Proceed</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: "var(--signal-amber, #F59E0B)" }} />
            <span>Caution</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: "var(--signal-red, #EF4444)" }} />
            <span>Stop</span>
          </div>
          <div className="flex items-center gap-1.5 ml-2">
            <span className="w-3.5 h-1.5 rounded" style={{ backgroundColor: "var(--signal-amber, #F59E0B)" }} />
            <span>Occupied</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-1.5 rounded" style={{ backgroundColor: "var(--signal-red-dark, #DC2626)" }} />
            <span>Blocked</span>
          </div>
          <div className="flex items-center gap-1.5 ml-2">
            <svg width="8" height="8" viewBox="-4 -4 8 8" className="inline-block">
              <polygon points="0,-3 3,0 0,3 -3,0" fill="var(--ai-accent, #00B4D8)" />
            </svg>
            <span>Switch</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-slate-400" />
            <span>Station</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-1 rounded bg-slate-500" />
            <span>Platform</span>
          </div>
          <div className="flex items-center gap-1.5 ml-2">
            <span className="px-1 py-0.5 border border-dashed border-purple-500 text-[8px] text-purple-300 rounded" style={{ borderColor: "var(--signal-purple, #8B5CF6)", color: "var(--signal-purple, #8B5CF6)" }}>
              [ ]
            </span>
            <span>Interlocking Zone Boundary</span>
          </div>
        </div>

        {/* Live Network Safety Micro-Badge */}
        <div className="flex items-center gap-3">
          <span className="text-slate-500">CORRIDOR: NDLS ↔ SNP (186 km)</span>
          <span className="text-emerald-400 font-bold">SIL-4 ABSOLUTE BLOCK INTERLOCKING</span>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 5. STATION INSPECTION MODAL (IF CLICKED)                      */}
      {/* ------------------------------------------------------------- */}
      {inspectedStation && (
        <div className="absolute top-12 right-4 z-40 w-80 bg-slate-900/95 border border-cyan-500/50 rounded shadow-2xl p-3.5 backdrop-blur font-mono text-slate-200">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2.5">
            <div className="flex items-center gap-2">
              <span className="px-1.5 py-0.5 bg-cyan-950 text-cyan-300 border border-cyan-600 rounded text-xs font-bold">
                {inspectedStation.code}
              </span>
              <span className="font-bold text-sm text-white">{inspectedStation.name}</span>
            </div>
            <button
              onClick={() => setInspectedStation(null)}
              className="text-slate-400 hover:text-white text-xs font-bold px-1"
            >
              ✕
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px] mb-3">
            <div className="bg-slate-950/60 p-2 rounded border border-slate-800">
              <div className="text-slate-500 text-[9px] uppercase">Kilometer Mark</div>
              <div className="font-bold text-cyan-400">{inspectedStation.kmPosition} KM</div>
            </div>
            <div className="bg-slate-950/60 p-2 rounded border border-slate-800">
              <div className="text-slate-500 text-[9px] uppercase">Platforms</div>
              <div className="font-bold text-white">{inspectedStation.platforms} Tracks</div>
            </div>
            <div className="bg-slate-950/60 p-2 rounded border border-slate-800">
              <div className="text-slate-500 text-[9px] uppercase">Junction Interlock</div>
              <div className="font-bold text-emerald-400">{inspectedStation.isJunction ? "ACTIVE (SIL-4)" : "STANDARD"}</div>
            </div>
            <div className="bg-slate-950/60 p-2 rounded border border-slate-800">
              <div className="text-slate-500 text-[9px] uppercase">Lines Connected</div>
              <div className="font-bold text-purple-300">{inspectedStation.connectedLineIds?.length || 1} Corridors</div>
            </div>
          </div>

          <button
            onClick={() => setInspectedStation(null)}
            className="w-full py-1 bg-slate-800 hover:bg-slate-700 text-xs font-bold text-cyan-300 rounded border border-slate-700 transition-colors"
          >
            CLOSE TELEMETRY
          </button>
        </div>
      )}
    </div>
  );
});
