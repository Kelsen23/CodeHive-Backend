import type {
  MultiVectorCorpusSource,
  RetrievalCandidate,
  RetrievalInput,
} from "../retrieval.types.js";

import { generateColbertEmbedding } from "../../../embedding/colbert/colbertEmbedding.service.js";
import {
  denseCandidateLimit,
  similarQuestionResultLimit,
} from "../../similarQuestions.shared.js";
import {
  filterEligibleCandidates,
  makeEligibleQuestionVersionSet,
} from "../dense/denseValidation.service.js";
import { scanColbertEmbeddings } from "./colbertScoring.service.js";
import { colbertModel, defaultColbertCorpus } from "./colbertCorpus.service.js";

type ColbertRetrievalRequest = RetrievalInput & {
  queryMultiVector?: number[][];
  model?: string;
  resultLimit?: number;
  corpus?: MultiVectorCorpusSource;
};

const findColbertQuestionCandidates = async ({
  sourceQuestionId,
  title,
  body,
  tags,
  limit = denseCandidateLimit,
  queryMultiVector,
  model = colbertModel,
  resultLimit = similarQuestionResultLimit,
  corpus = defaultColbertCorpus,
}: ColbertRetrievalRequest): Promise<RetrievalCandidate[]> => {
  const queryVectors =
    queryMultiVector ??
    (await generateColbertEmbedding({ title, body, tags, mode: "query" }))
      .vectors;
  const eligibleVersions = makeEligibleQuestionVersionSet(
    await corpus.loadCurrentEligibleQuestionVersions(),
  );
  const embeddingCursor = corpus.streamMultiVectorEmbeddings({ model });

  try {
    const candidates = await scanColbertEmbeddings({
      queryVectors,
      embeddings: embeddingCursor,
      eligibleVersions,
      sourceQuestionId,
      limit,
    });
    const postvalidatedVersions = makeEligibleQuestionVersionSet(
      await corpus.loadCurrentEligibleQuestionVersionsById(
        candidates.map((candidate) => candidate.questionId),
      ),
    );
    return filterEligibleCandidates(
      candidates,
      postvalidatedVersions,
      sourceQuestionId,
    ).slice(0, resultLimit);
  } finally {
    await embeddingCursor.close?.();
  }
};

export { findColbertQuestionCandidates };
export default findColbertQuestionCandidates;
