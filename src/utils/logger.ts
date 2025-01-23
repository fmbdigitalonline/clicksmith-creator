export interface LogContext {
  component?: string;
  action?: string;
  message?: string;
  userId?: string;
  duration?: number;
  error?: any;
  details?: Record<string, any>;
  count?: number;
  status?: string;
}

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

  private formatMessage(level: string, context: LogContext, message?: string): string {
    const timestamp = new Date().toISOString();
    const component = context.component ? `[${context.component}]` : '';
    const action = context.action ? `(${context.action})` : '';
    const details = context.details ? JSON.stringify(context.details) : '';
    const duration = context.duration ? `${context.duration}ms` : '';
    const finalMessage = message || context.message || '';
    return `${timestamp} - ${level}: ${component}${action} ${finalMessage} ${details} ${duration}`.trim();
  }

  info(message: string, context: Partial<LogContext> = {}) {
    console.log(this.formatMessage('info', context, message));
  }

  warn(message: string, context: Partial<LogContext> = {}) {
    console.warn(this.formatMessage('warn', context, message));
  }

  error(message: string, context: Partial<LogContext> = {}) {
    console.error(this.formatMessage('error', context, message));
    if (context.error) {
      console.error('Error details:', context.error);
    }
  }

  debug(message: string, context: Partial<LogContext> = {}) {
    if (!this.isProd) {
      console.debug(this.formatMessage('debug', context, message));
    }
  }

  performance(message: string, context: Partial<LogContext> = {}) {
    console.log(this.formatMessage('performance', context, message));
  }

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