import { Redis } from "ioredis";

import dotenv from "dotenv";
dotenv.config();

const redisClient = new Redis(
  process.env.REDIS_CACHE_URL || "redis://localhost:6379",
);

const redisConnection = {
  url: process.env.REDIS_MESSAGING_URL || "redis://localhost:6379",
};

const checkRedisConnection = async () => {
  try {
    await redisClient.ping();
    console.log("Redis connection established 🟥");
  } catch (error) {
    console.error("Failed to connect to Redis ❌:", error);
    process.exit(1);
  }
};

export { redisClient, redisConnection, checkRedisConnection };
