const { redis } = require("../util/db");

/**
 * Redis Service - Handles all Redis operations for leaderboards and player data
 */

// Player Operations
const getPlayer = async (playerId) => {
  const playerData = await redis.hgetall(`player:${playerId}`);
  if (!playerData || Object.keys(playerData).length === 0) {
    return null;
  }
  return {
    id: playerId,
    username: playerData.username,
    total_score: parseInt(playerData.total_score || 0),
    games_played: parseInt(playerData.games_played || 0),
    created_at: playerData.created_at,
  };
};

const createOrUpdatePlayer = async (playerId, username) => {
  const exists = await redis.exists(`player:${playerId}`);
  const pipeline = redis.pipeline();

  if (!exists) {
    // New player
    pipeline.hset(`player:${playerId}`, {
      username,
      total_score: 0,
      games_played: 0,
      created_at: new Date().toISOString(),
    });
  } else {
    // Update username if changed
    pipeline.hset(`player:${playerId}`, "username", username);
  }

  await pipeline.exec();
};

const updatePlayerScore = async (playerId, score) => {
  const pipeline = redis.pipeline();
  pipeline.hincrby(`player:${playerId}`, "total_score", score);
  pipeline.hincrby(`player:${playerId}`, "games_played", 1);
  await pipeline.exec();
};

// Leaderboard Operations
const updateGlobalLeaderboard = async (gameMode, playerId, score) => {
  await redis.zincrby(`leaderboard:${gameMode}:global`, score, playerId);
};

const updateDailyLeaderboard = async (gameMode, playerId, score) => {
  const today = new Date().toISOString().split("T")[0];
  const key = `leaderboard:${gameMode}:daily:${today}`;
  
  await redis.zincrby(key, score, playerId);
  // Set expiration (7 days)
  await redis.expire(key, 7 * 24 * 60 * 60);
};

const getLeaderboard = async (gameMode, type = "global", limit = 100, offset = 0) => {
  let key;
  if (type === "daily") {
    const today = new Date().toISOString().split("T")[0];
    key = `leaderboard:${gameMode}:daily:${today}`;
  } else {
    key = `leaderboard:${gameMode}:global`;
  }

  // Get total count of players in leaderboard
  const totalCount = await redis.zcard(key);

  // Get top players with scores (sorted descending)
  const results = await redis.zrevrange(key, offset, offset + limit - 1, "WITHSCORES");
  
  // Convert to array of {playerId, score}
  const leaderboard = [];
  for (let i = 0; i < results.length; i += 2) {
    leaderboard.push({
      playerId: results[i],
      score: parseInt(results[i + 1]),
    });
  }

  // Batch fetch usernames
  let leaderboardWithRanks = [];
  if (leaderboard.length > 0) {
    const playerIds = leaderboard.map((entry) => entry.playerId);
    const usernames = await batchGetUsernames(playerIds);

    // Combine with ranks
    leaderboardWithRanks = leaderboard.map((entry, index) => ({
      rank: offset + index + 1,
      playerId: entry.playerId,
      username: usernames[entry.playerId] || "Unknown",
      score: entry.score,
    }));
  }

  // Return both leaderboard data and total count
  return {
    leaderboard: leaderboardWithRanks,
    totalCount: totalCount || 0,
  };
};

const getPlayerRank = async (gameMode, playerId, type = "global") => {
  let key;
  if (type === "daily") {
    const today = new Date().toISOString().split("T")[0];
    key = `leaderboard:${gameMode}:daily:${today}`;
  } else {
    key = `leaderboard:${gameMode}:global`;
  }

  const rank = await redis.zrevrank(key, playerId);
  const score = await redis.zscore(key, playerId);

  if (rank === null || score === null) {
    return null;
  }

  return {
    rank: rank + 1, // 0-indexed to 1-indexed
    score: parseInt(score),
  };
};

const getPlayerScore = async (gameMode, playerId, type = "global") => {
  let key;
  if (type === "daily") {
    const today = new Date().toISOString().split("T")[0];
    key = `leaderboard:${gameMode}:daily:${today}`;
  } else if (type === "weekly") {
    const weekId = getWeekIdentifier();
    key = `leaderboard:${gameMode}:weekly:${weekId}`;
  } else {
    key = `leaderboard:${gameMode}:global`;
  }

  const score = await redis.zscore(key, playerId);
  return score ? parseInt(score) : 0;
};

