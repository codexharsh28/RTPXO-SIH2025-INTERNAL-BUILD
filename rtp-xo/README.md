# RTPXO — Real-Time Proactive Execution Optimizer
> High-Density Railway Network Traffic, Moving-Block Throughput & Conflict Optimization Command Center.

## 👤 Created By
**Team TVARIT**  
Built end-to-end — architecture, engine logic, UI/UX, and verification suite.  
*Smart India Hackathon (SIH 2026)*

---

## 🚆 Overview

**RTPXO** (Real-Time Proactive Execution Optimizer) is an advanced railway Centralized Traffic Control (CTC) dispatch and optimization system. It pairs micro-simulation kinematics with multi-objective AI optimization and SIL-4 safety barriers to maximize corridor throughput, resolve headway and junction convergence conflicts, and coordinate automated recovery during operational disruptions.

### Core Capabilities

- **Single Source of Truth (`SimulationEngine`)**: Unified, deterministic execution state ensuring 100% data consistency across all telemetry feeds, charts, and spatial maps.
- **Predictive Conflict Resolution (`ConflictEngine` + `PredictionEngine`)**: Proactive forward lookahead (300s / 600s / 900s) detecting headway compression, station approach bottlenecks, and junction convergence before delays materialize.
- **Explainable Multi-Objective AI (`OptimizationEngine` + `ObjectiveEvaluator`)**: Transparent, 7-point decision rationale evaluating throughput gain, schedule delay recovery, bottleneck relief, and energy losses.
- **Coordinated Multi-Train Strategies (`StrategySynthesisEngine`)**: Synchronized corridor-level dispatches regulating speeds and holds across multiple trains simultaneously.
- **Incident & Disruption Recovery (`RecoveryPlanEngine` + `AdaptiveDecisionEngine`)**: Staged multi-phase incident containment with causal attribution and verified closed-loop learning.
- **Exception-Based CTC Interface**: High-contrast, dark-mode railway dispatch console with alarm acknowledgment workflows, safety barrier constraints, and collision-free spatial track visualization.

---

## 🛠️ Tech Stack & Architecture

- **Frontend**: Next.js 16 (Turbopack), React 19, TypeScript, Vanilla Tailwind CSS tokens.
- **Kinematic & Safety Engines**:
  - `simulationEngine.ts` — Authoritative master simulation state & clock.
  - `conflictEngine.ts` — Real-time spatial separation & headway violation detection.
  - `signalEngine.ts` — 4-aspect absolute block signaling with track circuit boundary propagation.
  - `predictionEngine.ts` — Non-mutating forward kinematics simulation.
  - `optimizationEngine.ts` — Candidate action tree search & Pareto evaluation.
  - `objectiveEvaluator.ts` — Deterministic multi-objective scoring model.
  - `strategySynthesisEngine.ts` — Multi-train coordinated strategy generator.
  - `recoveryPlanEngine.ts` — Incident containment & phased disruption recovery.
  - `adaptiveDecisionEngine.ts` — Empirical policy learning & causal outcome attribution.
- **Verification Suite**: 100% passing automated test harness (`verifyDataConsistency.ts`, `verifyPhase2.ts` through `verifyPhase10Step5_3.ts`).

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ (Node.js 20+ recommended)
- npm or yarn

### Installation & Run

```bash
# Clone the repository
git clone <repository-url>
cd rtp-xo

# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to access the live RTPXO Command Center.

### Run Verification Suites

```bash
# Master Data Integrity & Consistency Test Suite (24+ tests)
npx tsx engine/verifyDataConsistency.ts

# Phase 10 Disruption Recovery & Attribution Suite (26 tests)
npx tsx engine/verifyPhase10Step5_3.ts

# Full Production Build Check
npm run build
```

---

## 📄 License & Attribution

Designed and developed by **Team TVARIT** for **Smart India Hackathon 2026**.
All rights reserved.
