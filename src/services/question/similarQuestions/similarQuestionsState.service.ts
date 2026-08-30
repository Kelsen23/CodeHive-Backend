import mongoose from "mongoose";

import type { RetrievalCandidate } from "./retrieval/retrieval.types.js";

import { currentLiveEligibleQuestionMatch } from "./similarQuestions.shared.js";

import Question from "../../../models/question.model.js";
import SimilarQuestion from "../../../models/similarQuestion.model.js";

type LockedSimilarQuestionsQuestion = {
  _id: unknown;
  userId: unknown;
};

const lockQuestionForSimilarQuestions = async (
  questionId: string,
  version: number,
) =>
  Question.findOneAndUpdate(
    {
      _id: new mongoose.Types.ObjectId(questionId),
      currentVersion: version,
      ...currentLiveEligibleQuestionMatch,
      embeddingStatus: "READY",
      similarQuestionsStatus: { $in: ["NONE", "PENDING"] },
    },
    { $set: { similarQuestionsStatus: "PROCESSING" } },
    { returnDocument: "after" },
  ).lean<LockedSimilarQuestionsQuestion>();

const resetSimilarQuestionsProcessing = async (
  questionId: string,
  version: number,
) =>
  Question.updateOne(
    {
      _id: questionId,
      currentVersion: version,
      similarQuestionsStatus: "PROCESSING",
    },
    {
      $set: {
        similarQuestionsStatus: "NONE",
        similarQuestionsComputedAt: null,
        similarQuestionsComputedVersion: null,
      },
    },
  );

const invalidateSimilarQuestions = async (
  questionId: string,
  version: number,
) =>
  Question.updateOne(
    { _id: questionId, currentVersion: version },
    {
      $set: {
        similarQuestionsStatus: "NONE",
        similarQuestionsComputedAt: null,
        similarQuestionsComputedVersion: null,
      },
    },
  );

const finalizeSimilarQuestions = async ({
  questionId,
  version,
  candidates,
  retrievalVersion,
}: {
  questionId: string;
  version: number;
  candidates: RetrievalCandidate[];
  retrievalVersion: string;
}) => {
  const materializedCandidates = candidates.slice(0, 15);
  const session = await mongoose.startSession();
  const computedAt = new Date();

  try {
    let updateResult;

    await session.withTransaction(async () => {
      const source = await Question.findOne({
        _id: questionId,
        currentVersion: version,
        ...currentLiveEligibleQuestionMatch,
        embeddingStatus: "READY",
        similarQuestionsStatus: "PROCESSING",
      })
        .select("_id")
        .session(session)
        .lean();

      if (!source) return;

      await SimilarQuestion.deleteMany(
        {
          sourceQuestionId: questionId,
          sourceVersion: version,
          retrievalVersion,
        },
        { session },
      );

      if (materializedCandidates.length) {
        const sourceQuestionObjectId = new mongoose.Types.ObjectId(questionId);

        await SimilarQuestion.insertMany(
          materializedCandidates.map((candidate, index) => ({
            sourceQuestionId: sourceQuestionObjectId,
            sourceVersion: version,
            targetQuestionId: new mongoose.Types.ObjectId(candidate.questionId),
            targetVersion: candidate.version,
            rank: index + 1,
            score: candidate.score,
            retrievalVersion,
            model: candidate.model,
            representationVersion: candidate.representationVersion,
            computedAt,
          })),
          { session, ordered: true },
        );
      }

      updateResult = await Question.updateOne(
        {
          _id: questionId,
          currentVersion: version,
          similarQuestionsStatus: "PROCESSING",
        },
        {
          $set: {
            similarQuestionsStatus: "READY",
            similarQuestionsComputedAt: computedAt,
            similarQuestionsComputedVersion: version,
          },
        },
        { session },
      );
    });

    if (!updateResult) {
      await resetSimilarQuestionsProcessing(questionId, version);
    }

    return updateResult ?? { modifiedCount: 0 };
  } finally {
    await session.endSession();
  }
};

const loadReadyQuestionForSimilarSideEffects = async (
  questionId: string,
  version: number,
) =>
  Question.findOne({
    _id: questionId,
    currentVersion: version,
    ...currentLiveEligibleQuestionMatch,
    embeddingStatus: "READY",
    similarQuestionsStatus: "READY",
  })
    .select("userId")
    .lean<{
      userId: unknown;
    }>();

export {
  finalizeSimilarQuestions,
  invalidateSimilarQuestions,
  loadReadyQuestionForSimilarSideEffects,
  lockQuestionForSimilarQuestions,
  resetSimilarQuestionsProcessing,
  type LockedSimilarQuestionsQuestion,
};
