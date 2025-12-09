const http = require('http');

const BASE_URL = 'http://localhost:3001';
const TARGET_RPS = 100; // Start with 100, can increase
const DURATION = 30; // seconds
const ENDPOINT = '/api/scores/submit';

let requestCount = 0;
let successCount = 0;
let errorCount = 0;
const responseTimes = [];
const startTime = Date.now();

function submitScore(playerId) {
  return new Promise((resolve, reject) => {
    const reqStart = Date.now();
    const data = JSON.stringify({
      playerId: `load-test-${playerId}`,
      username: `user${playerId}`,
      gameMode: 1,
      score: Math.floor(Math.random() * 10000) + 1000,
      gameDurationSeconds: 300
    });

    const req = http.request({
      hostname: 'localhost',
      port: 3001,
      path: ENDPOINT,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      },
      timeout: 5000
    }, (res) => {
      const duration = Date.now() - reqStart;
      responseTimes.push(duration);
      requestCount++;
      
      let responseData = '';
      res.on('data', chunk => responseData += chunk);
      res.on('end', () => {
        if (res.statusCode === 202) {
          successCount++;
        } else {
          errorCount++;
        }
        resolve({ status: res.statusCode, duration });
      });
    });

    req.on('error', (error) => {
      errorCount++;
      requestCount++;
      reject(error);
    });

    req.on('timeout', () => {
      req.destroy();
      errorCount++;
      requestCount++;
      reject(new Error('Timeout'));
    });

    req.write(data);
    req.end();
  });
}

async function runThroughputTest() {
  console.log(`🚀 Score Submission Throughput Test`);
  console.log(`   Target: ${TARGET_RPS} requests/second`);
  console.log(`   Duration: ${DURATION} seconds`);
  console.log(`   Expected Total: ~${TARGET_RPS * DURATION} requests\n`);
  
  const interval = 1000 / TARGET_RPS; // ms between requests
  let playerId = 0;
  const endTime = startTime + (DURATION * 1000);

  const submitInterval = setInterval(() => {
    if (Date.now() >= endTime) {
      clearInterval(submitInterval);
      return;
    }

    submitScore(playerId++).catch(() => {});
  }, interval);

  // Wait for test to complete + buffer
  await new Promise(resolve => setTimeout(resolve, (DURATION + 5) * 1000));
  
  printResults();
}

function printResults() {
  const totalTime = (Date.now() - startTime) / 1000;
  const actualRPS = requestCount / totalTime;
  const successRate = requestCount > 0 ? (successCount / requestCount) * 100 : 0;
  
  let avgResponseTime = 0;
  let p95 = 0;
  let p99 = 0;
  
  if (responseTimes.length > 0) {
    responseTimes.sort((a, b) => a - b);
    avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    p95 = responseTimes[Math.floor(responseTimes.length * 0.95)];
    p99 = responseTimes[Math.floor(responseTimes.length * 0.99)];
  }

  console.log('\n📊 Results:');
  console.log(`   Total Requests: ${requestCount}`);
  console.log(`   Successful: ${successCount}`);
  console.log(`   Errors: ${errorCount}`);
  console.log(`   Success Rate: ${successRate.toFixed(2)}%`);
  console.log(`   Actual RPS: ${actualRPS.toFixed(2)}`);
  console.log(`   Avg Response Time: ${avgResponseTime.toFixed(2)}ms`);
  if (responseTimes.length > 0) {
    console.log(`   P95 Response Time: ${p95}ms`);
    console.log(`   P99 Response Time: ${p99}ms`);
  }
  console.log('\n🎯 Targets:');
  console.log(`   RPS: ${TARGET_RPS} ${actualRPS >= TARGET_RPS * 0.9 ? '✅' : '❌'}`);
  console.log(`   Avg Response Time: < 100ms ${avgResponseTime <= 100 ? '✅' : '❌'}`);
  console.log(`   Success Rate: > 99% ${successRate >= 99 ? '✅' : '❌'}`);
}

runThroughputTest().catch(console.error);
