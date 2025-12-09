const redisService = require("../../../services/redisService");

// Mock Redis
jest.mock("../../../util/db", () => ({
  redis: {
    hgetall: jest.fn(),
    exists: jest.fn(),
    pipeline: jest.fn(() => ({
      hset: jest.fn().mockReturnThis(),
      hincrby: jest.fn().mockReturnThis(),
      exec: jest.fn(),
    })),
    zincrby: jest.fn(),
    expire: jest.fn(),
    zcard: jest.fn(),
    zrevrange: jest.fn(),
    zrevrank: jest.fn(),
    zscore: jest.fn(),
    hget: jest.fn(),
    hgetall: jest.fn(),
    scan: jest.fn(),
  },
}));

describe("RedisService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getPlayer", () => {
    it("should return player data when player exists", async () => {
      const { redis } = require("../../../util/db");
      redis.hgetall.mockResolvedValue({
        username: "testuser",
        total_score: "1000",
        games_played: "5",
        created_at: "2024-01-01T00:00:00Z",
      });

      const player = await redisService.getPlayer("player-123");
      expect(player).toEqual({
        id: "player-123",
        username: "testuser",
        total_score: 1000,
        games_played: 5,
        created_at: "2024-01-01T00:00:00Z",
      });
    });

    it("should return null when player does not exist", async () => {
      const { redis } = require("../../../util/db");
      redis.hgetall.mockResolvedValue({});

      const player = await redisService.getPlayer("player-123");
      expect(player).toBeNull();
    });
  });

  describe("getWeekIdentifier", () => {
    it("should return week identifier in correct format", () => {
      const weekId = redisService.getWeekIdentifier();
      expect(weekId).toMatch(/^\d{4}-W\d{2}$/);
    });
  });
});