// Weekly Leaderboard Operations
const updateWeeklyLeaderboard = async (gameMode, playerId, score) => {
  // Validate and convert score to number
  const numericScore = Number(score);
  if (isNaN(numericScore) || numericScore === 0) {
    console.warn(`⚠️ Invalid score for weekly leaderboard update: ${score} (gameMode: ${gameMode}, playerId: ${playerId})`);
    return; // Skip update if score is invalid
  }
  
  const weekId = getWeekIdentifier();
  const key = `leaderboard:${gameMode}:weekly:${weekId}`;
  
  await redis.zincrby(key, numericScore, playerId);
  // Keep weekly leaderboards for 4 weeks (28 days)
  await redis.expire(key, 28 * 24 * 60 * 60);
};

const getWeeklyLeaderboard = async (gameMode, weekId = null, limit = 100, offset = 0) => {
  const targetWeekId = weekId || getWeekIdentifier();
  const key = `leaderboard:${gameMode}:weekly:${targetWeekId}`;

  // Get total count of players in leaderboard
  const totalCount = await redis.zcard(key);

  // Get top players with scores (sorted descending)
  const results = await redis.zrevrange(key, offset, offset + limit - 1, "WITHSCORES");
  
  // Convert to array of {playerId, score}
  const leaderboard = [];
  for (let i = 0; i < results.length; i += 2) {
    leaderboard.push({
      playerId: results[i],
      score: parseInt(results[i + 1]),
    });
  }

  // Batch fetch usernames
  let leaderboardWithRanks = [];
  if (leaderboard.length > 0) {
    const playerIds = leaderboard.map((entry) => entry.playerId);
    const usernames = await batchGetUsernames(playerIds);

    // Combine with ranks
    leaderboardWithRanks = leaderboard.map((entry, index) => ({
      rank: offset + index + 1,
      playerId: entry.playerId,
      username: usernames[entry.playerId] || "Unknown",
      score: entry.score,
    }));
  }

  return {
    leaderboard: leaderboardWithRanks,
    totalCount: totalCount || 0,
    weekId: targetWeekId,
  };
};

const getPlayerWeeklyRank = async (gameMode, playerId, weekId = null) => {
  const targetWeekId = weekId || getWeekIdentifier();
  const key = `leaderboard:${gameMode}:weekly:${targetWeekId}`;

  const rank = await redis.zrevrank(key, playerId);
  const score = await redis.zscore(key, playerId);

  if (rank === null || score === null) {
    return null;
  }

  return {
    rank: rank + 1, // 0-indexed to 1-indexed
    score: parseInt(score),
    weekId: targetWeekId,
  };
};

// Helper function to get week identifier (ISO week format: YYYY-Www)
const getWeekIdentifier = () => {
  const date = new Date();
  const year = date.getFullYear();
  
  // Get ISO week number
  const startOfYear = new Date(year, 0, 1);
  const pastDaysOfYear = (date - startOfYear) / 86400000;
  const weekNumber = Math.ceil((pastDaysOfYear + startOfYear.getDay() + 1) / 7);
  
  return `${year}-W${weekNumber.toString().padStart(2, "0")}`;
};

// Batch operations for performance
const batchGetUsernames = async (playerIds) => {
  if (playerIds.length === 0) return {};

  const pipeline = redis.pipeline();
  playerIds.forEach((playerId) => {
    pipeline.hget(`player:${playerId}`, "username");
  });

  const results = await pipeline.exec();
  const usernames = {};

  results.forEach((result, index) => {
    if (result[1]) {
      usernames[playerIds[index]] = result[1];
    }
  });

  return usernames;
};

// Rate Limiting
const checkRateLimit = async (playerId, minIntervalSeconds = 60) => {
  const key = `player:${playerId}:last_submission`;
  const lastSubmission = await redis.get(key);

  if (lastSubmission) {
    const lastTime = new Date(lastSubmission).getTime();
    const now = Date.now();
    const elapsed = (now - lastTime) / 1000;

    if (elapsed < minIntervalSeconds) {
      return {
        allowed: false,
        remainingSeconds: Math.ceil(minIntervalSeconds - elapsed),
      };
    }
  }

  // Update last submission time
  await redis.setex(key, minIntervalSeconds, new Date().toISOString());

  return { allowed: true };
};

