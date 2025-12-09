const { producer } = require("../util/db");

/**
 * Kafka Service - Handles publishing events to Kafka topics
 */

const publishScoreSubmitted = async (event) => {
  try {
    await producer.send({
      topic: "score-submitted",
      messages: [
        {
          key: event.playerId, // Partition by playerId for ordering
          value: JSON.stringify({
            playerId: event.playerId,
            username: event.username,
            gameMode: event.gameMode,
            score: event.score,
            gameDurationSeconds: event.gameDurationSeconds,
            timestamp: event.timestamp || new Date().toISOString(),
          }),
        },
      ],
    });
  } catch (error) {
    console.error("❌ Error publishing to Kafka:", error);
    throw error;
  }
};

const publishLeaderboardUpdated = async (event) => {
  try {
    await producer.send({
      topic: "leaderboard-updated",
      messages: [
        {
          value: JSON.stringify({
            gameMode: event.gameMode,
            playerId: event.playerId,
            newRank: event.newRank,
            oldRank: event.oldRank,
            score: event.score,
            timestamp: new Date().toISOString(),
          }),
        },
      ],
    });
  } catch (error) {
    console.error("❌ Error publishing leaderboard update:", error);
    // Don't throw - this is not critical
  }
};

module.exports = {
  publishScoreSubmitted,
  publishLeaderboardUpdated,
};

