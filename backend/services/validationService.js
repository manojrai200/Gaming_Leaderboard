const redisService = require("./redisService");

/**
 * Validation Service - Handles score validation and anti-cheat checks
 */

const validateScore = async (playerId, gameModeId, score, gameDurationSeconds) => {
  const errors = [];

  // Get game mode configuration
  const gameMode = await redisService.getGameMode(gameModeId);
  if (!gameMode) {
    return {
      valid: false,
      errors: [`Game mode ${gameModeId} not found`],
    };
  }

  // Check 1: Score not exceeding maximum
  if (score > gameMode.max_score_per_game) {
    errors.push(`Score ${score} exceeds maximum allowed score of ${gameMode.max_score_per_game}`);
  }

  // Check 2: Score must be positive
  if (score < 0) {
    errors.push("Score cannot be negative");
  }

  // Check 3: Game duration reasonable (if provided)
  if (gameDurationSeconds !== undefined && gameDurationSeconds !== null) {
    const expectedDuration = gameMode.avg_game_duration_minutes * 60;
    const minDuration = expectedDuration * 0.3; // 30% of expected
    const maxDuration = expectedDuration * 3; // 300% of expected

    if (gameDurationSeconds < minDuration || gameDurationSeconds > maxDuration) {
      errors.push(
        `Game duration ${gameDurationSeconds}s is suspicious. Expected range: ${Math.round(minDuration)}s - ${Math.round(maxDuration)}s`
      );
    }
  }

  // Check 4: Rate limiting (max 1 submission per minute)
  const rateLimit = await redisService.checkRateLimit(playerId, 60);
  if (!rateLimit.allowed) {
    errors.push(
      `Too many submissions. Please wait ${rateLimit.remainingSeconds} seconds before submitting again.`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

const validatePlayerData = (playerId, username) => {
  const errors = [];

  if (!playerId || typeof playerId !== "string" || playerId.trim() === "") {
    errors.push("playerId is required and must be a non-empty string");
  }

  if (!username || typeof username !== "string" || username.trim() === "") {
    errors.push("username is required and must be a non-empty string");
  }

  if (username && username.length > 50) {
    errors.push("username must be 50 characters or less");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

module.exports = {
  validateScore,
  validatePlayerData,
};

