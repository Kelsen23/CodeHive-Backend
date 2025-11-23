import { Queue } from "bullmq";
import { redisConnection } from "../config/redis.js";

const verificationQueue = new Queue("verificationQueue", {
  connection: redisConnection,
});

export default verificationQueue;
