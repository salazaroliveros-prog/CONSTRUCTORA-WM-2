/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Logging and observability utilities for the ERP application.
 * Provides structured logging, analytics event tracking, and error reporting.
 */

/**
 * Log levels for structured logging.
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Analytics event categories for tracking user interactions.
 */
export type AnalyticsCategory =
  | 'navigation'
  | 'action'
  | 'form'
  | 'export'
  | 'auth'
  | 'error'
  | 'crud'
  | 'search'
  | 'filter'
  | 'performance';

/**
 * Interface for an analytics event.
 */
export interface AnalyticsEvent {
  category: AnalyticsCategory;
  action: string;
  label?: string;
  value?: number;
  metadata?: Record<string, unknown>;
  timestamp: number;
  userId?: string;
}

/**
 * Simple in-memory event buffer for analytics events.
 * Events are batched and can be flushed to an external service.
 */
class AnalyticsBuffer {
  private events: AnalyticsEvent[] = [];
  private readonly maxBufferSize: number;
  private flushCallback?: (events: AnalyticsEvent[]) => void;

  constructor(maxBufferSize: number = 100) {
    this.maxBufferSize = maxBufferSize;
  }

  /**
   * Register a flush callback to send events to an external service.
   */
  onFlush(callback: (events: AnalyticsEvent[]) => void): void {
    this.flushCallback = callback;
  }

  /**
   * Add an event to the buffer. Auto-flushes when buffer is full.
   */
  push(event: AnalyticsEvent): void {
    this.events.push(event);
    if (this.events.length >= this.maxBufferSize) {
      this.flush();
    }
  }

  /**
   * Flush all buffered events through the callback.
   */
  flush(): void {
    if (this.events.length === 0) return;
    const batch = [...this.events];
    this.events = [];
    if (this.flushCallback) {
      this.flushCallback(batch);
    } else {
      // Default: log to console in development
      if (import.meta.env.DEV) {
        console.groupCollapsed(`📊 Analytics (${batch.length} events)`);
        batch.forEach(e => console.log(`[${e.category}] ${e.action}`, e.metadata || ''));
        console.groupEnd();
      }
    }
  }

  /**
   * Clear all buffered events without flushing.
   */
  clear(): void {
    this.events = [];
  }

  /**
   * Get the current number of buffered events.
   */
  get size(): number {
    return this.events.length;
  }
}

// Global analytics buffer instance
const analyticsBuffer = new AnalyticsBuffer(50);

// Auto-flush every 30 seconds in production
if (typeof window !== 'undefined') {
  setInterval(() => analyticsBuffer.flush(), 30000);
}

/**
 * Creates an analytics event and adds it to the buffer.
 */
export function trackEvent(
  category: AnalyticsCategory,
  action: string,
  options?: {
    label?: string;
    value?: number;
    metadata?: Record<string, unknown>;
    userId?: string;
  }
): void {
  const event: AnalyticsEvent = {
    category,
    action,
    label: options?.label,
    value: options?.value,
    metadata: options?.metadata,
    timestamp: Date.now(),
    userId: options?.userId,
  };
  analyticsBuffer.push(event);
}

/**
 * Convenience function for tracking navigation events.
 */
export function trackNavigation(to: string, from?: string): void {
  trackEvent('navigation', 'navigate', {
    label: to,
    metadata: { from },
  });
}

/**
 * Convenience function for tracking CRUD operations.
 */
export function trackCRUD(operation: 'create' | 'read' | 'update' | 'delete', entity: string, entityId?: string): void {
  trackEvent('crud', operation, {
    label: entity,
    value: entityId ? 1 : 0,
    metadata: { entity, entityId },
  });
}

/**
 * Convenience function for tracking export actions.
 */
export function trackExport(format: 'pdf' | 'csv' | 'excel', entity: string): void {
  trackEvent('export', `export_${format}`, {
    label: entity,
  });
}

/**
 * Convenience function for tracking form submissions.
 */
export function trackForm(action: string, formName: string, success: boolean): void {
  trackEvent('form', action, {
    label: formName,
    value: success ? 1 : 0,
    metadata: { success },
  });
}

/**
 * Structured logger with level support.
 */
export function log(
  level: LogLevel,
  message: string,
  context?: Record<string, unknown>
): void {
  const timestamp = new Date().toISOString();
  const contextStr = context ? JSON.stringify(context) : '';

  switch (level) {
    case 'debug':
      if (import.meta.env.DEV) {
        console.debug(`[DEBUG] ${timestamp} - ${message}`, contextStr);
      }
      break;
    case 'info':
      console.info(`[INFO] ${timestamp} - ${message}`, contextStr);
      break;
    case 'warn':
      console.warn(`[WARN] ${timestamp} - ${message}`, contextStr);
      break;
    case 'error':
      console.error(`[ERROR] ${timestamp} - ${message}`, contextStr);
      trackEvent('error', message, {
        metadata: { context, timestamp },
      });
      break;
  }
}

/**
 * Shortcut for debug logging (only in development mode).
 */
export function debugLog(message: string, context?: Record<string, unknown>): void {
  log('debug', message, context);
}

/**
 * Shortcut for error logging with automatic analytics tracking.
 */
export function errorLog(message: string, error?: unknown, context?: Record<string, unknown>): void {
  log('error', message, {
    ...context,
    errorMessage: error instanceof Error ? error.message : String(error),
    errorStack: error instanceof Error ? error.stack : undefined,
  });
}

/**
 * Measures the duration of an async operation and logs it.
 * Useful for performance monitoring.
 */
export async function measureAsync<T>(
  operation: string,
  fn: () => Promise<T>,
  thresholdMs: number = 1000
): Promise<T> {
  const start = performance.now();
  try {
    const result = await fn();
    const duration = performance.now() - start;
    if (duration > thresholdMs) {
      log('warn', `Slow operation: ${operation} took ${duration.toFixed(0)}ms`);
    }
    trackEvent('performance', operation, {
      value: Math.round(duration),
    });
    return result;
  } catch (error) {
    const duration = performance.now() - start;
    errorLog(`Failed operation: ${operation}`, error, { durationMs: duration });
    throw error;
  }
}

// Export the buffer for advanced usage (e.g., manual flush in tests)
export { analyticsBuffer };