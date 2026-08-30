import type { SimilarQuestionsJobData } from "../similarQuestions/similarQuestions.shared.js";

import runSimilarQuestionsReadySideEffects from "../similarQuestions/similarQuestionsSideEffects.service.js";
import findDenseQuestionCandidates from "../similarQuestions/similarQuestionsSearch.service.js";
import {
  finalizeSimilarQuestions,
  loadReadyQuestionForSimilarSideEffects,
  lockQuestionForSimilarQuestions,
  resetSimilarQuestionsProcessing,
} from "../similarQuestions/similarQuestionsState.service.js";
import { denseCandidateLimit } from "../similarQuestions/similarQuestions.shared.js";

import QuestionEmbedding from "../../../models/questionEmbedding.model.js";
import QuestionVersion from "../../../models/questionVersion.model.js";
import SimilarQuestion from "../../../models/similarQuestion.model.js";

const similarQuestionsRetrievalVersion = "dense-v1";

const runReadySideEffectsIfCurrent = async ({
  questionId,
  version,
  userId,
  candidates,
}: {
  questionId: string;
  version: number;
  userId?: unknown;
  candidates?: Awaited<ReturnType<typeof findDenseQuestionCandidates>>;
}) => {
  const readyQuestion =
    userId && candidates
      ? { userId, candidates }
      : await loadReadyQuestionForSimilarSideEffects(questionId, version);

  if (!readyQuestion) return;

  const readyCandidates =
    candidates ??
    (
      await SimilarQuestion.find({
        sourceQuestionId: questionId,
        sourceVersion: version,
        retrievalVersion: similarQuestionsRetrievalVersion,
      })
        .sort({ rank: 1 })
        .select("targetQuestionId")
        .lean()
    ).map((candidate) => String(candidate.targetQuestionId));

  await runSimilarQuestionsReadySideEffects({
    questionId,
    version,
    userId: String(readyQuestion.userId),
    similarQuestionIds: Array.isArray(readyCandidates)
      ? readyCandidates.map((candidate) =>
          typeof candidate === "string"
            ? candidate
            : String(candidate.questionId),
        )
      : [],
  });
};

const processSimilarQuestionSearchJob = async ({
  questionId,
  version,
}: SimilarQuestionsJobData) => {
  const locked = await lockQuestionForSimilarQuestions(questionId, version);

  if (!locked) {
    await runReadySideEffectsIfCurrent({ questionId, version });
    return;
  }

  const embeddingDocument = await QuestionEmbedding.findOne({
    questionId,
    version,
    representationVersion: "dense-v1",
  }).lean();
  const embedding = embeddingDocument?.vector;

  if (!Array.isArray(embedding) || embedding.length === 0) {
    await resetSimilarQuestionsProcessing(questionId, version);
    return;
  }

  const questionVersion = await QuestionVersion.findOne({
    questionId,
    version,
    isActive: true,
  })
    .select("title body tags")
    .lean<{
      title: string;
      body: string;
      tags?: string[];
    }>();

  if (!questionVersion) {
    await resetSimilarQuestionsProcessing(questionId, version);
    return;
  }

  let candidates: Awaited<ReturnType<typeof findDenseQuestionCandidates>>;

  try {
    candidates = await findDenseQuestionCandidates({
      sourceQuestionId: questionId,
      sourceVersion: version,
      title: questionVersion.title,
      body: questionVersion.body,
      tags: Array.isArray(questionVersion.tags) ? questionVersion.tags : [],
      limit: denseCandidateLimit,
      queryVector: embedding,
      model: embeddingDocument?.model,
    });
  } catch (error) {
    await resetSimilarQuestionsProcessing(questionId, version);
    throw error;
  }

  const updated = await finalizeSimilarQuestions({
    questionId,
    version,
    candidates: candidates.slice(0, 15),
    retrievalVersion: similarQuestionsRetrievalVersion,
  });

  if (updated.modifiedCount === 0) return;

  await runReadySideEffectsIfCurrent({
    questionId,
    version,
    userId: locked.userId,
    candidates: candidates.slice(0, 15),
  });
};

export default processSimilarQuestionSearchJob;
