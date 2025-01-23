type LogLevel = 'info' | 'warn' | 'error' | 'debug' | 'performance';
type LogContext = {
  userId?: string;
  component?: string;
  action?: string;
  duration?: number;
  error?: any;
};

class Logger {
  private static instance: Logger;
  private isProd = import.meta.env.PROD;

  private constructor() {}

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private formatMessage(level: LogLevel, context: LogContext, message: string): string {
    const timestamp = new Date().toISOString();
    const component = context.component ? `[${context.component}]` : '';
    const action = context.action ? `(${context.action})` : '';
    const duration = context.duration ? `${context.duration}ms` : '';
    return `${timestamp} - ${level}: ${component}${action} ${message} ${duration}`.trim();
  }

  info(message: string, context: LogContext = {}) {
    console.log(this.formatMessage('info', context, message));
  }

  warn(message: string, context: LogContext = {}) {
    console.warn(this.formatMessage('warn', context, message));
  }

  error(message: string, context: LogContext = {}) {
    console.error(this.formatMessage('error', context, message));
    if (context.error) {
      console.error('Error details:', context.error);
    }
  }

  debug(message: string, context: LogContext = {}) {
    if (!this.isProd) {
      console.debug(this.formatMessage('debug', context, message));
    }
  }

  performance(message: string, context: LogContext = {}) {
    console.log(this.formatMessage('performance', context, message));
  }

  // Utility method for measuring performance
  async measure<T>(
    component: string,
    action: string,
    operation: () => Promise<T>
  ): Promise<T> {
    const start = performance.now();
    try {
      const result = await operation();
      const duration = Math.round(performance.now() - start);
      this.performance(`Completed ${action}`, { component, action, duration });
      return result;
    } catch (error) {
      const duration = Math.round(performance.now() - start);
      this.error(`Failed ${action}`, { component, action, duration, error });
      throw error;
    }
  }
}

const logger = Logger.getInstance();
export default logger;