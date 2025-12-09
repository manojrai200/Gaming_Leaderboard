const http = require("http");
const { v4: uuidv4 } = require("uuid");

const BASE_URL = "http://localhost:3001";
const WRITE_ITERATIONS = 1000; // Number of score submissions
const READ_ITERATIONS = 1000; // Number of read operations
const CONCURRENT_READS = 50; // Concurrent read requests
const CONCURRENT_WRITES = 10; // Concurrent write requests

// Track statistics
const writeStats = {
  latencies: [],
  errors: [],
  successCount: 0,
  totalCount: 0,
};

const readStats = {
  leaderboard: { latencies: [], errors: [], successCount: 0 },
  top100: { latencies: [], errors: [], successCount: 0 },
  playerRank: { latencies: [], errors: [], successCount: 0 },
  playerStats: { latencies: [], errors: [], successCount: 0 },
  gameModes: { latencies: [], errors: [], successCount: 0 },
};

// Helper function to make HTTP requests
function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const req = http.request(options, (res) => {
      let responseData = "";
      res.on("data", (chunk) => (responseData += chunk));
      res.on("end", () => {
        const latency = Date.now() - start;
        resolve({
          status: res.statusCode,
          latency,
          size: responseData.length,
          data: responseData,
          success: res.statusCode >= 200 && res.statusCode < 300,
        });
      });
    });

    req.on("error", (error) => {
      const latency = Date.now() - start;
      reject({ error: error.message, latency });
    });

    req.setTimeout(10000, () => {
      req.destroy();
      const latency = Date.now() - start;
      reject({ error: "Timeout", latency });
    });

    if (data) {
      req.write(data);
    }
    req.end();
  });
}

// Write Operations: Score Submission
async function testWriteOperations() {
  console.log("📝 Testing WRITE Operations (Score Submission)");
  console.log("=" .repeat(60));
  console.log(`   Iterations: ${WRITE_ITERATIONS}`);
  console.log(`   Concurrent: ${CONCURRENT_WRITES}`);
  console.log("");

  const playerIds = [];
  const startTime = Date.now();

  // Create concurrent write operations
  const writePromises = [];
  for (let i = 0; i < WRITE_ITERATIONS; i++) {
    const playerId = uuidv4();
    playerIds.push(playerId);

    const writePromise = (async () => {
      try {
        const score = Math.floor(Math.random() * 10000) + 1000;
        const data = JSON.stringify({
          playerId,
          username: `player${i}`,
          gameMode: (i % 3) + 1, // Cycle through game modes 1, 2, 3
          score,
          gameDurationSeconds: 300 + Math.floor(Math.random() * 100),
        });

        const result = await makeRequest(
          {
            hostname: "localhost",
            port: 3001,
            path: "/api/scores/submit",
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Content-Length": data.length,
            },
          },
          data
        );

        if (result.success && result.status === 202) {
          writeStats.latencies.push(result.latency);
          writeStats.successCount++;
        } else {
          writeStats.errors.push({ status: result.status, latency: result.latency });
        }
        writeStats.totalCount++;
      } catch (error) {
        writeStats.errors.push(error);
        writeStats.totalCount++;
      }
    })();

    writePromises.push(writePromise);

    // Limit concurrency
    if (writePromises.length >= CONCURRENT_WRITES) {
      await Promise.all(writePromises);
      writePromises.length = 0;
    }
  }

  // Wait for remaining writes
  await Promise.all(writePromises);

  const totalTime = Date.now() - startTime;
  const throughput = (writeStats.successCount / totalTime) * 1000;

  // Calculate statistics
  if (writeStats.latencies.length > 0) {
    writeStats.latencies.sort((a, b) => a - b);
    const avg = writeStats.latencies.reduce((a, b) => a + b, 0) / writeStats.latencies.length;
    const min = writeStats.latencies[0];
    const max = writeStats.latencies[writeStats.latencies.length - 1];
    const p50 = writeStats.latencies[Math.floor(writeStats.latencies.length * 0.5)];
    const p95 = writeStats.latencies[Math.floor(writeStats.latencies.length * 0.95)];
    const p99 = writeStats.latencies[Math.floor(writeStats.latencies.length * 0.99)];

    console.log("📊 Write Operation Results:");
    console.log(`   Total Requests: ${writeStats.totalCount}`);
    console.log(`   Successful: ${writeStats.successCount}`);
    console.log(`   Errors: ${writeStats.errors.length}`);
    console.log(`   Success Rate: ${((writeStats.successCount / writeStats.totalCount) * 100).toFixed(2)}%`);
    console.log(`   Total Time: ${(totalTime / 1000).toFixed(2)}s`);
    console.log(`   Throughput: ${throughput.toFixed(2)} writes/sec`);
    console.log("");
    console.log("⏱️  Write Latency Statistics:");
    console.log(`   Min: ${min}ms`);
    console.log(`   Avg: ${avg.toFixed(2)}ms`);
    console.log(`   Max: ${max}ms`);
    console.log(`   P50: ${p50}ms`);
    console.log(`   P95: ${p95}ms`);
    console.log(`   P99: ${p99}ms`);
    console.log("");
  } else {
    console.log("❌ No successful write operations");
  }

  return playerIds;
}

