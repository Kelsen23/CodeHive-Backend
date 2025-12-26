import { Redis } from "ioredis";

import dotenv from "dotenv";
dotenv.config();

const redisCacheClient = new Redis(
  process.env.REDIS_CACHE_URL || "redis://localhost:6379",
);

const redisMessagingClient = new Redis(
  process.env.REDIS_MESSAGING_URL || "redis://localhost:6379",
);

const redisMessagingClientConnection = {
  url: process.env.REDIS_MESSAGING_URL || "redis://localhost:6379",
};

const checkRedisConnection = async () => {
  try {
    await redisCacheClient.ping();
    await redisMessagingClient.ping();
    console.log("Redis connection established 🟥");
  } catch (error) {
    console.error("Failed to connect to Redis ❌:", error);
    process.exit(1);
  }
};

export {
  redisCacheClient,
  redisMessagingClient,
  redisMessagingClientConnection,
  checkRedisConnection,
};
