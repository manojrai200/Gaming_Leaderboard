// Test setup file
// This runs before all tests

// Mock environment variables
process.env.NODE_ENV = "test";
process.env.REDIS_HOST = "localhost";
process.env.REDIS_PORT = "6379";
process.env.KAFKA_BROKERS = "localhost:9092";
process.env.PORT = "3002";

// Suppress console logs during tests (optional)
// global.console = {
//   ...console,
//   log: jest.fn(),
//   debug: jest.fn(),
//   info: jest.fn(),
//   warn: jest.fn(),
//   error: jest.fn(),
// };

