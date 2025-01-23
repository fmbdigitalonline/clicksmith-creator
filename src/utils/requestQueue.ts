import logger from "./logger";

interface QueuedRequest {
  id: string;
  operation: () => Promise<any>;
  retryCount: number;
  maxRetries: number;
}

class RequestQueue {
  private queue: QueuedRequest[] = [];
  private isProcessing: boolean = false;
  private static instance: RequestQueue;

  private constructor() {}

  static getInstance(): RequestQueue {
    if (!RequestQueue.instance) {
      RequestQueue.instance = new RequestQueue();
    }
    return RequestQueue.instance;
  }

  async enqueue(
    operation: () => Promise<any>,
    options: { maxRetries?: number } = {}
  ): Promise<void> {
    const request: QueuedRequest = {
      id: crypto.randomUUID(),
      operation,
      retryCount: 0,
      maxRetries: options.maxRetries || 3
    };

    this.queue.push(request);
    logger.debug('Request added to queue', {
      component: 'RequestQueue',
      action: 'enqueue',
      details: { requestId: request.id, queueLength: this.queue.length }
    });

    if (!this.isProcessing) {
      this.processQueue();
    }
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.queue.length > 0) {
      const request = this.queue[0];
      
      try {
        await request.operation();
        this.queue.shift(); // Remove successful request
        logger.debug('Request processed successfully', {
          component: 'RequestQueue',
          action: 'process',
          details: { requestId: request.id }
        });
      } catch (error) {
        logger.error('Request processing failed', {
          component: 'RequestQueue',
          action: 'process',
          error,
          details: { 
            requestId: request.id,
            retryCount: request.retryCount,
            maxRetries: request.maxRetries
          }
        });

        if (request.retryCount < request.maxRetries) {
          request.retryCount++;
          // Move to end of queue for retry
          this.queue.push(this.queue.shift()!);
          await new Promise(resolve => setTimeout(resolve, 1000 * request.retryCount));
        } else {
          // Remove failed request after max retries
          this.queue.shift();
        }
      }
    }

    this.isProcessing = false;
  }

  clear(): void {
    this.queue = [];
    logger.debug('Request queue cleared', {
      component: 'RequestQueue',
      action: 'clear'
    });
  }
}

export const requestQueue = RequestQueue.getInstance();