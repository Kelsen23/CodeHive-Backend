import type {
  DenseSparseBm25CorpusSource,
  RetrievalCandidate,
  RetrievalInput,
} from "../retrieval.types.js";

import findSimilarQuestionCandidates from "../../similarQuestionsSearch.service.js";
import {
  denseCandidateLimit,
  similarQuestionResultLimit,
} from "../../similarQuestions.shared.js";
import { findSpladeQuestionCandidates } from "../splade/spladeRetrieval.service.js";
import {
  filterEligibleCandidates,
  makeEligibleQuestionVersionSet,
} from "../dense/denseValidation.service.js";
import {
  getBm25Index,
  invalidateBm25Index,
} from "../bm25/bm25Index.service.js";
import {
  bm25RetrievalVersion,
  scoreBm25Index,
  tokenizeBm25,
} from "../bm25/bm25Scoring.service.js";
import { rrfK, type RrfWeights } from "./rrfScoring.service.js";
import {
  loadCurrentEligibleQuestionDocuments,
  loadCurrentEligibleQuestionDocumentsById,
} from "../bm25/bm25Corpus.service.js";
import {
  loadCurrentEligibleQuestionVersions,
  loadCurrentLiveEligibleQuestionVersionsById,
  streamDenseEmbeddings,
} from "../dense/denseCorpus.service.js";
import {
  sparseModel as defaultSparseModel,
  streamSparseEmbeddings,
} from "../splade/sparseCorpus.service.js";

const defaultDenseSparseBm25Corpus: DenseSparseBm25CorpusSource = {
  loadCurrentEligibleQuestionVersions,
  loadCurrentEligibleQuestionVersionsById:
    loadCurrentLiveEligibleQuestionVersionsById,
  streamDenseEmbeddings,
  streamSparseEmbeddings,
  loadCurrentEligibleQuestionDocuments,
  loadCurrentEligibleQuestionDocumentsById,
};

type DenseSpladeBm25RetrievalRequest = RetrievalInput & {
  queryVector?: number[];
  querySparseVector?: { indices: number[]; values: number[] };
  denseModel?: string;
  sparseModel?: string;
  resultLimit?: number;
  rrfWeights?: RrfWeights;
  corpus?: DenseSparseBm25CorpusSource;
};

const makeCandidateKey = (candidate: RetrievalCandidate) =>
  `${candidate.questionId}:${candidate.version}`;

const fuseDenseSpladeBm25ByReciprocalRank = ({
  denseCandidates,
  sparseCandidates,
  bm25Candidates,
  limit,
  k = rrfK,
  weights = { dense: 1, sparse: 1, bm25: 1 },
}: {
  denseCandidates: RetrievalCandidate[];
  sparseCandidates: RetrievalCandidate[];
  bm25Candidates: RetrievalCandidate[];
  limit: number;
  k?: number;
  weights?: RrfWeights;
}) => {
  const fused = new Map<string, RetrievalCandidate & { ranks: number[] }>();
  const addBranch = (candidates: RetrievalCandidate[], branch: number) => {
    candidates.forEach((candidate, index) => {
      const key = makeCandidateKey(candidate);
      const next = fused.get(key) ?? { ...candidate, score: 0, ranks: [] };
      const weight =
        branch === 0
          ? weights.dense
          : branch === 1
            ? (weights.sparse ?? 1)
            : (weights.bm25 ?? 1);

      next.score += weight / (k + index + 1);
      next.ranks[branch] = index + 1;
      fused.set(key, next);
    });
  };

  addBranch(denseCandidates, 0);
  addBranch(sparseCandidates, 1);
  addBranch(bm25Candidates, 2);

  return [...fused.values()]
    .map(({ ranks, ...candidate }) => ({
      ...candidate,
      retrievalVersion: "dense-splade-bm25-v1",
      model: "dense-splade-bm25",
      representationVersion: "dense-splade-bm25-v1",
      diagnostics: {
        dense: ranks[0]
          ? { rank: ranks[0], score: denseCandidates[ranks[0] - 1]!.score }
          : undefined,
        sparse: ranks[1]
          ? { rank: ranks[1], score: sparseCandidates[ranks[1] - 1]!.score }
          : undefined,
        bm25: ranks[2]
          ? { rank: ranks[2], score: bm25Candidates[ranks[2] - 1]!.score }
          : undefined,
        rrf: { k, weights },
      },
    }))
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.questionId.localeCompare(right.questionId) ||
        left.version - right.version,
    )
    .slice(0, limit);
};

const findDenseSpladeBm25QuestionCandidates = async ({
  sourceQuestionId,
  sourceVersion,
  title,
  body,
  tags,
  limit = denseCandidateLimit,
  queryVector,
  querySparseVector,
  denseModel,
  sparseModel,
  resultLimit = similarQuestionResultLimit,
  rrfWeights,
  corpus = defaultDenseSparseBm25Corpus,
}: DenseSpladeBm25RetrievalRequest): Promise<RetrievalCandidate[]> => {
  const [denseCandidates, sparseCandidates] = await Promise.all([
    findSimilarQuestionCandidates({
      sourceQuestionId,
      sourceVersion,
      title,
      body,
      tags,
      limit,
      queryVector,
      model: denseModel,
      resultLimit: limit,
      corpus,
    }),
    findSpladeQuestionCandidates({
      sourceQuestionId,
      sourceVersion,
      title,
      body,
      tags,
      limit,
      querySparseVector,
      model: sparseModel ?? defaultSparseModel,
      resultLimit: limit,
      corpus,
    }),
  ]);
  const bm25Candidates = scoreBm25Index({
    query: {
      questionId: sourceQuestionId,
      version: sourceVersion,
      title,
      body,
      tags,
    },
    index: await getBm25Index(corpus, tokenizeBm25),
    sourceQuestionId,
    limit,
  });
  const fusedCandidates = fuseDenseSpladeBm25ByReciprocalRank({
    denseCandidates,
    sparseCandidates,
    bm25Candidates,
    limit,
    weights: rrfWeights,
  });
  const eligibleVersions = makeEligibleQuestionVersionSet(
    await corpus.loadCurrentEligibleQuestionVersionsById(
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
  findDenseSpladeBm25QuestionCandidates,
  fuseDenseSpladeBm25ByReciprocalRank,
  invalidateBm25Index,
};

export default findDenseSpladeBm25QuestionCandidates;
