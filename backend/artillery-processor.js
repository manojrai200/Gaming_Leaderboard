const { v4: uuidv4 } = require("uuid");

/**
 * Artillery processor functions for generating dynamic test data
 */

// Store player data per virtual user session
const playerSessions = new Map();

/**
 * Generate a unique player ID and username for a virtual user
 * This ensures consistency across multiple requests in the same scenario
 */
function generatePlayerId(context, events, done) {
  const sessionId = context.vars.$processEnvironment?.sessionId || 
                    context.vars.$processEnvironment?.__uid || 
                    Math.random().toString(36).substring(7);
  
  // Check if we already have a player ID for this session
  if (!playerSessions.has(sessionId)) {
    const playerId = uuidv4();
    const username = `player_${Math.random().toString(36).substring(2, 10)}_${Date.now()}`;
    
    playerSessions.set(sessionId, {
      playerId,
      username,
      createdAt: Date.now()
    });
  }
  
  const session = playerSessions.get(sessionId);
  context.vars.playerId = session.playerId;
  context.vars.username = session.username;
  
  return done();
}

/**
 * Generate a random game mode ID (assuming game modes 1-5 exist)
 * This can be adjusted based on actual game modes in your system
 */
function getRandomGameMode(context, events, done) {
  // Default game modes if not captured from API
  const gameModes = [1, 2, 3, 4, 5];
  context.vars.randomGameMode = gameModes[Math.floor(Math.random() * gameModes.length)];
  return done();
}

/**
 * Generate a realistic score based on game mode
 */
function generateRealisticScore(context, events, done) {
  const gameMode = context.vars.gameMode || context.vars.randomGameMode || 1;
  
  // Different score ranges for different game modes
  const scoreRanges = {
    1: { min: 1000, max: 50000 },   // Easy mode
    2: { min: 5000, max: 100000 },  // Normal mode
    3: { min: 10000, max: 200000 }, // Hard mode
    4: { min: 20000, max: 500000 }, // Expert mode
    5: { min: 50000, max: 1000000 } // Master mode
  };
  
  const range = scoreRanges[gameMode] || scoreRanges[1];
  context.vars.realisticScore = Math.floor(
    Math.random() * (range.max - range.min) + range.min
  );
  
  return done();
}

/**
 * Generate realistic game duration (in seconds)
 */
function generateGameDuration(context, events, done) {
  // Most games last between 2-30 minutes
  const minDuration = 120;  // 2 minutes
  const maxDuration = 1800; // 30 minutes
  
  context.vars.gameDuration = Math.floor(
    Math.random() * (maxDuration - minDuration) + minDuration
  );
  
  return done();
}

/**
 * Clean up old sessions (optional, for long-running tests)
 */
function cleanupOldSessions() {
  const now = Date.now();
  const maxAge = 3600000; // 1 hour
  
  for (const [sessionId, session] of playerSessions.entries()) {
    if (now - session.createdAt > maxAge) {
      playerSessions.delete(sessionId);
    }
  }
}

// Clean up old sessions every 10 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupOldSessions, 600000);
}

module.exports = {
  generatePlayerId,
  getRandomGameMode,
  generateRealisticScore,
  generateGameDuration
};

