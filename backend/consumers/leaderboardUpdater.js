const {
  consumer,
  redis,
  resetConsumerOffsetToEarliest,
} = require("../util/db");
const redisService = require("../services/redisService");
const kafkaService = require("../services/kafkaService");
const cdnCacheService = require("../services/cdnCacheService");
const logger = require("../util/logger");

/**
 * Kafka Consumer - Processes score-submitted events and updates Redis leaderboards
 * This runs as a background process
 * Automatically rebuilds leaderboards from Kafka if Redis data is missing
 */

let isRunning = false;
let isRebuilding = false; // Flag to track if we're rebuilding leaderboards
let consecutiveEmptyBatches = 0; // Track consecutive empty batches to detect when rebuild is complete
let lastBatchProcessedTime = null; // Track when we last processed a batch during rebuild
let rebuildCheckInterval = null; // Interval timer to check if rebuild is complete
const EMPTY_BATCH_THRESHOLD = 3; // Number of consecutive empty batches before considering rebuild complete
const REBUILD_IDLE_TIMEOUT = 5000; // If no batches processed for 5 seconds during rebuild, consider it complete

const startConsumer = async () => {
  if (isRunning) {
    console.log("⚠️ Consumer is already running");
    return;
  }

  try {
    console.log("🔄 Starting leaderboard updater consumer...");

    // Check if leaderboards need to be rebuilt
    const needsRebuild = await redisService.needsRebuild();

    if (needsRebuild) {
      console.log("⚠️ Redis leaderboards appear to be empty or missing");
      console.log("🔧 Initiating automatic rebuild from Kafka messages...");
      isRebuilding = true;

      // Reset consumer offset to earliest to replay all messages
      // This deletes the consumer group and reconnects
      const resetSuccess = await resetConsumerOffsetToEarliest();
      if (!resetSuccess) {
        console.log(
          "⚠️ Could not reset offsets, will try to subscribe from beginning"
        );
      }

      // Subscribe from beginning to replay all messages
      await consumer.subscribe({
        topic: "score-submitted",
        fromBeginning: true,
      });
      console.log(
        "📥 Subscribed from beginning - replaying messages to rebuild leaderboards..."
      );
      console.log("   (This may take a while depending on message volume)");
    } else {
      console.log(
        "✅ Leaderboards found in Redis, processing new messages only"
      );
      isRebuilding = false;

      // Subscribe normally (continue from last offset)
      await consumer.subscribe({
        topic: "score-submitted",
        fromBeginning: false,
      });
      console.log("✅ Subscribed to score-submitted topic (new messages only)");
    }

    // Set isRunning flag before starting consumer.run() since run() is an infinite loop
    // that never returns, making code after it unreachable
    isRunning = true;
    console.log("✅ Leaderboard updater consumer started");

    // If rebuilding, set up a periodic check to detect when rebuild is complete
    // This handles the case where eachBatch might not be called frequently enough
    // when we've caught up to the latest messages
    if (isRebuilding) {
      lastBatchProcessedTime = Date.now();
      rebuildCheckInterval = setInterval(() => {
        if (isRebuilding && lastBatchProcessedTime) {
          const timeSinceLastBatch = Date.now() - lastBatchProcessedTime;
          if (timeSinceLastBatch >= REBUILD_IDLE_TIMEOUT) {
            console.log(
              "✅ Rebuild phase complete - no batches processed for 5 seconds, switching to normal operation"
            );
            isRebuilding = false;
            consecutiveEmptyBatches = 0;
            lastBatchProcessedTime = null;
            if (rebuildCheckInterval) {
              clearInterval(rebuildCheckInterval);
              rebuildCheckInterval = null;
            }
          }
        }
      }, 1000); // Check every second
    }

    // Start the consumer (this is an infinite loop that never returns)
    await consumer.run({
      // Process messages in batches for better performance
      eachBatch: async ({ batch }) => {
        const events = [];
        const today = new Date().toISOString().split("T")[0];

        // Parse all events
        for (const message of batch.messages) {
          try {
            const event = JSON.parse(message.value.toString());
            // Validate required fields
            if (!event.playerId || event.score === undefined || event.score === null || event.score === '') {
              console.error("❌ Invalid event data:", event);
              continue; // Skip invalid events
            }
            events.push(event);
          } catch (error) {
            console.error("❌ Error parsing message:", error);
          }
        }
        
        // Track rebuild completion: if we're rebuilding and get empty/small batches,
        // it means we've caught up to the latest messages
        if (isRebuilding) {
          lastBatchProcessedTime = Date.now(); // Update last processed time

          if (events.length === 0) {
            consecutiveEmptyBatches++;
            if (consecutiveEmptyBatches >= EMPTY_BATCH_THRESHOLD) {
              console.log(
                "✅ Rebuild phase complete - caught up to latest messages, switching to normal operation"
              );
              isRebuilding = false;
              consecutiveEmptyBatches = 0;
              lastBatchProcessedTime = null;
              if (rebuildCheckInterval) {
                clearInterval(rebuildCheckInterval);
                rebuildCheckInterval = null;
              }
            }
            return;
          } else {
            // Reset counter if we get a non-empty batch (still processing backlog)
            consecutiveEmptyBatches = 0;
          }
        }

        if (events.length === 0) return;

        // Get initial old ranks before any updates (for rank change notifications)
        // Track initial rank for each unique player-gameMode combination
        const initialRanks = new Map();
        const seenKeys = new Set();

        for (const event of events) {
          const key = `${event.playerId}:${event.gameMode}`;
          // Only get initial rank once per unique player-gameMode combination
          if (!seenKeys.has(key)) {
            seenKeys.add(key);
            const oldRankData = await redisService.getPlayerRank(
              event.gameMode,
              event.playerId,
              "global"
            );
            initialRanks.set(key, oldRankData?.rank || null);
          }
        }

        // Group events by player-gameMode to identify which need sequential processing
        // Events for the same player-gameMode must be processed sequentially to track rank changes
        const eventGroups = new Map();
        const standaloneEvents = [];

        for (const event of events) {
          const key = `${event.playerId}:${event.gameMode}`;
          if (!eventGroups.has(key)) {
            eventGroups.set(key, []);
          }
          eventGroups.get(key).push(event);
        }

        // Identify groups with multiple events (need sequential processing)
        // and standalone events (can be batched)
        for (const [key, groupEvents] of eventGroups.entries()) {
          if (groupEvents.length === 1) {
            standaloneEvents.push(groupEvents[0]);
          }
        }

        // Track current rank for each player-gameMode as we process events
        // This will be updated incrementally to track rank changes accurately
        const currentRanks = new Map();

        // Process events that need sequential processing (same player appears multiple times)
        for (const [key, groupEvents] of eventGroups.entries()) {
          if (groupEvents.length > 1) {
            // Process events for this player-gameMode sequentially
            for (const event of groupEvents) {
              const { playerId, username, gameMode, score } = event;

              // Get the rank before processing this specific event
              const previousRank = currentRanks.has(key)
                ? currentRanks.get(key)
                : initialRanks.get(key);

              // Create pipeline for this event's Redis operations
              const pipeline = redis.pipeline();

              // Track players that need to be created
              const playerExists = await redis.exists(`player:${playerId}`);
              if (!playerExists) {
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

              // Update global leaderboard
              pipeline.zincrby(
                `leaderboard:${gameMode}:global`,
                score,
                playerId
              );

              // Update daily leaderboard
              const dailyKey = `leaderboard:${gameMode}:daily:${today}`;
              pipeline.zincrby(dailyKey, score, playerId);
              pipeline.expire(dailyKey, 7 * 24 * 60 * 60); // 7 days TTL

              // Update weekly leaderboard
              await redisService.updateWeeklyLeaderboard(gameMode, playerId, score);

              // Update player stats
              pipeline.hincrby(`player:${playerId}`, "total_score", score);
              pipeline.hincrby(`player:${playerId}`, "games_played", 1);

              // Execute this event's Redis operations
              await pipeline.exec();

              // Get the rank after processing this specific event
              // Always update currentRanks to track incremental changes, even during rebuild
              // This ensures multiple events from the same player track rank changes correctly
              try {
                const newRankData = await redisService.getPlayerRank(
                  event.gameMode,
                  event.playerId,
                  "global"
                );

                // Update the tracked rank for the next occurrence (needed for incremental tracking)
                if (newRankData) {
                  currentRanks.set(key, newRankData.rank);
                }

                // Only publish rank change notifications if we're not rebuilding
                // (During rebuild, we suppress notifications to avoid spam)
                if (!isRebuilding) {
                  // Only publish if rank actually changed from the previous rank
                  if (newRankData && newRankData.rank !== previousRank) {
                    await kafkaService.publishLeaderboardUpdated({
                      gameMode: event.gameMode,
                      playerId: event.playerId,
                      newRank: newRankData.rank,
                      oldRank: previousRank,
                      score: newRankData.score,
                    });

                    // Invalidate CDN cache if rank is in top 100 (most requested)
                    // Check both old and new rank to catch entries/exits from top 100
                    if (
                      (previousRank !== null && previousRank <= 100) ||
                      newRankData.rank <= 100
                    ) {
                    await cdnCacheService.invalidateCache([
                      `/api/leaderboard/${event.gameMode}/top100`,
                      `/api/leaderboard/${event.gameMode}?limit=100&offset=0`,
                      `/api/leaderboard/${event.gameMode}?type=global&limit=100&offset=0`,
                    ]);
                    }
                  }
                }
              } catch (error) {
                console.error("❌ Error getting/updating rank:", error);
              }
            }
          }
        }

        // Batch process standalone events (different players, can be processed together)
        if (standaloneEvents.length > 0) {
          const pipeline = redis.pipeline();
          const playersToCreate = new Set();

          for (const event of standaloneEvents) {
            const { playerId, username, gameMode, score } = event;

            // Track players that need to be created
            const playerExists = await redis.exists(`player:${playerId}`);
            if (!playerExists) {
              playersToCreate.add(playerId);
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

            // Update global leaderboard
            pipeline.zincrby(`leaderboard:${gameMode}:global`, score, playerId);

            // Update daily leaderboard
            const dailyKey = `leaderboard:${gameMode}:daily:${today}`;
            pipeline.zincrby(dailyKey, score, playerId);
            pipeline.expire(dailyKey, 7 * 24 * 60 * 60); // 7 days TTL

            // Update weekly leaderboard (async, non-blocking)
            redisService.updateWeeklyLeaderboard(gameMode, playerId, score).catch(err => {
              console.error("❌ Error updating weekly leaderboard:", err);
            });

            // Update player stats
            pipeline.hincrby(`player:${playerId}`, "total_score", score);
            pipeline.hincrby(`player:${playerId}`, "games_played", 1);
          }

          // Execute all standalone events in one batch
          await pipeline.exec();

          // Publish rank change events for standalone events
          if (!isRebuilding) {
            for (const event of standaloneEvents) {
              try {
                const key = `${event.playerId}:${event.gameMode}`;
                const previousRank = initialRanks.get(key);

                const newRankData = await redisService.getPlayerRank(
                  event.gameMode,
                  event.playerId,
                  "global"
                );

                if (newRankData && newRankData.rank !== previousRank) {
                  await kafkaService.publishLeaderboardUpdated({
                    gameMode: event.gameMode,
                    playerId: event.playerId,
                    newRank: newRankData.rank,
                    oldRank: previousRank,
                    score: newRankData.score,
                  });

                  // Invalidate CDN cache if rank is in top 100 (most requested)
                  if (
                    (previousRank !== null && previousRank <= 100) ||
                    newRankData.rank <= 100
                  ) {
                    await cdnCacheService.invalidateCache([
                      `/api/leaderboard/${event.gameMode}/top100`,
                      `/api/leaderboard/${event.gameMode}?limit=100&offset=0`,
                      `/api/leaderboard/${event.gameMode}?type=global&limit=100&offset=0`,
                    ]);
                  }
                }
              } catch (error) {
                console.error("❌ Error publishing rank update:", error);
              }
            }
          }
        }

        const rebuildStatus = isRebuilding ? " (rebuilding)" : "";
        console.log(
          `✅ Processed batch of ${events.length} messages${rebuildStatus}`
        );
      },
    });

    // Note: Rebuild completion is now detected automatically by tracking
    // consecutive empty batches in the eachBatch handler above.
    // This ensures we only exit rebuild mode after actually catching up to
    // the latest messages, not based on elapsed time.
    //
    // Note: consumer.run() is an infinite loop that never returns, so any code
    // after it is unreachable. The isRunning flag is set before calling run().
  } catch (error) {
    console.error("❌ Failed to start consumer:", error);
    isRunning = false;
    throw error;
  }
};

const stopConsumer = async () => {
  if (!isRunning) {
    return;
  }

  try {
    // Clear rebuild check interval if it exists
    if (rebuildCheckInterval) {
      clearInterval(rebuildCheckInterval);
      rebuildCheckInterval = null;
    }

    await consumer.disconnect();
    isRunning = false;
    isRebuilding = false;
    consecutiveEmptyBatches = 0;
    lastBatchProcessedTime = null;
    console.log("✅ Consumer stopped");
  } catch (error) {
    console.error("❌ Error stopping consumer:", error);
  }
};

module.exports = {
  startConsumer,
  stopConsumer,
  isRunning: () => isRunning,
};
