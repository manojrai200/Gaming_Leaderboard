const { kafka } = require("./db");
const { KAFKA_BROKERS } = require("./config");

const createTopics = async () => {
  const admin = kafka.admin();

  try {
    await admin.connect();
    console.log("✅ Connected to Kafka admin");

    const topics = [
      {
        topic: "score-submitted",
        numPartitions: 10, // For high throughput
        replicationFactor: 1, // Single broker setup
        configEntries: [
          { name: "retention.ms", value: "604800000" }, // 7 days
        ],
      },
      {
        topic: "leaderboard-updated",
        numPartitions: 3,
        replicationFactor: 1, // Single broker setup
      },
      {
        topic: "cheat-detected",
        numPartitions: 3,
        replicationFactor: 1, // Single broker setup
      },
      {
        topic: "player-achievements",
        numPartitions: 3,
        replicationFactor: 1, // Single broker setup
      },
    ];

    await admin.createTopics({
      topics: topics,
      waitForLeaders: true,
    });

    console.log("✅ Topics created successfully:");
    topics.forEach((t) => {
      console.log(
        `   - ${t.topic} (${t.numPartitions} partitions, ${t.replicationFactor} replicas)`
      );
    });

    await admin.disconnect();
  } catch (error) {
    console.error("❌ Error creating topics:", error);
    process.exit(1);
  }
};

// Run if called directly
if (require.main === module) {
  createTopics()
    .then(() => {
      console.log("✅ Setup complete");
      process.exit(0);
    })
    .catch((err) => {
      console.error("❌ Setup failed:", err);
      process.exit(1);
    });
}

module.exports = { createTopics };
