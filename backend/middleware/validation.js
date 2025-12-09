const { body, param, query, validationResult } = require("express-validator");
const logger = require("../util/logger");

/**
 * Validation result handler
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.warn("Validation errors", { errors: errors.array(), path: req.path });
    return res.status(400).json({
      error: "Validation failed",
      details: errors.array(),
    });
  }
  next();
};

/**
 * Score submission validation rules
 */
const validateScoreSubmission = [
  body("playerId")
    .notEmpty()
    .withMessage("playerId is required")
    .isString()
    .withMessage("playerId must be a string")
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("playerId must be between 1 and 100 characters"),
  
  body("username")
    .notEmpty()
    .withMessage("username is required")
    .isString()
    .withMessage("username must be a string")
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage("username must be between 1 and 50 characters"),
  
  body("gameMode")
    .notEmpty()
    .withMessage("gameMode is required")
    .isInt({ min: 1 })
    .withMessage("gameMode must be a positive integer"),
  
  body("score")
    .notEmpty()
    .withMessage("score is required")
    .isInt({ min: 0 })
    .withMessage("score must be a non-negative integer"),
  
  body("gameDurationSeconds")
    .optional()
    .isInt({ min: 0 })
    .withMessage("gameDurationSeconds must be a non-negative integer"),
  
  handleValidationErrors,
];

/**
 * Leaderboard query validation
 */
const validateLeaderboardQuery = [
  param("gameMode")
    .isInt({ min: 1 })
    .withMessage("gameMode must be a positive integer"),
  
  query("type")
    .optional()
    .isIn(["global", "daily", "weekly"])
    .withMessage("type must be one of: global, daily, weekly"),
  
  query("limit")
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage("limit must be between 1 and 1000"),
  
  query("offset")
    .optional()
    .isInt({ min: 0 })
    .withMessage("offset must be a non-negative integer"),
  
  handleValidationErrors,
];

/**
 * Player ID validation
 */
const validatePlayerId = [
  param("id")
    .notEmpty()
    .withMessage("Player ID is required")
    .isString()
    .withMessage("Player ID must be a string")
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("Player ID must be between 1 and 100 characters"),
  
  handleValidationErrors,
];

/**
 * Game mode validation
 */
const validateGameMode = [
  param("gameMode")
    .isInt({ min: 1 })
    .withMessage("gameMode must be a positive integer"),
  
  handleValidationErrors,
];

module.exports = {
  validateScoreSubmission,
  validateLeaderboardQuery,
  validatePlayerId,
  validateGameMode,
  handleValidationErrors,
};

