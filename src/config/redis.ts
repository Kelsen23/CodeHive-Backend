import { Redis } from "ioredis";

const redisClient = new Redis(
  process.env.REDIS_URL || "redis://localhost:6379",
);

const redisConnection = {
  url: process.env.REDIS_URL,
};

const checkRedisConnection = async () => {
  try {
    await redisClient.ping();
    console.log("Redis connection established 🔴");
  } catch (error) {
    console.error("Failed to connect to Redis ❌:", error);
    process.exit(1);
  }
};

export { redisClient, redisConnection, checkRedisConnection };
