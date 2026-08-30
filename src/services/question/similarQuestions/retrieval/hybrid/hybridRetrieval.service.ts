import type {
  HybridCorpusSource,
  RetrievalCandidate,
  RetrievalInput,
} from "../retrieval.types.js";

import { loadCurrentEligibleQuestionDocuments } from "../bm25/bm25Corpus.service.js";
import {
  getBm25Index,
  invalidateBm25Index,
} from "../bm25/bm25Index.service.js";
import {
  bm25RetrievalVersion,
  scoreBm25Index,
  tokenizeBm25,
} from "../bm25/bm25Scoring.service.js";
import { fuseByReciprocalRank, type RrfWeights } from "./rrfScoring.service.js";
import { findSimilarQuestionCandidates } from "../../similarQuestionsSearch.service.js";
import {
  denseCandidateLimit,
  similarQuestionResultLimit,
} from "../../similarQuestions.shared.js";
import {
  filterEligibleCandidates,
  makeEligibleQuestionVersionSet,
} from "../dense/denseValidation.service.js";
import {
  loadCurrentEligibleQuestionVersionsById,
  loadCurrentEligibleQuestionVersions,
  loadCurrentLiveEligibleQuestionVersionsById,
  streamDenseEmbeddings,
} from "../dense/denseCorpus.service.js";

const defaultHybridCorpus: HybridCorpusSource = {
  loadCurrentEligibleQuestionVersions,
  streamDenseEmbeddings,
  loadCurrentEligibleQuestionVersionsById,
  loadCurrentEligibleQuestionDocuments,
  loadCurrentEligibleQuestionDocumentsById:
    loadCurrentLiveEligibleQuestionVersionsById,
};

type HybridRetrievalRequest = RetrievalInput & {
  queryVector?: number[];
  model?: string;
  resultLimit?: number;
  rrfWeights?: RrfWeights;
  corpus?: HybridCorpusSource;
};

const findHybridQuestionCandidates = async ({
  sourceQuestionId,
  sourceVersion,
  title,
  body,
  tags,
  limit = denseCandidateLimit,
  queryVector,
  model,
  resultLimit = similarQuestionResultLimit,
  rrfWeights,
  corpus = defaultHybridCorpus,
}: HybridRetrievalRequest): Promise<RetrievalCandidate[]> => {
  const denseCandidates = await findSimilarQuestionCandidates({
    sourceQuestionId,
    sourceVersion,
    title,
    body,
    tags,
    limit,
    queryVector,
    model,
    resultLimit: limit,
    corpus,
  });

  const index = await getBm25Index(corpus, tokenizeBm25);
  const bm25Candidates = scoreBm25Index({
    query: {
      questionId: sourceQuestionId,
      version: sourceVersion,
      title,
      body,
      tags,
    },
    index,
    sourceQuestionId,
    limit,
  });

  const fusedCandidates = fuseByReciprocalRank({
    denseCandidates,
    bm25Candidates,
    limit: Math.max(limit, denseCandidateLimit),
    weights: rrfWeights,
  });
  const eligibleVersions = makeEligibleQuestionVersionSet(
    await corpus.loadCurrentEligibleQuestionDocumentsById(
      fusedCandidates.map((candidate) => candidate.questionId),
    ),
  );

  return filterEligibleCandidates(
    fusedCandidates,
    eligibleVersions,
    sourceQuestionId,
  ).slice(0, resultLimit);
};

export {
  bm25RetrievalVersion,
  findHybridQuestionCandidates,
  invalidateBm25Index,
};

export default findHybridQuestionCandidates;
