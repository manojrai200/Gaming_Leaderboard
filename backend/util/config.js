require("dotenv").config();

module.exports = {
  // Environment
  NODE_ENV: process.env.NODE_ENV || "development",
  
  // Kafka Configuration
  KAFKA_BROKERS: process.env.KAFKA_BROKERS || "localhost:9092",
  KAFKA_CLIENT_ID: process.env.KAFKA_CLIENT_ID || "gaming-leaderboard-backend",
  
  // Redis Configuration
  REDIS_HOST: process.env.REDIS_HOST || "localhost",
  REDIS_PORT: parseInt(process.env.REDIS_PORT || "6379"),
  REDIS_PASSWORD: process.env.REDIS_PASSWORD || "",
  
  // Server Configuration
  PORT: parseInt(process.env.PORT || "3001"),
  
  // CDN Configuration
  CDN_CACHE_TTL: parseInt(process.env.CDN_CACHE_TTL || "5"), // Cache TTL in seconds
  CDN_INVALIDATION_URL: process.env.CDN_INVALIDATION_URL || "", // CDN purge API URL
  CDN_API_KEY: process.env.CDN_API_KEY || "", // CDN API key for invalidation
  CDN_PROVIDER: process.env.CDN_PROVIDER || "cloudflare", // cloudflare, cloudfront, fastly, etc.
  
  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "900000"), // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || "100"), // 100 requests per window
  
  // Security
  CORS_ORIGIN: process.env.CORS_ORIGIN || "*",
  
  // Logging
  LOG_LEVEL: process.env.LOG_LEVEL || "info",
};
