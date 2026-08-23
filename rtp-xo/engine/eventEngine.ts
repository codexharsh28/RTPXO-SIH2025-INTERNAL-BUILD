/**
 * RTPXO - Operational Event Engine
 * Emits and buffers timestamped operational events from authoritative simulation state transitions.
 */

import { OperationalEvent, OperationalEventType, EventSeverity } from "@/types/events";

export class EventEngine {
  private events: OperationalEvent[] = [];
  private maxEventHistory: number = 100;
  private idCounter: number = 1;

  public reset(): void {
    this.events = [];
    this.idCounter = 1;
  }

  public emitEvent(
    type: OperationalEventType,
    message: string,
    timestamp: number,
    severity: EventSeverity = "INFO",
    entityId?: string,
    entityType?: "TRAIN" | "SECTION" | "SIGNAL" | "CONFLICT" | "ADVISOR" | "INCIDENT",
    metadata?: Record<string, any>
  ): OperationalEvent {
    const hours = Math.floor(timestamp / 3600);
    const minutes = Math.floor((timestamp % 3600) / 60);
    const seconds = Math.floor(timestamp % 60);
    const formattedTime = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

    const event: OperationalEvent = {
      id: `EVT-${this.idCounter++}`,
      type,
      timestamp,
      formattedTime,
      message,
      severity,
      entityId,
      entityType,
      metadata,
    };

    this.events.unshift(event);
    if (this.events.length > this.maxEventHistory) {
      this.events.pop();
    }

    return event;
  }

  public getRecentEvents(limit: number = 50): OperationalEvent[] {
    return this.events.slice(0, limit);
  }

  public getAllEvents(): OperationalEvent[] {
    return [...this.events];
  }
}

export const eventEngine = new EventEngine();
