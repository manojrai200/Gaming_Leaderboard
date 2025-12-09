#!/bin/bash
# Helper script to consume messages from a Kafka topic
# Usage: ./scripts/kafka-consumer.sh score-submitted

TOPIC=${1:-score-submitted}

docker exec -it gaming-leaderboard-kafka sh -c "/opt/kafka/bin/kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic $TOPIC --from-beginning"

