import logger from './logger';

export const trackUserAction = (
  component: string,
  action: string,
  details?: Record<string, any>
) => {
  logger.info(`User action: ${action}`, {
    component,
    action,
    ...details
  });
};

export const trackError = (
  component: string,
  error: Error,
  context?: Record<string, any>
) => {
  logger.error(`Error in ${component}`, {
    component,
    error,
    ...context
  });
};

export const trackAPICall = async <T>(
  component: string,
  action: string,
  apiCall: () => Promise<T>
): Promise<T> => {
  return logger.measure(component, action, apiCall);
};

export const trackPageView = (page: string) => {
  logger.info(`Page view: ${page}`, {
    component: 'Router',
    action: 'pageView'
  });
};