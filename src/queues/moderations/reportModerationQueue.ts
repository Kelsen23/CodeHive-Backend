import { Queue } from "bullmq";
import { redisConnection } from "../../config/redis.js";

const reportModerationQueue = new Queue("reportModerationQueue", {
  connection: redisConnection,
});

export default reportModerationQueue;
