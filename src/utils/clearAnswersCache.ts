import { redisClient } from "../config/redis.js";

async function clearAnswerCache(questionId: string) {
  let cursor = "0";

  do {
    const [nextCursor, keys] = await redisClient.scan(
      cursor,
      "MATCH",
      `answers:${questionId}*`,
      "COUNT",
      "100",
    );

    cursor = nextCursor;

    if (keys.length > 0) {
      await redisClient.del(...keys);
    }
  } while (cursor !== "0");
}

export default clearAnswerCache;
