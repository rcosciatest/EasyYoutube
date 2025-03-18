/**
 * Simple telemetry for tracking performance and errors
 */
export class RecorderTelemetry {
  private static events: Array<{
    timestamp: number;
    event: string;
    data?: any;
  }> = [];
  
  public static recordEvent(event: string, data?: any): void {
    this.events.push({
      timestamp: Date.now(),
      event,
      data
    });
    
    // Optional: Log events to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Telemetry] ${event}`, data);
    }
  }
  
  public static getEventsSince(timestamp: number): any[] {
    return this.events.filter(e => e.timestamp >= timestamp);
  }
  
  public static exportLog(): string {
    return JSON.stringify(this.events, null, 2);
  }
  
  public static clear(): void {
    this.events = [];
  }
} 