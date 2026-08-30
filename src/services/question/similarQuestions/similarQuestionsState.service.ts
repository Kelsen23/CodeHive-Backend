import mongoose from "mongoose";

import type { RetrievalCandidate } from "./retrieval/retrieval.types.js";

import { downstreamAllowedSecurityVerifierStatuses } from "./similarQuestions.shared.js";

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
      isActive: true,
      isDeleted: false,
      embeddingStatus: "READY",
      moderationStatus: { $in: ["APPROVED", "FLAGGED"] },
      questionEligibilityStatus: "ALLOWED",
      securityVerifierStatus: {
        $in: downstreamAllowedSecurityVerifierStatuses,
      },
      similarQuestionsStatus: "NONE",
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
    { $set: { similarQuestionsStatus: "NONE" } },
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
  await SimilarQuestion.deleteMany({
    sourceQuestionId: questionId,
    sourceVersion: version,
    retrievalVersion,
    ...(materializedCandidates.length
      ? {
          $nor: materializedCandidates.map((candidate) => ({
            targetQuestionId: new mongoose.Types.ObjectId(candidate.questionId),
            targetVersion: candidate.version,
          })),
        }
      : {}),
  });

  if (materializedCandidates.length) {
    const sourceQuestionObjectId = new mongoose.Types.ObjectId(questionId);
    await SimilarQuestion.bulkWrite(
      materializedCandidates.map((candidate, index) => ({
        updateOne: {
          filter: {
            sourceQuestionId: sourceQuestionObjectId,
            sourceVersion: version,
            targetQuestionId: new mongoose.Types.ObjectId(candidate.questionId),
            targetVersion: candidate.version,
            retrievalVersion,
          },
          update: {
            $set: {
              rank: index + 1,
              score: candidate.score,
              computedAt: new Date(),
              model: candidate.model,
              representationVersion: candidate.representationVersion,
            },
            $setOnInsert: {
              sourceQuestionId: sourceQuestionObjectId,
              sourceVersion: version,
              targetQuestionId: new mongoose.Types.ObjectId(
                candidate.questionId,
              ),
              targetVersion: candidate.version,
              retrievalVersion,
              model: candidate.model,
              representationVersion: candidate.representationVersion,
              computedAt: new Date(),
            },
          },
          upsert: true,
        },
      })),
    );
  }

  return Question.updateOne(
    {
      _id: questionId,
      currentVersion: version,
      similarQuestionsStatus: "PROCESSING",
    },
    {
      $set: {
        similarQuestionsStatus: "READY",
      },
    },
  );
};

const loadReadyQuestionForSimilarSideEffects = async (
  questionId: string,
  version: number,
) =>
  Question.findOne({
    _id: questionId,
    currentVersion: version,
    isActive: true,
    isDeleted: false,
    embeddingStatus: "READY",
    moderationStatus: { $in: ["APPROVED", "FLAGGED"] },
    questionEligibilityStatus: "ALLOWED",
    securityVerifierStatus: {
      $in: downstreamAllowedSecurityVerifierStatuses,
    },
    similarQuestionsStatus: "READY",
  })
    .select("userId")
    .lean<{
      userId: unknown;
    }>();

export {
  finalizeSimilarQuestions,
  loadReadyQuestionForSimilarSideEffects,
  lockQuestionForSimilarQuestions,
  resetSimilarQuestionsProcessing,
  type LockedSimilarQuestionsQuestion,
};
