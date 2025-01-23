import logger from "./logger";

interface CacheConfig {
  maxAge: number;
  maxSize: number;
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

class Cache<T> {
  private cache: Map<string, CacheEntry<T>>;
  private config: CacheConfig;

  constructor(config: Partial<CacheConfig> = {}) {
    this.cache = new Map();
    this.config = {
      maxAge: config.maxAge || 5 * 60 * 1000, // 5 minutes default
      maxSize: config.maxSize || 100 // 100 items default
    };
  }

  set(key: string, data: T): void {
    if (this.cache.size >= this.config.maxSize) {
      this.evictOldest();
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });

    logger.debug('Cache entry set', {
      component: 'Cache',
      action: 'set',
      details: { key, cacheSize: this.cache.size }
    });
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    if (this.isExpired(entry)) {
      this.cache.delete(key);
      logger.debug('Cache entry expired', {
        component: 'Cache',
        action: 'get',
        details: { key }
      });
      return null;
    }

    return entry.data;
  }

  private isExpired(entry: CacheEntry<T>): boolean {
    return Date.now() - entry.timestamp > this.config.maxAge;
  }

  private evictOldest(): void {
    const oldestKey = Array.from(this.cache.entries())
      .sort(([, a], [, b]) => a.timestamp - b.timestamp)[0]?.[0];

    if (oldestKey) {
      this.cache.delete(oldestKey);
      logger.debug('Cache entry evicted', {
        component: 'Cache',
        action: 'evict',
        details: { key: oldestKey }
      });
    }
  }

  clear(): void {
    this.cache.clear();
    logger.debug('Cache cleared', {
      component: 'Cache',
      action: 'clear'
    });
  }
}

export const projectCache = new Cache<any>({ maxAge: 10 * 60 * 1000 }); // 10 minutes
export const wizardCache = new Cache<any>({ maxAge: 5 * 60 * 1000 }); // 5 minutes