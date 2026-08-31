import { queueQuestionPipelineStep } from "../pipelineRouter/pipelineRouting.service.js";
import { currentEligibleQuestionMatch } from "./similarQuestions.shared.js";

import Question from "../../../models/question.model.js";

const similarQuestionsFreshnessMs = 12 * 60 * 60 * 1000;
const similarQuestionsSchedulerBatchSize = 100;

const discoverStaleSimilarQuestions = async (now = new Date()) => {
  const staleBefore = new Date(now.getTime() - similarQuestionsFreshnessMs);

  return Question.find({
    ...currentEligibleQuestionMatch,
    $and: [
      { similarQuestionsStatus: { $ne: "PROCESSING" } },
      {
        $or: [
          {
            $expr: {
              $ne: ["$similarQuestionsComputedVersion", "$currentVersion"],
            },
          },
          { similarQuestionsComputedAt: null },
          { similarQuestionsComputedAt: { $lt: staleBefore } },
          { similarQuestionsStatus: { $in: ["NONE", "PENDING"] } },
        ],
      },
    ],
  })
    .sort({ similarQuestionsComputedAt: 1, _id: 1 })
    .limit(similarQuestionsSchedulerBatchSize)
    .select("_id currentVersion similarQuestionsStatus")
    .lean<
      {
        _id: unknown;
        currentVersion: number;
        similarQuestionsStatus: "NONE" | "PENDING" | "READY";
      }[]
    >();
};

const scheduleStaleSimilarQuestions = async () => {
  const staleQuestions = await discoverStaleSimilarQuestions();
  let queued = 0;

  for (const question of staleQuestions) {
    const questionId = String(question._id);
    const claim = await Question.updateOne(
      {
        _id: question._id,
        currentVersion: question.currentVersion,
        ...currentEligibleQuestionMatch,
        similarQuestionsStatus: { $in: ["NONE", "READY"] },
      },
      {
        $set: {
          similarQuestionsStatus: "PENDING",
          similarQuestionsComputedVersion: null,
        },
      },
    );

    if (
      claim.matchedCount === 0 &&
      question.similarQuestionsStatus !== "PENDING"
    ) {
      continue;
    }

    try {
      await queueQuestionPipelineStep({
        questionId,
        version: question.currentVersion,
        step: "SIMILAR",
        refresh: true,
      });
      queued += 1;
    } catch (error) {
      if (claim.matchedCount > 0) {
        await Question.updateOne(
          {
            _id: question._id,
            currentVersion: question.currentVersion,
            similarQuestionsStatus: "PENDING",
          },
          { $set: { similarQuestionsStatus: "NONE" } },
        );
      }

      throw error;
    }
  }

  return { discovered: staleQuestions.length, queued };
};

export {
  discoverStaleSimilarQuestions,
  scheduleStaleSimilarQuestions,
  similarQuestionsFreshnessMs,
  similarQuestionsSchedulerBatchSize,
};
