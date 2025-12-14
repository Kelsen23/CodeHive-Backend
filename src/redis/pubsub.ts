import dotenv from "dotenv";
dotenv.config();

import { Redis } from "ioredis";

const redisPub = new Redis(process.env.REDIS_URL || "redis://localhost:6379");
const redisSub = new Redis(process.env.REDIS_URL || "redis://localhost:6379");

redisPub.on("connect", () => {
  console.log("Redis PUB connected");
});

redisSub.on("connect", () => {
  console.log("Redis SUB connected");
});

export { redisPub, redisSub };
