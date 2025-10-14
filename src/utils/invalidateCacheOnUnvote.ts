import { redisClient } from "../config/redis.js";
import Answer from "../models/answerModel.js";
import Reply from "../models/replyModel.js";

async function invalidateCacheOnUnvote(
  targetType: "Question" | "Answer" | "Reply",
  targetId: string,
) {
  if (targetType === "Question") {
    await redisClient.del(`question:${targetId}`);
  } else if (targetType === "Answer") {
    const foundAnswer = await Answer.findById(targetId);

    if (foundAnswer)
      await redisClient.del(`question:${foundAnswer.questionId}`);
  } else if (targetType === "Reply") {
    const foundReply = await Reply.findById(targetId);

    if (foundReply) {
      const foundAnswer = await Answer.findById(foundReply.answerId);

      if (foundAnswer)
        await redisClient.del(`question:${foundAnswer.questionId}`);
    }
  }
}

export default invalidateCacheOnUnvote;