// Read Operations: Various endpoints
async function testReadOperations(playerIds) {
  console.log("📖 Testing READ Operations");
  console.log("=" .repeat(60));
  console.log(`   Iterations per endpoint: ${READ_ITERATIONS}`);
  console.log(`   Concurrent: ${CONCURRENT_READS}`);
  console.log("");

  const startTime = Date.now();

  // Test 1: Leaderboard endpoint
  await testReadEndpoint(
    "Leaderboard",
    `/api/leaderboard/1?limit=100&offset=0`,
    readStats.leaderboard,
    CONCURRENT_READS
  );

  // Test 2: Top 100 endpoint (CDN optimized)
  await testReadEndpoint(
    "Top 100 (CDN Optimized)",
    `/api/leaderboard/1/top100`,
    readStats.top100,
    CONCURRENT_READS
  );

  // Test 3: Player Rank
  if (playerIds.length > 0) {
    await testReadEndpoint(
      "Player Rank",
      (i) => `/api/players/${playerIds[i % playerIds.length]}/rank/1`,
      readStats.playerRank,
      CONCURRENT_READS,
      true // Dynamic path
    );
  }

  // Test 4: Player Stats
  if (playerIds.length > 0) {
    await testReadEndpoint(
      "Player Stats",
      (i) => `/api/players/${playerIds[i % playerIds.length]}/stats`,
      readStats.playerStats,
      CONCURRENT_READS,
      true // Dynamic path
    );
  }

  // Test 5: Game Modes
  await testReadEndpoint(
    "Game Modes",
    `/api/game-modes`,
    readStats.gameModes,
    CONCURRENT_READS
  );

  const totalTime = Date.now() - startTime;

  // Print summary
  console.log("📊 READ Operations Summary:");
  console.log("=" .repeat(60));
  printReadStats("Leaderboard", readStats.leaderboard);
  printReadStats("Top 100", readStats.top100);
  printReadStats("Player Rank", readStats.playerRank);
  printReadStats("Player Stats", readStats.playerStats);
  printReadStats("Game Modes", readStats.gameModes);

  const totalReads =
    readStats.leaderboard.successCount +
    readStats.top100.successCount +
    readStats.playerRank.successCount +
    readStats.playerStats.successCount +
    readStats.gameModes.successCount;

  console.log(`\n📈 Overall Read Performance:`);
  console.log(`   Total Successful Reads: ${totalReads}`);
  console.log(`   Total Time: ${(totalTime / 1000).toFixed(2)}s`);
  console.log(`   Overall Throughput: ${((totalReads / totalTime) * 1000).toFixed(2)} reads/sec`);
  console.log("");
}

async function testReadEndpoint(name, pathOrFn, stats, concurrency, isDynamic = false) {
  const readPromises = [];

  for (let i = 0; i < READ_ITERATIONS; i++) {
    const path = isDynamic ? pathOrFn(i) : pathOrFn;
    const readPromise = (async () => {
      try {
        const result = await makeRequest({
          hostname: "localhost",
          port: 3001,
          path,
          method: "GET",
        });

        if (result.success) {
          stats.latencies.push(result.latency);
          stats.successCount++;
        } else {
          stats.errors.push({ status: result.status, latency: result.latency });
        }
      } catch (error) {
        stats.errors.push(error);
      }
    })();

    readPromises.push(readPromise);

    // Limit concurrency
    if (readPromises.length >= concurrency) {
      await Promise.all(readPromises);
      readPromises.length = 0;
    }
  }

  // Wait for remaining reads
  await Promise.all(readPromises);
}

