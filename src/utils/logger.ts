type LogLevel = 'info' | 'warn' | 'error';

const logger = {
  info: (component: string, message: string, data?: any) => {
    console.log(`[${component}] ${message}`, data ? data : '');
  },
  warn: (component: string, message: string, data?: any) => {
    console.warn(`[${component}] ${message}`, data ? data : '');
  },
  error: (component: string, message: string, error?: any) => {
    console.error(`[${component}] ${message}`, error ? error : '');
  }
};

export default logger;