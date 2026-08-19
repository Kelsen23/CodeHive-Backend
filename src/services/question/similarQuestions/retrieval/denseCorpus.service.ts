import Question from "../../../../models/question.model.js";
import QuestionEmbedding from "../../../../models/questionEmbedding.model.js";

import {
  denseRepresentationVersion,
  downstreamAllowedSecurityVerifierStatuses,
} from "../../embedding/questionEmbedding.shared.js";

import type {
  DenseEmbeddingRecord,
  EligibleQuestionVersion,
} from "./retrieval.types.js";

const currentEligibleQuestionMatch = {
  isActive: true,
  isDeleted: false,
  embeddingStatus: "READY",
  moderationStatus: { $in: ["APPROVED", "FLAGGED"] },
  questionEligibilityStatus: "ALLOWED",
  securityVerifierStatus: {
    $in: downstreamAllowedSecurityVerifierStatuses,
  },
};

const loadCurrentEligibleQuestionVersions = async () => {
  const questions = await Question.find(currentEligibleQuestionMatch)
    .select("_id currentVersion")
    .lean<{ _id: unknown; currentVersion: number }[]>();

  return questions.map<EligibleQuestionVersion>((question) => ({
    questionId: String(question._id),
    version: question.currentVersion,
  }));
};

const streamDenseEmbeddings = ({ model }: { model: string }) =>
  QuestionEmbedding.find({
    model,
    representationVersion: denseRepresentationVersion,
  })
    .select("questionId version vector model representationVersion")
    .lean<DenseEmbeddingRecord>()
    .cursor();

const loadCurrentEligibleQuestionVersionsById = async (
  questionIds: string[],
) => {
  if (questionIds.length === 0) return [];

  const questions = await Question.find({
    _id: { $in: questionIds },
    ...currentEligibleQuestionMatch,
  })
    .select("_id currentVersion")
    .lean<{ _id: unknown; currentVersion: number }[]>();

  return questions.map<EligibleQuestionVersion>((question) => ({
    questionId: String(question._id),
    version: question.currentVersion,
  }));
};

export {
  currentEligibleQuestionMatch,
  denseRepresentationVersion,
  loadCurrentEligibleQuestionVersions,
  loadCurrentEligibleQuestionVersionsById,
  streamDenseEmbeddings,
};
