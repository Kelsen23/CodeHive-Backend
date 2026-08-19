import generateEmbedding from "../ai/generateEmbedding.service.js";
import buildQuestionEmbeddingInput from "../embedding/questionEmbeddingText.service.js";

import {
  denseRepresentationVersion,
  loadCurrentEligibleQuestionVersions,
  loadCurrentEligibleQuestionVersionsById,
  streamDenseEmbeddings,
} from "./retrieval/denseCorpus.service.js";
import {
  scanDenseEmbeddings,
  selectTopCandidates,
} from "./retrieval/denseScoring.service.js";
import {
  filterEligibleCandidates,
  makeEligibleQuestionVersionSet,
} from "./retrieval/denseValidation.service.js";
import type {
  DenseCorpusSource,
  RetrievalCandidate,
  RetrievalInput,
} from "./retrieval/retrieval.types.js";
import {
  denseCandidateLimit,
  similarQuestionResultLimit,
  similarQuestionScoreThreshold,
} from "./similarQuestions.shared.js";

type DenseRetrievalRequest = RetrievalInput & {
  queryVector?: number[];
  model?: string;
  resultLimit?: number;
  scoreThreshold?: number;
  corpus?: DenseCorpusSource;
};

const findSimilarQuestionCandidates = async ({
  sourceQuestionId,
  title,
  body,
  limit = denseCandidateLimit,
  queryVector,
  model: requestedModel,
  resultLimit = similarQuestionResultLimit,
  scoreThreshold = similarQuestionScoreThreshold,
  corpus = {
    loadCurrentEligibleQuestionVersions,
    streamDenseEmbeddings,
    loadCurrentEligibleQuestionVersionsById,
  },
}: DenseRetrievalRequest): Promise<RetrievalCandidate[]> => {
  let vector = queryVector;
  let model = requestedModel;

  if (!vector) {
    const generated = await generateEmbedding(
      buildQuestionEmbeddingInput({ title, body }).text,
    );

    vector = generated.embedding;
    model = generated.model;
  }

  if (!model) throw new Error("Dense retrieval requires an embedding model");

  const prevalidatedVersions = makeEligibleQuestionVersionSet(
    await corpus.loadCurrentEligibleQuestionVersions(),
  );
  const embeddingCursor = corpus.streamDenseEmbeddings({ model });
  try {
    const candidates = await scanDenseEmbeddings({
      queryVector: vector,
      embeddings: embeddingCursor,
      eligibleVersions: prevalidatedVersions,
      sourceQuestionId,
      limit: Math.max(limit, denseCandidateLimit),
      scoreThreshold,
    });

    const postvalidatedVersions = makeEligibleQuestionVersionSet(
      await corpus.loadCurrentEligibleQuestionVersionsById(
        candidates.map((candidate) => candidate.questionId),
      ),
    );

    return selectTopCandidates(
      filterEligibleCandidates(
        candidates,
        postvalidatedVersions,
        sourceQuestionId,
      ),
      resultLimit,
    );
  } finally {
    await embeddingCursor.close?.();
  }
};

export { denseRepresentationVersion, findSimilarQuestionCandidates };
export default findSimilarQuestionCandidates;
