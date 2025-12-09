#!/bin/bash
# Helper script for Windows/Git Bash to run Kafka commands
# Usage: ./scripts/kafka-topics.sh --list
# Usage: ./scripts/kafka-topics.sh --describe --topic score-submitted

docker exec gaming-leaderboard-kafka sh -c "/opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 $@"

