import { Queue } from "bullmq";
import { redisConnection } from "../../config/redis.js";

const resetPasswordQueue = new Queue("resetPasswordQueue", {
  connection: redisConnection,
});

export default resetPasswordQueue;
