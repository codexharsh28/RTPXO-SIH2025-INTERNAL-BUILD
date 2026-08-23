/**
 * RTPXO - Operational Events Domain Models
 * Defines all structured event contracts emitted by the authoritative SimulationEngine.
 */

export type OperationalEventType =
  | "TRAIN_DELAY"
  | "TRAIN_STOP"
  | "TRAIN_RESUME"
  | "SECTION_ENTER"
  | "SECTION_EXIT"
  | "SIGNAL_CHANGE"
  | "CONFLICT_DETECTED"
  | "CONFLICT_CLEARED"
  | "BOTTLENECK_DETECTED"
  | "RECOMMENDATION_CREATED"
  | "RECOMMENDATION_APPLIED"
  | "TRAIN_COMPLETED"
  | "INCIDENT_DECLARED"
  | "INCIDENT_CLEARED";

export type EventSeverity = "INFO" | "WARNING" | "CRITICAL" | "SUCCESS";

export interface OperationalEvent {
  id: string;
  type: OperationalEventType;
  timestamp: number; // Simulation time in seconds
  formattedTime: string; // "HH:MM:SS"
  message: string;
  severity: EventSeverity;
  entityId?: string; // Train ID, Section ID, Signal ID, etc.
  entityType?: "TRAIN" | "SECTION" | "SIGNAL" | "CONFLICT" | "ADVISOR" | "INCIDENT";
  metadata?: Record<string, any>;
}
