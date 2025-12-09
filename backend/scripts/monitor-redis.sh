#!/bin/bash
# Monitor Redis performance during load tests

echo "📊 Redis Performance Monitor"
echo "============================"
echo ""

echo "Memory Usage:"
docker exec gaming-leaderboard-redis redis-cli INFO memory | grep -E "used_memory_human|used_memory_peak_human"
echo ""

echo "Operations per second:"
docker exec gaming-leaderboard-redis redis-cli INFO stats | grep -E "instantaneous_ops_per_sec|total_commands_processed"
echo ""

echo "Keyspace:"
docker exec gaming-leaderboard-redis redis-cli INFO keyspace
echo ""

echo "Connected Clients:"
docker exec gaming-leaderboard-redis redis-cli INFO clients | grep connected_clients
echo ""

