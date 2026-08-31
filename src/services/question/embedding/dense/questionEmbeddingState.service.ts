import mongoose from "mongoose";

import {
  denseRepresentationVersion,
  downstreamAllowedSecurityVerifierStatuses,
} from "./questionEmbedding.shared.js";

import Question from "../../../../models/question.model.js";
import QuestionVersion from "../../../../models/questionVersion.model.js";
import QuestionEmbedding from "../../../../models/questionEmbedding.model.js";

type LockedEmbeddingQuestion = {
  _id: unknown;
  userId: unknown;
};

type EmbeddingQuestionVersion = {
  title: string;
  body: string;
  tags: string[];
};

const lockQuestionForEmbedding = async (questionId: string, version: number) =>
  Question.findOneAndUpdate(
    {
      _id: questionId,
      currentVersion: version,
      isActive: true,
      isDeleted: false,
      moderationStatus: { $in: ["APPROVED", "FLAGGED"] },
      questionEligibilityStatus: "ALLOWED",
      securityVerifierStatus: {
        $in: downstreamAllowedSecurityVerifierStatuses,
      },
      embeddingStatus: "NONE",
    },
    { $set: { embeddingStatus: "PROCESSING" } },
    { returnDocument: "after" },
  ).lean<LockedEmbeddingQuestion>();

const loadCurrentQuestionVersionForEmbedding = async (
  questionId: string,
  version: number,
) =>
  QuestionVersion.findOne({
    questionId,
    version,
    isActive: true,
    moderationStatus: { $in: ["APPROVED", "FLAGGED"] },
  })
    .select("title body tags")
    .lean<EmbeddingQuestionVersion>();

const resetQuestionEmbeddingProcessing = async (
  questionId: string,
  version: number,
) =>
  Question.updateOne(
    {
      _id: questionId,
      currentVersion: version,
      embeddingStatus: "PROCESSING",
    },
    { $set: { embeddingStatus: "NONE" } },
  );

const finalizeQuestionEmbedding = async ({
  questionId,
  version,
  embedding,
  model,
}: {
  questionId: string;
  version: number;
  embedding: number[];
  model: string;
}) => {
  const session = await mongoose.startSession();
  let questionUpdated = false;

  try {
    const embeddingResult = await session.withTransaction(async () => {
      const result = await QuestionEmbedding.updateOne(
        {
          questionId,
          version,
          model,
          representationVersion: denseRepresentationVersion,
        },
        {
          $set: { vector: embedding, dimensions: embedding.length },
          $setOnInsert: {
            questionId,
            version,
            model,
            representationVersion: denseRepresentationVersion,
          },
        },
        { upsert: true, session },
      );

      if (result.acknowledged) {
        const questionUpdate = await Question.updateOne(
          {
            _id: questionId,
            currentVersion: version,
            isActive: true,
            isDeleted: false,
            moderationStatus: { $in: ["APPROVED", "FLAGGED"] },
            questionEligibilityStatus: "ALLOWED",
            securityVerifierStatus: {
              $in: downstreamAllowedSecurityVerifierStatuses,
            },
            embeddingStatus: "PROCESSING",
          },
          {
            $set: {
              embeddingStatus: "READY",
              similarQuestionsStatus: "NONE",
              similarQuestionsComputedAt: null,
              similarQuestionsComputedVersion: null,
            },
          },
          { session },
        );
        questionUpdated = questionUpdate.matchedCount === 1;
      }

      return result;
    });

    return { ...embeddingResult, questionUpdated };
  } finally {
    await session.endSession();
  }
};

const loadReadyQuestionForEmbeddingSideEffects = async (
  questionId: string,
  version: number,
) =>
  Question.findOne({
    _id: questionId,
    currentVersion: version,
    isActive: true,
    isDeleted: false,
    moderationStatus: { $in: ["APPROVED", "FLAGGED"] },
    questionEligibilityStatus: "ALLOWED",
    securityVerifierStatus: {
      $in: downstreamAllowedSecurityVerifierStatuses,
    },
    embeddingStatus: "READY",
  })
    .select("userId")
    .lean<{ userId: unknown }>();

export {
  finalizeQuestionEmbedding,
  loadCurrentQuestionVersionForEmbedding,
  loadReadyQuestionForEmbeddingSideEffects,
  lockQuestionForEmbedding,
  resetQuestionEmbeddingProcessing,
  type LockedEmbeddingQuestion,
};
