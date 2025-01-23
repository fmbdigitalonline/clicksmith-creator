interface PerformanceMetric {
  operation: string;
  duration: number;
  success: boolean;
  timestamp: string;
}

class PerformanceMonitor {
  private static metrics: PerformanceMetric[] = [];
  private static readonly MAX_METRICS = 100;

  static trackOperation(operation: string, startTime: number, success: boolean) {
    const duration = Date.now() - startTime;
    const metric: PerformanceMetric = {
      operation,
      duration,
      success,
      timestamp: new Date().toISOString()
    };

    this.metrics.push(metric);
    if (this.metrics.length > this.MAX_METRICS) {
      this.metrics.shift();
    }

    // Log slow operations
    if (duration > 1000) {
      console.warn(`[Performance] Slow operation detected: ${operation} took ${duration}ms`);
    }

    // In production, we would send metrics to monitoring service
    if (process.env.NODE_ENV === 'production') {
      console.info('[Metrics]', metric);
    }
  }

  static getMetrics() {
    return [...this.metrics];
  }
}

export const monitor = {
  start: (operation: string) => {
    const startTime = Date.now();
    return {
      end: (success: boolean = true) => {
        PerformanceMonitor.trackOperation(operation, startTime, success);
      }
    };
  }
};