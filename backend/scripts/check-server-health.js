#!/usr/bin/env node
/**
 * Quick script to check if the server is healthy before running load tests
 */

const http = require('http');

const BASE_URL = process.env.TARGET_URL || 'http://localhost:3001';
const TIMEOUT = 5000; // 5 seconds

function checkHealth() {
  return new Promise((resolve, reject) => {
    const url = new URL(`${BASE_URL}/health`);
    
    const req = http.request(url, { timeout: TIMEOUT }, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const health = JSON.parse(data);
          resolve({ statusCode: res.statusCode, health });
        } catch (e) {
          resolve({ statusCode: res.statusCode, raw: data });
        }
      });
    });
    
    req.on('error', (err) => {
      reject(err);
    });
    
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    
    req.end();
  });
}

async function main() {
  console.log(`🔍 Checking server health at ${BASE_URL}...\n`);
  
  try {
    const result = await checkHealth();
    
    console.log(`✅ Server is responding (HTTP ${result.statusCode})`);
    console.log('\n📊 Health Status:');
    console.log(JSON.stringify(result.health || result.raw, null, 2));
    
    if (result.health) {
      if (result.health.status === 'ok') {
        console.log('\n✅ Server is healthy and ready for load testing');
        process.exit(0);
      } else {
        console.log('\n⚠️  Server is degraded - some services may not be connected');
        console.log('   Check Redis and Kafka connections before running load tests');
        process.exit(1);
      }
    }
  } catch (error) {
    console.error(`❌ Server is not responding: ${error.message}`);
    console.error('\n💡 Make sure:');
    console.error('   1. The server is running (npm start)');
    console.error('   2. Redis is running and accessible');
    console.error('   3. Kafka is running and accessible');
    console.error('   4. The server is listening on the correct port');
    process.exit(1);
  }
}

main();

