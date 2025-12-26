import { Queue } from "bullmq";
import { redisMessagingClientConnection } from "../../config/redis.js";

const resetPasswordQueue = new Queue("resetPasswordQueue", {
  connection: redisMessagingClientConnection,
});

export default resetPasswordQueue;
