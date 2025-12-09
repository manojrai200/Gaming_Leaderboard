#!/bin/bash
# Monitor Kafka consumer lag

echo "📊 Kafka Consumer Lag Monitor"
echo "============================="
echo ""

docker exec gaming-leaderboard-kafka /opt/kafka/bin/kafka-consumer-groups.sh \
  --bootstrap-server localhost:9092 \
  --group leaderboard-updater \
  --describe 2>/dev/null || echo "Consumer group not found or Kafka not ready"

echo ""
echo "Topic Partitions:"
docker exec gaming-leaderboard-kafka /opt/kafka/bin/kafka-topics.sh \
  --bootstrap-server localhost:9092 \
  --describe \
  --topic score-submitted 2>/dev/null | head -5

