const http = require('http');
const { v4: uuidv4 } = require('uuid');

const BASE_URL = 'http://localhost:3001';
const ENDPOINT = '/api/scores/submit';
const TOTAL_USERS = 100;

// Game mode configurations
const GAME_MODES = [
  { id: 1, name: 'Deathmatch', maxScore: 15000, avgDurationMinutes: 10 },
  { id: 2, name: 'Capture the Flag', maxScore: 20000, avgDurationMinutes: 15 },
  { id: 3, name: 'Raid', maxScore: 25000, avgDurationMinutes: 20 },
];

/**
 * Submit a score for a user
 */
function submitScore(playerId, username, gameMode, score, gameDurationSeconds) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      playerId,
      username,
      gameMode,
      score,
      gameDurationSeconds,
    });

    const req = http.request({
      hostname: 'localhost',
      port: 3001,
      path: ENDPOINT,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length,
      },
      timeout: 10000,
    }, (res) => {
      let responseData = '';
      res.on('data', (chunk) => (responseData += chunk));
      res.on('end', () => {
        if (res.statusCode === 202) {
          resolve({ success: true, status: res.statusCode, data: responseData });
        } else {
          resolve({ success: false, status: res.statusCode, data: responseData });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.write(data);
    req.end();
  });
}

/**
 * Generate a random score within the game mode's limits
 */
function generateRandomScore(gameMode) {
  // Generate score between 10% and 90% of max to avoid validation issues
  const minScore = Math.floor(gameMode.maxScore * 0.1);
  const maxScore = Math.floor(gameMode.maxScore * 0.9);
  return Math.floor(Math.random() * (maxScore - minScore + 1)) + minScore;
}

/**
 * Generate a random game duration within reasonable bounds
 */
function generateRandomDuration(gameMode) {
  const avgDurationSeconds = gameMode.avgDurationMinutes * 60;
  // Duration between 50% and 150% of average
  const minDuration = Math.floor(avgDurationSeconds * 0.5);
  const maxDuration = Math.floor(avgDurationSeconds * 1.5);
  return Math.floor(Math.random() * (maxDuration - minDuration + 1)) + minDuration;
}

/**
 * Main function to add scores for 100 users
 */
async function add100UsersScores() {
  console.log('🚀 Adding scores for 100 different users...\n');

  const users = [];
  const results = {
    success: 0,
    failed: 0,
    errors: [],
  };

  // Generate 100 unique users
  for (let i = 1; i <= TOTAL_USERS; i++) {
    const playerId = uuidv4();
    const username = `player${String(i).padStart(3, '0')}`;
    users.push({ playerId, username });
  }

  console.log(`Generated ${users.length} unique users\n`);

  // Submit scores for each user
  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    
    // Randomly select a game mode
    const gameMode = GAME_MODES[Math.floor(Math.random() * GAME_MODES.length)];
    const score = generateRandomScore(gameMode);
    const gameDurationSeconds = generateRandomDuration(gameMode);

    try {
      const result = await submitScore(
        user.playerId,
        user.username,
        gameMode.id,
        score,
        gameDurationSeconds
      );

      if (result.success) {
        results.success++;
        console.log(
          `✅ [${i + 1}/${TOTAL_USERS}] ${user.username} - ${gameMode.name} - Score: ${score}`
        );
      } else {
        results.failed++;
        results.errors.push({
          user: user.username,
          error: `Status ${result.status}: ${result.data}`,
        });
        console.log(
          `❌ [${i + 1}/${TOTAL_USERS}] ${user.username} - Failed (Status: ${result.status})`
        );
      }

      // Small delay to avoid overwhelming the server
      await new Promise((resolve) => setTimeout(resolve, 50));
    } catch (error) {
      results.failed++;
      results.errors.push({
        user: user.username,
        error: error.message,
      });
      console.log(
        `❌ [${i + 1}/${TOTAL_USERS}] ${user.username} - Error: ${error.message}`
      );
    }
  }

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Summary:');
  console.log(`   Total Users: ${TOTAL_USERS}`);
  console.log(`   Successful: ${results.success} ✅`);
  console.log(`   Failed: ${results.failed} ${results.failed > 0 ? '❌' : ''}`);

  if (results.errors.length > 0) {
    console.log('\n❌ Errors:');
    results.errors.forEach((err) => {
      console.log(`   - ${err.user}: ${err.error}`);
    });
  }

  console.log('\n✨ Done!');
}

// Run the script
add100UsersScores().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