// Game Modes Operations
const getGameMode = async (gameModeId) => {
  const gameModeData = await redis.hget("game_modes", gameModeId);
  if (!gameModeData) {
    return null;
  }
  return JSON.parse(gameModeData);
};

const getAllGameModes = async () => {
  const gameModes = await redis.hgetall("game_modes");
  const result = [];

  for (const [id, data] of Object.entries(gameModes)) {
    result.push({
      id: parseInt(id),
      ...JSON.parse(data),
    });
  }

  return result.sort((a, b) => a.id - b.id);
};

const initializeGameModes = async () => {
  const exists = await redis.exists("game_modes");
  if (exists) {
    return; // Already initialized
  }

  const gameModes = [
    {
      id: 1,
      name: "Deathmatch",
      max_score_per_game: 15000,
      avg_game_duration_minutes: 10,
    },
    {
      id: 2,
      name: "Capture the Flag",
      max_score_per_game: 20000,
      avg_game_duration_minutes: 15,
    },
    {
      id: 3,
      name: "Raid",
      max_score_per_game: 25000,
      avg_game_duration_minutes: 20,
    },
  ];

  const pipeline = redis.pipeline();
  gameModes.forEach((mode) => {
    pipeline.hset("game_modes", mode.id, JSON.stringify(mode));
  });
  await pipeline.exec();

  console.log("✅ Game modes initialized");
};

/**
 * Check if leaderboards need to be rebuilt (Redis is empty or missing data)
 * Returns true if leaderboards should be rebuilt from Kafka
 */
const needsRebuild = async () => {
  try {
    // Check if any global leaderboards exist
    const gameModes = await getAllGameModes();
    
    if (gameModes.length === 0) {
      // Game modes not initialized, will be initialized separately
      // Check if there are any players instead using SCAN (non-blocking)
      let cursor = "0";
      let playerCount = 0;
      
      do {
        const result = await redis.scan(cursor, "MATCH", "player:*", "COUNT", 100);
        cursor = result[0];
        const keys = result[1];
        // Filter out rate limit keys
        const playerKeys = keys.filter(key => !key.includes(":last_submission"));
        playerCount += playerKeys.length;
        
        // Early exit if we found at least one player
        if (playerCount > 0) {
          return false;
        }
      } while (cursor !== "0");
      
      return playerCount === 0;
    }

    // Check if at least one global leaderboard has data
    for (const mode of gameModes) {
      const leaderboardKey = `leaderboard:${mode.id}:global`;
      const count = await redis.zcard(leaderboardKey);
      if (count > 0) {
        // At least one leaderboard has data, no rebuild needed
        return false;
      }
    }

    // Check if there are any players using SCAN (non-blocking)
    let cursor = "0";
    let playerCount = 0;
    
    do {
      const result = await redis.scan(cursor, "MATCH", "player:*", "COUNT", 100);
      cursor = result[0];
      const keys = result[1];
      const playerKeys = keys.filter(key => !key.includes(":last_submission"));
      playerCount += playerKeys.length;
    } while (cursor !== "0");
    
    // If no leaderboards and no players, we need to rebuild
    return playerCount === 0;
  } catch (error) {
    console.error("❌ Error checking if rebuild is needed:", error);
    // If we can't check, assume rebuild is needed (safer option)
    return true;
  }
};

module.exports = {
  // Player operations
  getPlayer,
  createOrUpdatePlayer,
  updatePlayerScore,

  // Leaderboard operations
  updateGlobalLeaderboard,
  updateDailyLeaderboard,
  updateWeeklyLeaderboard,
  getLeaderboard,
  getWeeklyLeaderboard,
  getPlayerRank,
  getPlayerWeeklyRank,
  getPlayerScore,

  // Rate limiting
  checkRateLimit,

  // Game modes
  getGameMode,
  getAllGameModes,
  initializeGameModes,

  // Recovery
  needsRebuild,
  
  // Helpers
  getWeekIdentifier,
};

