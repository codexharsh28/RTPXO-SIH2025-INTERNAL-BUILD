/**
 * RTPXO - Operational Scenarios Domain Models
 * Defines deterministic operational situation templates for simulation and validation.
 */

import { Train } from "./railway";
import { SimulationConfig } from "./simulation";

export type ScenarioCategory =
  | "NOMINAL"
  | "DISRUPTION"
  | "CONVERGENCE"
  | "SATURATION"
  | "RESTRICTION"
  | "RECOVERY";

export interface ScenarioDefinition {
  id: string;
  name: string;
  category: ScenarioCategory;
  description: string;
  targetObjective: string;
  expectedBehavior: string;
  trains: Train[];
  config?: Partial<SimulationConfig>;
}
