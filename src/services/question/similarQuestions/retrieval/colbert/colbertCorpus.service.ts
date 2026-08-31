import type {
  EligibleQuestionVersion,
  MultiVectorCorpusSource,
  MultiVectorEmbeddingRecord,
  MultiVectorEmbeddingStream,
} from "../retrieval.types.js";

import {
  currentLiveEligibleQuestionMatch,
  loadCurrentLiveEligibleQuestionVersionsById,
} from "../dense/denseCorpus.service.js";

import colbertConfig from "../../../../../config/colbert.config.js";
import Question from "../../../../../models/question.model.js";
import QuestionMultiVectorEmbedding from "../../../../../models/questionMultiVectorEmbedding.model.js";

const colbertRepresentationVersion = "colbert-v1";
const colbertModel = colbertConfig.model;

const loadCurrentEligibleQuestionVersions = async () => {
  const questions = await Question.find(currentLiveEligibleQuestionMatch)
    .select("_id currentVersion")
    .lean<{ _id: unknown; currentVersion: number }[]>();

  return questions.map<EligibleQuestionVersion>((question) => ({
    questionId: String(question._id),
    version: question.currentVersion,
  }));
};

const streamMultiVectorEmbeddings = ({ model }: { model: string }) =>
  QuestionMultiVectorEmbedding.find({
    model,
    representationVersion: colbertRepresentationVersion,
  })
    .select(
      "questionId version vectors model dimensions tokenCount representationVersion",
    )
    .lean<MultiVectorEmbeddingRecord>()
    .cursor() as MultiVectorEmbeddingStream;

const defaultColbertCorpus: MultiVectorCorpusSource = {
  loadCurrentEligibleQuestionVersions,
  loadCurrentEligibleQuestionVersionsById:
    loadCurrentLiveEligibleQuestionVersionsById,
  streamMultiVectorEmbeddings,
};

export {
  colbertModel,
  colbertRepresentationVersion,
  defaultColbertCorpus,
  loadCurrentEligibleQuestionVersions,
  loadCurrentLiveEligibleQuestionVersionsById,
  streamMultiVectorEmbeddings,
};