function printReadStats(name, stats) {
  if (stats.latencies.length === 0) {
    console.log(`\n   ${name}: ❌ No successful reads`);
    return;
  }

  stats.latencies.sort((a, b) => a - b);
  const avg = stats.latencies.reduce((a, b) => a + b, 0) / stats.latencies.length;
  const min = stats.latencies[0];
  const max = stats.latencies[stats.latencies.length - 1];
  const p50 = stats.latencies[Math.floor(stats.latencies.length * 0.5)];
  const p95 = stats.latencies[Math.floor(stats.latencies.length * 0.95)];
  const p99 = stats.latencies[Math.floor(stats.latencies.length * 0.99)];

  const successRate = stats.latencies.length / (stats.latencies.length + stats.errors.length);

  console.log(`\n   ${name}:`);
  console.log(`      Success: ${stats.successCount} (${(successRate * 100).toFixed(2)}%)`);
  console.log(`      Errors: ${stats.errors.length}`);
  console.log(`      Latency - Min: ${min}ms, Avg: ${avg.toFixed(2)}ms, Max: ${max}ms`);
  console.log(`      Percentiles - P50: ${p50}ms, P95: ${p95}ms, P99: ${p99}ms`);
}

// Combined test with comparison
async function runCombinedTest() {
  console.log("🚀 Read/Write Latency Test");
  console.log("=" .repeat(60));
  console.log("");

  // Wait a bit for server to be ready
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Test write operations first (to populate data)
  console.log("Phase 1: WRITE Operations\n");
  const playerIds = await testWriteOperations();

  // Wait for writes to be processed
  console.log("⏳ Waiting 3 seconds for writes to be processed...\n");
  await new Promise((resolve) => setTimeout(resolve, 3000));

  // Test read operations
  console.log("Phase 2: READ Operations\n");
  await testReadOperations(playerIds);

  // Final comparison
  console.log("📊 READ vs WRITE Comparison");
  console.log("=" .repeat(60));

  if (writeStats.latencies.length > 0) {
    const writeAvg =
      writeStats.latencies.reduce((a, b) => a + b, 0) / writeStats.latencies.length;
    const writeP95 = writeStats.latencies[Math.floor(writeStats.latencies.length * 0.95)];

    console.log("\n✍️  WRITE Operations:");
    console.log(`   Average Latency: ${writeAvg.toFixed(2)}ms`);
    console.log(`   P95 Latency: ${writeP95}ms`);
    console.log(`   Total Writes: ${writeStats.successCount}`);
  }

  // Calculate overall read stats
  const allReadLatencies = [
    ...readStats.leaderboard.latencies,
    ...readStats.top100.latencies,
    ...readStats.playerRank.latencies,
    ...readStats.playerStats.latencies,
    ...readStats.gameModes.latencies,
  ];

  if (allReadLatencies.length > 0) {
    allReadLatencies.sort((a, b) => a - b);
    const readAvg = allReadLatencies.reduce((a, b) => a + b, 0) / allReadLatencies.length;
    const readP95 = allReadLatencies[Math.floor(allReadLatencies.length * 0.95)];

    console.log("\n📖 READ Operations:");
    console.log(`   Average Latency: ${readAvg.toFixed(2)}ms`);
    console.log(`   P95 Latency: ${readP95}ms`);
    console.log(`   Total Reads: ${allReadLatencies.length}`);
  }

  // Performance targets
  console.log("\n🎯 Performance Targets:");
  console.log("=" .repeat(60));
  if (writeStats.latencies.length > 0) {
    const writeAvg =
      writeStats.latencies.reduce((a, b) => a + b, 0) / writeStats.latencies.length;
    console.log(`   Write Avg < 100ms: ${writeAvg < 100 ? "✅" : "❌"} (${writeAvg.toFixed(2)}ms)`);
    const writeP95 = writeStats.latencies[Math.floor(writeStats.latencies.length * 0.95)];
    console.log(`   Write P95 < 200ms: ${writeP95 < 200 ? "✅" : "❌"} (${writeP95}ms)`);
  }

  if (allReadLatencies.length > 0) {
    const readAvg = allReadLatencies.reduce((a, b) => a + b, 0) / allReadLatencies.length;
    console.log(`   Read Avg < 50ms: ${readAvg < 50 ? "✅" : "❌"} (${readAvg.toFixed(2)}ms)`);
    const readP95 = allReadLatencies[Math.floor(allReadLatencies.length * 0.95)];
    console.log(`   Read P95 < 100ms: ${readP95 < 100 ? "✅" : "❌"} (${readP95}ms)`);
  }

  console.log("\n✅ Test complete!");
}

// Run the test
runCombinedTest().catch((error) => {
  console.error("❌ Test failed:", error);
  process.exit(1);
});

