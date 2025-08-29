import { Redis } from "ioredis";

let redisClient: Redis;

const connectRedis = async (redisUrl?: string) => {
  redisClient = new Redis(redisUrl || "redis://localhost:6379");

  try {
    await redisClient.ping();
    console.log("Redis connection established 🔴");
  } catch (error) {
    console.error("Failed to connect to Redis ❌:", error);
    process.exit(1);
  }
};

export { connectRedis, redisClient };
