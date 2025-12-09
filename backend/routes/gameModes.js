const express = require("express");
const router = express.Router();
const redisService = require("../services/redisService");
const { apiLimiter } = require("../middleware/rateLimiter");
const logger = require("../util/logger");

/**
 * GET /api/game-modes
 * Get all available game modes
 */
router.get("/", apiLimiter, async (req, res) => {
  try {
    const gameModes = await redisService.getAllGameModes();

    res.json({
      total: gameModes.length,
      gameModes,
    });
  } catch (error) {
    logger.error("Error fetching game modes", { error: error.message });
    throw error;
  }
});

/**
 * GET /api/game-modes/:id
 * Get specific game mode details
 */
router.get("/:id", apiLimiter, async (req, res) => {
  try {
    const gameModeId = parseInt(req.params.id);
    const gameMode = await redisService.getGameMode(gameModeId);

    if (!gameMode) {
      return res.status(404).json({
        error: "Game mode not found",
        gameModeId,
      });
    }

    res.json({
      id: gameModeId,
      ...gameMode,
    });
  } catch (error) {
    logger.error("Error fetching game mode", { error: error.message, gameModeId });
    throw error;
  }
});

module.exports = router;

