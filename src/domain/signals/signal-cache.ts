/**
 * Signal Cache
 *
 * In-memory cache for user signals to avoid repeated database lookups.
 * Improves draft generation performance (signal lookup <100ms vs ~500ms DB query).
 *
 * Week 3 implementation (performance optimization).
 */

import type { UserSignals } from "./types";

/**
 * Cache entry with timestamp
 */
interface CacheEntry {
  signals: UserSignals;
  timestamp: number;
}

/**
 * Signal cache configuration
 */
const CACHE_TTL = 3600000; // 1 hour in milliseconds
const MAX_CACHE_SIZE = 100; // Maximum number of users to cache

/**
 * In-memory signal cache
 */
class SignalCache {
  private cache: Map<string, CacheEntry> = new Map();

  /**
   * Get signals from cache
   *
   * @param userId - User ID
   * @returns Cached signals or undefined if not found/expired
   */
  get(userId: string): UserSignals | undefined {
    const entry = this.cache.get(userId);

    if (!entry) return undefined;

    // Check if expired
    const age = Date.now() - entry.timestamp;
    if (age > CACHE_TTL) {
      this.cache.delete(userId);
      return undefined;
    }

    return entry.signals;
  }

  /**
   * Set signals in cache
   *
   * @param userId - User ID
   * @param signals - User signals
   */
  set(userId: string, signals: UserSignals): void => {
    // Enforce max cache size (LRU-style)
    if (this.cache.size >= MAX_CACHE_SIZE && !this.cache.has(userId)) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(userId, {
      signals,
      timestamp: Date.now(),
    });
  }

  /**
   * Invalidate cache for a user
   *
   * @param userId - User ID
   */
  invalidate(userId: string): void => {
    this.cache.delete(userId);
  }

  /**
   * Clear entire cache
   */
  clear(): void => {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  stats(): {
    size: number;
    maxSize: number;
    ttl: number;
    hitRate?: number;
  } {
    return {
      size: this.cache.size,
      maxSize: MAX_CACHE_SIZE,
      ttl: CACHE_TTL,
    };
  }

  /**
   * Remove expired entries
   */
  cleanup(): void => {
    const now = Date.now();
    for (const [userId, entry] of this.cache.entries()) {
      const age = now - entry.timestamp;
      if (age > CACHE_TTL) {
        this.cache.delete(userId);
      }
    }
  }
}

/**
 * Global signal cache instance
 */
export const signalCache = new SignalCache();

/**
 * Periodic cleanup (run every 10 minutes)
 */
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    signalCache.cleanup();
  }, 600000); // 10 minutes
}
