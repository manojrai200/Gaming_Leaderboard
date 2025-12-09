const rateLimit = require("express-rate-limit");
const { REDIS_HOST, REDIS_PORT, RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX_REQUESTS } = require("../util/config");
const logger = require("../util/logger");

// Create Redis client for rate limiting (separate from main Redis connection)
let redisClient = null;

const initRedisClient = async () => {
  try {
    const Redis = require("ioredis");
    redisClient = new Redis({
      host: REDIS_HOST,
      port: REDIS_PORT,
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
      lazyConnect: true,
    });
    
    // ioredis connects automatically when lazyConnect is true, but we can wait for ready
    redisClient.on("ready", () => {
      logger.info("Rate limiter Redis client connected");
    });
    
    redisClient.on("error", (error) => {
      logger.error("Rate limiter Redis client error, falling back to memory store", error);
      redisClient = null;
    });
  } catch (error) {
    logger.error("Failed to initialize Redis for rate limiting, falling back to memory store", error);
    redisClient = null;
  }
};

// Initialize on module load
if (process.env.NODE_ENV !== "test") {
  initRedisClient();
}

/**
 * General API rate limiter
 */
const apiLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: RATE_LIMIT_MAX_REQUESTS,
  message: {
    error: "Too many requests from this IP, please try again later",
    retryAfter: Math.ceil(RATE_LIMIT_WINDOW_MS / 1000),
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  // Use Redis store if available, otherwise use memory store
  store: redisClient ? {
    async increment(key) {
      const count = await redisClient.incr(key);
      if (count === 1) {
        await redisClient.expire(key, Math.ceil(RATE_LIMIT_WINDOW_MS / 1000));
      }
      return {
        totalHits: count,
        resetTime: new Date(Date.now() + RATE_LIMIT_WINDOW_MS),
      };
    },
    async decrement(key) {
      await redisClient.decr(key);
    },
    async resetKey(key) {
      await redisClient.del(key);
    },
  } : undefined,
  handler: (req, res) => {
    logger.warn("Rate limit exceeded", {
      ip: req.ip,
      path: req.path,
    });
    res.status(429).json({
      error: "Too many requests from this IP, please try again later",
      retryAfter: Math.ceil(RATE_LIMIT_WINDOW_MS / 1000),
    });
  },
});

/**
 * Strict rate limiter for score submission
 */
const scoreSubmissionLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute per IP
  message: {
    error: "Too many score submissions, please try again later",
    retryAfter: 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: redisClient ? {
    async increment(key) {
      const count = await redisClient.incr(key);
      if (count === 1) {
        await redisClient.expire(key, 60);
      }
      return {
        totalHits: count,
        resetTime: new Date(Date.now() + 60000),
      };
    },
    async decrement(key) {
      await redisClient.decr(key);
    },
    async resetKey(key) {
      await redisClient.del(key);
    },
  } : undefined,
  handler: (req, res) => {
    logger.warn("Score submission rate limit exceeded", {
      ip: req.ip,
      playerId: req.body?.playerId,
    });
    res.status(429).json({
      error: "Too many score submissions, please try again later",
      retryAfter: 60,
    });
  },
});

module.exports = {
  apiLimiter,
  scoreSubmissionLimiter,
};

