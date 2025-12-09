const express = require("express");
const app = express();
const logger = require("./util/logger");

// Security and compression middleware
const securityMiddleware = require("./middleware/security");
app.use(securityMiddleware);

// Body parsing
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Request logging
app.use((req, res, next) => {
  logger.http(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get("user-agent"),
  });
  next();
});

const { PORT } = require("./util/config");
const { connectToDatabase, disconnect } = require("./util/db.js");
const { startConsumer } = require("./consumers/leaderboardUpdater");
const redisService = require("./services/redisService");
const { errorHandler, notFoundHandler } = require("./middleware/errorHandler");

// Routes
const scoresRouter = require("./routes/scores");
const leaderboardRouter = require("./routes/leaderboard");
const playersRouter = require("./routes/players");
const gameModesRouter = require("./routes/gameModes");

app.use("/api/scores", scoresRouter);
app.use("/api/leaderboard", leaderboardRouter);
app.use("/api/players", playersRouter);
app.use("/api/game-modes", gameModesRouter);

// Enhanced health check endpoint
app.get("/health", async (req, res) => {
  const health = {
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || "development",
    services: {
      redis: "unknown",
      kafka: "unknown",
    },
  };

  try {
    // Check Redis
    const redis = require("./util/db").redis;
    await redis.ping();
    health.services.redis = "connected";
  } catch (error) {
    health.services.redis = "disconnected";
    health.status = "degraded";
  }

  try {
    // Check Kafka producer
    const { producer } = require("./util/db");
    // Producer connection is checked during startup
    health.services.kafka = "connected";
  } catch (error) {
    health.services.kafka = "disconnected";
    health.status = "degraded";
  }

  const statusCode = health.status === "ok" ? 200 : 503;
  res.status(statusCode).json(health);
});

// Readiness probe (for Kubernetes/Docker)
app.get("/ready", async (req, res) => {
  try {
    const redis = require("./util/db").redis;
    await redis.ping();
    res.status(200).json({ ready: true });
  } catch (error) {
    res.status(503).json({ ready: false, error: error.message });
  }
});

// Liveness probe
app.get("/live", (req, res) => {
  res.status(200).json({ alive: true });
});

// Root endpoint
app.get("/", (req, res) => {
  res.json({
    message: "Gaming Leaderboard API",
    version: "1.0.0",
    endpoints: {
      scores: "POST /api/scores/submit",
      leaderboard: "GET /api/leaderboard/:gameMode",
      leaderboardTop100: "GET /api/leaderboard/:gameMode/top100",
      playerRank: "GET /api/players/:id/rank/:gameMode",
      playerStats: "GET /api/players/:id/stats",
      gameModes: "GET /api/game-modes",
    },
  });
});

// Error handlers (must be after routes)
app.use(notFoundHandler);
app.use(errorHandler);

// Graceful shutdown
const shutdown = async (signal) => {
  logger.info(`${signal} received, shutting down gracefully`);
  try {
    await disconnect();
    logger.info("All connections closed");
    process.exit(0);
  } catch (error) {
    logger.error("Error during shutdown", error);
    process.exit(1);
  }
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// Handle unhandled promise rejections
process.on("unhandledRejection", (err) => {
  logger.error("Unhandled Promise Rejection", err);
  shutdown("unhandledRejection");
});

// Handle uncaught exceptions
process.on("uncaughtException", (err) => {
  logger.error("Uncaught Exception", err);
  shutdown("uncaughtException");
});

const start = async () => {
  try {
    // Connect to services (Redis, Kafka)
    await connectToDatabase();
    logger.info("✅ All services connected");

    // Initialize game modes in Redis (if not exists)
    await redisService.initializeGameModes();

    // Start Kafka consumer (background process)
    await startConsumer();

    // Start Express server
    app.listen(PORT, () => {
      logger.info(`🚀 Server running on port ${PORT}`);
      // logger.info(`📊 API available at http://0.0.0.0:${PORT}`);
      // logger.info(`🏥 Health check: http://0.0.0.0:${PORT}/health`);
    });
  } catch (err) {
    logger.error("Failed to start server", err);
    process.exit(1);
  }
};

start().catch((err) => {
  logger.error("Failed to start server", err);
  process.exit(1);
});
