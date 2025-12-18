/**
 * Redis service - manages connections and canvas state
 */

import Redis, { type Redis as RedisType } from 'ioredis';
import { config } from '../config/index.js';
import { REDIS_KEYS, CANVAS_WIDTH, CANVAS_HEIGHT, BITS_PER_PIXEL } from '@x-place/shared';

export interface RedisClients {
  client: RedisType;
  publisher: RedisType;
  subscriber: RedisType;
}

/**
 * Create Redis client connections
 */
export async function createRedisClients(): Promise<RedisClients> {
  const url = config.redis.url;
  const isTls = url.startsWith('rediss://');

  console.log(`Connecting to Redis: ${url.replace(/:[^:@]*@/, ':***@')}`);

  const options = {
    maxRetriesPerRequest: 3,
    retryDelayOnFailover: 100,
    enableReadyCheck: true,
    connectTimeout: 10000,
    // Enable TLS for Upstash Redis (rediss:// URLs)
    ...(isTls && { tls: {} }),
  };

  const client = new Redis(url, options);
  const publisher = new Redis(url, options);
  const subscriber = new Redis(url, options);

  // Wait for connections
  await Promise.all([
    new Promise<void>((resolve) => client.once('ready', resolve)),
    new Promise<void>((resolve) => publisher.once('ready', resolve)),
    new Promise<void>((resolve) => subscriber.once('ready', resolve)),
  ]);

  return { client, publisher, subscriber };
}

/**
 * Canvas state operations
 */
export class CanvasService {
  constructor(private redis: RedisType) {}

  /**
   * Get pixel color at coordinates
   */
  async getPixel(x: number, y: number): Promise<number> {
    const bitOffset = (y * CANVAS_WIDTH + x) * BITS_PER_PIXEL;
    const result = await this.redis.bitfield(
      REDIS_KEYS.CANVAS_STATE,
      'GET',
      'u4',
      bitOffset
    ) as number[];
    return result[0] ?? 0;
  }

  /**
   * Set pixel color at coordinates
   */
  async setPixel(x: number, y: number, color: number): Promise<void> {
    const bitOffset = (y * CANVAS_WIDTH + x) * BITS_PER_PIXEL;
    await this.redis.bitfield(
      REDIS_KEYS.CANVAS_STATE,
      'SET',
      'u4',
      bitOffset,
      color
    );
  }

  /**
   * Get full canvas state as base64
   */
  async getFullCanvas(): Promise<string> {
    let buffer = await this.redis.getBuffer(REDIS_KEYS.CANVAS_STATE);

    if (!buffer) {
      // Initialize empty canvas (all white = color 0)
      const size = (CANVAS_WIDTH * CANVAS_HEIGHT * BITS_PER_PIXEL) / 8;
      buffer = Buffer.alloc(size, 0x00);
      await this.redis.set(REDIS_KEYS.CANVAS_STATE, buffer);
    }

    return buffer.toString('base64');
  }
}

/**
 * Cooldown operations
 */
export class CooldownService {
  constructor(private redis: RedisType) {}

  /**
   * Check if user can place a pixel
   */
  async canPlace(userId: string): Promise<{ allowed: boolean; remainingMs: number }> {
    const ttl = await this.redis.pttl(REDIS_KEYS.COOLDOWN(userId));

    if (ttl <= 0) {
      return { allowed: true, remainingMs: 0 };
    }

    return { allowed: false, remainingMs: ttl };
  }

  /**
   * Set cooldown for user
   */
  async setCooldown(userId: string, cooldownMs: number): Promise<void> {
    await this.redis.set(
      REDIS_KEYS.COOLDOWN(userId),
      Date.now().toString(),
      'PX',
      cooldownMs
    );
  }
}

/**
 * Leaderboard operations
 */
export class LeaderboardService {
  constructor(private redis: RedisType) {}

  /**
   * Increment faction territory count
   */
  async incrementFactionTerritory(factionId: string): Promise<void> {
    await this.redis.zincrby(REDIS_KEYS.LEADERBOARD_FACTIONS, 1, factionId);
  }

  /**
   * Decrement faction territory count
   */
  async decrementFactionTerritory(factionId: string): Promise<void> {
    await this.redis.zincrby(REDIS_KEYS.LEADERBOARD_FACTIONS, -1, factionId);
  }

  /**
   * Increment user pixel count
   */
  async incrementUserPixels(userId: string): Promise<void> {
    await this.redis.zincrby(REDIS_KEYS.LEADERBOARD_USERS, 1, userId);
  }

  /**
   * Get top factions
   */
  async getTopFactions(limit: number = 10): Promise<Array<{ id: string; score: number }>> {
    const results = await this.redis.zrevrange(
      REDIS_KEYS.LEADERBOARD_FACTIONS,
      0,
      limit - 1,
      'WITHSCORES'
    );

    const entries: Array<{ id: string; score: number }> = [];
    for (let i = 0; i < results.length; i += 2) {
      entries.push({
        id: results[i],
        score: parseInt(results[i + 1], 10),
      });
    }
    return entries;
  }

  /**
   * Get top users
   */
  async getTopUsers(limit: number = 100): Promise<Array<{ id: string; score: number }>> {
    const results = await this.redis.zrevrange(
      REDIS_KEYS.LEADERBOARD_USERS,
      0,
      limit - 1,
      'WITHSCORES'
    );

    const entries: Array<{ id: string; score: number }> = [];
    for (let i = 0; i < results.length; i += 2) {
      entries.push({
        id: results[i],
        score: parseInt(results[i + 1], 10),
      });
    }
    return entries;
  }
}
