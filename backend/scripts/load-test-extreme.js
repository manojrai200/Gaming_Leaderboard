const http = require('http');

const BASE_URL = 'http://localhost:3001';
const CONCURRENT = 500; // Increased concurrency
const REQUESTS_PER_CLIENT = 200; // More requests per client
const ENDPOINT = '/api/leaderboard/1?limit=100';

function makeRequest() {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const req = http.get(`${BASE_URL}${ENDPOINT}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const duration = Date.now() - start;
        resolve({ status: res.statusCode, duration, size: data.length });
      });
    });
    req.on('error', reject);
    req.setTimeout(15000, () => {
      req.destroy();
      reject(new Error('Timeout'));
    });
  });
}

async function runLoadTest() {
  console.log(`🚀 Extreme Load Test`);
  console.log(`   ${CONCURRENT} concurrent clients`);
  console.log(`   ${REQUESTS_PER_CLIENT} requests per client`);
  console.log(`   Total: ${CONCURRENT * REQUESTS_PER_CLIENT} requests`);
  console.log(`   Endpoint: ${ENDPOINT}\n`);

  const results = [];
  const errors = [];
  const startTime = Date.now();

  // Create concurrent clients
  const clients = Array(CONCURRENT).fill().map(async () => {
    for (let i = 0; i < REQUESTS_PER_CLIENT; i++) {
      try {
        const result = await makeRequest();
        results.push(result);
      } catch (error) {
        errors.push({ error: error.message });
      }
    }
  });

  await Promise.all(clients);

  const totalTime = Date.now() - startTime;
  const totalRequests = results.length;
  const totalErrors = errors.length;

  // Calculate statistics
  const durations = results.map(r => r.duration);
  durations.sort((a, b) => a - b);
  
  const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
  const min = durations[0];
  const max = durations[durations.length - 1];
  const p50 = durations[Math.floor(durations.length * 0.5)];
  const p95 = durations[Math.floor(durations.length * 0.95)];
  const p99 = durations[Math.floor(durations.length * 0.99)];

  const rps = (totalRequests / totalTime) * 1000;
  const successRate = (totalRequests / (totalRequests + totalErrors)) * 100;

  console.log('📊 Results:');
  console.log(`   Total Requests: ${totalRequests}`);
  console.log(`   Errors: ${totalErrors}`);
  console.log(`   Total Time: ${(totalTime / 1000).toFixed(2)}s`);
  console.log(`   Requests/sec: ${rps.toFixed(2)}`);
  console.log(`   Success Rate: ${successRate.toFixed(2)}%`);
  console.log('\n⏱️  Response Times:');
  console.log(`   Min: ${min}ms`);
  console.log(`   Avg: ${avg.toFixed(2)}ms`);
  console.log(`   Max: ${max}ms`);
  console.log(`   P50: ${p50}ms`);
  console.log(`   P95: ${p95}ms`);
  console.log(`   P99: ${p99}ms`);
  console.log('\n✅ Extreme load test complete!');
}

runLoadTest().catch(console.error);

