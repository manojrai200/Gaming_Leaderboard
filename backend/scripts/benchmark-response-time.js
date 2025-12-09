const http = require('http');

const BASE_URL = 'http://localhost:3001';
const ITERATIONS = 100;

function makeRequest(path) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const req = http.get(`${BASE_URL}${path}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const duration = Date.now() - start;
        resolve({ 
          status: res.statusCode, 
          duration, 
          size: data.length,
          success: res.statusCode === 200 || res.statusCode === 202
        });
      });
    });
    req.on('error', reject);
    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error('Timeout'));
    });
  });
}

async function benchmarkEndpoint(name, path, target) {
  console.log(`📊 Testing ${name}`);
  console.log(`   Endpoint: ${path}`);
  
  const results = [];
  const errors = [];

  for (let i = 0; i < ITERATIONS; i++) {
    try {
      const result = await makeRequest(path);
      if (result.success) {
        results.push(result.duration);
      } else {
        errors.push(result);
      }
    } catch (error) {
      errors.push(error);
    }
  }

  if (results.length === 0) {
    console.log(`   ❌ All requests failed (${errors.length} errors)`);
    return;
  }

  results.sort((a, b) => a - b);
  const avg = results.reduce((a, b) => a + b, 0) / results.length;
  const min = results[0];
  const max = results[results.length - 1];
  const p50 = results[Math.floor(results.length * 0.5)];
  const p95 = results[Math.floor(results.length * 0.95)];
  const p99 = results[Math.floor(results.length * 0.99)];

  console.log(`   ✅ Success: ${results.length}/${ITERATIONS} requests`);
  console.log(`   Min: ${min}ms`);
  console.log(`   Avg: ${avg.toFixed(2)}ms`);
  console.log(`   Max: ${max}ms`);
  console.log(`   P50: ${p50}ms`);
  console.log(`   P95: ${p95}ms`);
  console.log(`   P99: ${p99}ms`);
  if (target) {
    const status = avg <= target ? '✅' : '⚠️';
    console.log(`   Target: ${target}ms ${status}`);
  }
  if (errors.length > 0) {
    console.log(`   ⚠️  Errors: ${errors.length}`);
  }
  console.log('');
}

async function runBenchmarks() {
  console.log('⏱️  Response Time Benchmark');
  console.log('============================\n');

  // Test Leaderboard Fetch
  await benchmarkEndpoint(
    'Leaderboard Fetch',
    '/api/leaderboard/1?limit=100',
    50 // Target: 50ms
  );

  // Test Player Rank
  await benchmarkEndpoint(
    'Player Rank',
    '/api/players/p1/rank/1',
    10 // Target: 10ms
  );

  // Test Player Stats
  await benchmarkEndpoint(
    'Player Stats',
    '/api/players/p1/stats',
    50 // Target: 50ms
  );

  // Test Game Modes
  await benchmarkEndpoint(
    'Game Modes',
    '/api/game-modes',
    10 // Target: 10ms
  );

  console.log('✅ Benchmark complete!');
}

runBenchmarks().catch(console.error);
