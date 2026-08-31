import type {
  EligibleQuestionVersion,
  SparseEmbeddingRecord,
  SparseEmbeddingStream,
} from "../retrieval.types.js";

import {
  currentLiveEligibleQuestionMatch,
  loadCurrentLiveEligibleQuestionVersionsById,
} from "../dense/denseCorpus.service.js";

import spladeConfig from "../../../../../config/splade.config.js";
import Question from "../../../../../models/question.model.js";
import QuestionSparseEmbedding from "../../../../../models/questionSparseEmbedding.model.js";

const sparseRepresentationVersion = "splade-v1";
const sparseModel = spladeConfig.model;

const loadCurrentEligibleQuestionVersions = async () => {
  const questions = await Question.find(currentLiveEligibleQuestionMatch)
    .select("_id currentVersion")
    .lean<{ _id: unknown; currentVersion: number }[]>();

  return questions.map<EligibleQuestionVersion>((question) => ({
    questionId: String(question._id),
    version: question.currentVersion,
  }));
};

const streamSparseEmbeddings = ({ model }: { model: string }) =>
  QuestionSparseEmbedding.find({
    model,
    representationVersion: sparseRepresentationVersion,
  })
    .select("questionId version indices values model representationVersion")
    .lean<SparseEmbeddingRecord>()
    .cursor() as SparseEmbeddingStream;

export {
  loadCurrentEligibleQuestionVersions,
  loadCurrentLiveEligibleQuestionVersionsById,
  sparseModel,
  sparseRepresentationVersion,
  streamSparseEmbeddings,
};
