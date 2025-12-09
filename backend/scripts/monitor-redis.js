const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

async function getRedisInfo() {
  try {
    const { stdout } = await execPromise(
      'docker exec gaming-leaderboard-redis redis-cli INFO stats'
    );
    
    const lines = stdout.split('\n');
    const stats = {};
    
    lines.forEach(line => {
      const match = line.match(/^([^:]+):(.+)$/);
      if (match) {
        stats[match[1]] = match[2];
      }
    });
    
    return stats;
  } catch (error) {
    console.error('Error getting Redis info:', error.message);
    return null;
  }
}

async function getRedisMemory() {
  try {
    const { stdout } = await execPromise(
      'docker exec gaming-leaderboard-redis redis-cli INFO memory'
    );
    
    const lines = stdout.split('\n');
    const memory = {};
    
    lines.forEach(line => {
      const match = line.match(/^([^:]+):(.+)$/);
      if (match) {
        memory[match[1]] = match[2];
      }
    });
    
    return memory;
  } catch (error) {
    console.error('Error getting Redis memory:', error.message);
    return null;
  }
}

async function getLeaderboardSize() {
  try {
    const { stdout } = await execPromise(
      'docker exec gaming-leaderboard-redis redis-cli ZCARD leaderboard:1:global'
    );
    return parseInt(stdout.trim());
  } catch (error) {
    return null;
  }
}

async function monitorRedis() {
  console.log('📊 Redis Performance Monitor\n');
  
  const stats = await getRedisInfo();
  const memory = await getRedisMemory();
  const leaderboardSize = await getLeaderboardSize();
  
  if (stats) {
    console.log('📈 Statistics:');
    console.log(`   Total Commands Processed: ${stats.total_commands_processed || 'N/A'}`);
    console.log(`   Instantaneous Ops Per Sec: ${stats.instantaneous_ops_per_sec || 'N/A'}`);
    console.log(`   Total Connections: ${stats.total_connections_received || 'N/A'}`);
    console.log(`   Keyspace Hits: ${stats.keyspace_hits || 'N/A'}`);
    console.log(`   Keyspace Misses: ${stats.keyspace_misses || 'N/A'}`);
    
    if (stats.keyspace_hits && stats.keyspace_misses) {
      const hits = parseInt(stats.keyspace_hits);
      const misses = parseInt(stats.keyspace_misses);
      const hitRate = (hits / (hits + misses)) * 100;
      console.log(`   Hit Rate: ${hitRate.toFixed(2)}%`);
    }
  }
  
  if (memory) {
    console.log('\n💾 Memory:');
    console.log(`   Used Memory: ${memory.used_memory_human || 'N/A'}`);
    console.log(`   Used Memory Peak: ${memory.used_memory_peak_human || 'N/A'}`);
    console.log(`   Max Memory: ${memory.maxmemory_human || 'N/A'}`);
  }
  
  if (leaderboardSize !== null) {
    console.log(`\n🏆 Leaderboard Size: ${leaderboardSize} players`);
  }
  
  console.log('');
}

monitorRedis().catch(console.error);

