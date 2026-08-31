import type {
  RetrievalCandidate,
  RetrievalInput,
  SparseCorpusSource,
} from "../retrieval.types.js";

import { generateSparseEmbedding } from "../../../embedding/sparse/sparseEmbedding.service.js";
import {
  loadCurrentEligibleQuestionVersions,
  loadCurrentLiveEligibleQuestionVersionsById,
  sparseModel,
  streamSparseEmbeddings,
} from "./sparseCorpus.service.js";
import { scanSparseEmbeddings } from "./sparseScoring.service.js";
import {
  filterEligibleCandidates,
  makeEligibleQuestionVersionSet,
} from "../dense/denseValidation.service.js";
import {
  denseCandidateLimit,
  similarQuestionResultLimit,
} from "../../similarQuestions.shared.js";

type SpladeRetrievalRequest = RetrievalInput & {
  querySparseVector?: { indices: number[]; values: number[] };
  model?: string;
  resultLimit?: number;
  corpus?: SparseCorpusSource;
};

const defaultSparseCorpus: SparseCorpusSource = {
  loadCurrentEligibleQuestionVersions,
  loadCurrentEligibleQuestionVersionsById:
    loadCurrentLiveEligibleQuestionVersionsById,
  streamSparseEmbeddings,
};

const findSpladeQuestionCandidates = async ({
  sourceQuestionId,
  title,
  body,
  tags,
  limit = denseCandidateLimit,
  querySparseVector,
  model = sparseModel,
  resultLimit = similarQuestionResultLimit,
  corpus = defaultSparseCorpus,
}: SpladeRetrievalRequest): Promise<RetrievalCandidate[]> => {
  const query =
    querySparseVector ??
    (await generateSparseEmbedding({ title, body, tags, mode: "query" }));
  const eligibleVersions = makeEligibleQuestionVersionSet(
    await corpus.loadCurrentEligibleQuestionVersions(),
  );
  const embeddingCursor = corpus.streamSparseEmbeddings({ model });

  try {
    const candidates = await scanSparseEmbeddings({
      query,
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

export { findSpladeQuestionCandidates, sparseModel };

export default findSpladeQuestionCandidates;
