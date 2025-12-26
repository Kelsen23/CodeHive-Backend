import { Queue } from "bullmq";
import { redisMessagingClientConnection } from "../../config/redis.js";

const verificationQueue = new Queue("verificationQueue", {
  connection: redisMessagingClientConnection,
});

export default verificationQueue;
