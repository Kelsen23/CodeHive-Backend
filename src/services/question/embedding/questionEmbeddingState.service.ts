import Question from "../../../models/question.model.js";
import QuestionVersion from "../../../models/questionVersion.model.js";
import QuestionEmbedding from "../../../models/questionEmbedding.model.js";

import { downstreamAllowedSecurityVerifierStatuses } from "./questionEmbedding.shared.js";
import { denseRepresentationVersion } from "./questionEmbedding.shared.js";

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
}) =>
  QuestionEmbedding.updateOne(
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
    { upsert: true },
  ).then(async (embeddingResult) => {
    if (embeddingResult.acknowledged) {
      await Question.updateOne(
        {
          _id: questionId,
          currentVersion: version,
          embeddingStatus: "PROCESSING",
        },
        { $set: { embeddingStatus: "READY", similarQuestionsStatus: "NONE" } },
      );
    }

    return embeddingResult;
  });

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
