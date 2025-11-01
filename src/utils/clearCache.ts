import { redisClient } from "../config/redis.js";

async function deleteKeysByPattern(pattern: string) {
  let cursor = "0";
  do {
    const [nextCursor, keys] = await redisClient.scan(
      cursor,
      "MATCH",
      pattern,
      "COUNT",
      "100",
    );
    cursor = nextCursor;
    if (keys.length) await redisClient.del(...keys);
  } while (cursor !== "0");
}

async function clearAnswerCache(questionId: string) {
  await deleteKeysByPattern(`answers:${questionId}*`);
}

async function clearReplyCache(answerId: string) {
  await deleteKeysByPattern(`replies:${answerId}*`);
}

export { clearAnswerCache, clearReplyCache };
