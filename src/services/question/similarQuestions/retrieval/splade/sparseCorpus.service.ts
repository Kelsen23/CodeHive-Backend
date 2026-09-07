import type {
  EligibleQuestionVersion,
  SparseEmbeddingRecord,
  SparseEmbeddingStream,
} from "../retrieval.types.js";

import {
  loadCurrentLiveEligibleQuestionVersions,
  loadCurrentLiveEligibleQuestionVersionsById,
} from "../dense/denseCorpus.service.js";

import spladeConfig from "../../../../../config/splade.config.js";
import QuestionSparseEmbedding from "../../../../../models/questionSparseEmbedding.model.js";

const sparseRepresentationVersion = "splade-v1";
const sparseModel = spladeConfig.model;

const loadCurrentEligibleQuestionVersions = async (): Promise<
  EligibleQuestionVersion[]
> => loadCurrentLiveEligibleQuestionVersions();

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
