import type {
  DenseSparseCorpusSource,
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
  loadCurrentEligibleQuestionVersions,
  loadCurrentLiveEligibleQuestionVersionsById,
  streamDenseEmbeddings,
} from "../dense/denseCorpus.service.js";
import { rrfK, type RrfWeights } from "./rrfScoring.service.js";
import {
  sparseModel as defaultSparseModel,
  streamSparseEmbeddings,
} from "../splade/sparseCorpus.service.js";

const defaultDenseSpladeCorpus: DenseSparseCorpusSource = {
  loadCurrentEligibleQuestionVersions,
  loadCurrentEligibleQuestionVersionsById:
    loadCurrentLiveEligibleQuestionVersionsById,
  streamDenseEmbeddings,
  streamSparseEmbeddings,
};

type DenseSpladeRetrievalRequest = RetrievalInput & {
  queryVector?: number[];
  querySparseVector?: { indices: number[]; values: number[] };
  denseModel?: string;
  sparseModel?: string;
  resultLimit?: number;
  rrfWeights?: RrfWeights;
  corpus?: DenseSparseCorpusSource;
};

const makeCandidateKey = (candidate: RetrievalCandidate) =>
  `${candidate.questionId}:${candidate.version}`;

const fuseDenseAndSparseByReciprocalRank = ({
  denseCandidates,
  sparseCandidates,
  limit,
  k = rrfK,
  weights = { dense: 1, sparse: 1 },
}: {
  denseCandidates: RetrievalCandidate[];
  sparseCandidates: RetrievalCandidate[];
  limit: number;
  k?: number;
  weights?: RrfWeights;
}) => {
  const fused = new Map<
    string,
    RetrievalCandidate & { denseRank?: number; sparseRank?: number }
  >();

  const addBranch = (
    candidates: RetrievalCandidate[],
    branch: "dense" | "sparse",
  ) => {
    candidates.forEach((candidate, index) => {
      const key = makeCandidateKey(candidate);
      const existing = fused.get(key);
      const next = existing ?? {
        ...candidate,
        score: 0,
      };

      next.score +=
        (branch === "dense" ? weights.dense : (weights.sparse ?? 1)) /
        (k + index + 1);
      if (branch === "dense") next.denseRank = index + 1;
      else next.sparseRank = index + 1;
      fused.set(key, next);
    });
  };

  addBranch(denseCandidates, "dense");
  addBranch(sparseCandidates, "sparse");

  return [...fused.values()]
    .map(({ denseRank, sparseRank, ...candidate }) => ({
      ...candidate,
      retrievalVersion: "dense-splade-v1",
      model: "dense-splade",
      representationVersion: "dense-splade-v1",
      diagnostics: {
        dense: denseRank
          ? {
              rank: denseRank,
              score: denseCandidates[denseRank - 1]!.score,
            }
          : undefined,
        sparse: sparseRank
          ? {
              rank: sparseRank,
              score: sparseCandidates[sparseRank - 1]!.score,
            }
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

const findDenseSpladeQuestionCandidates = async ({
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
  corpus = defaultDenseSpladeCorpus,
}: DenseSpladeRetrievalRequest): Promise<RetrievalCandidate[]> => {
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

  const fusedCandidates = fuseDenseAndSparseByReciprocalRank({
    denseCandidates,
    sparseCandidates,
    limit,
    weights: rrfWeights,
  });
  const postvalidatedVersions = makeEligibleQuestionVersionSet(
    await corpus.loadCurrentEligibleQuestionVersionsById(
      fusedCandidates.map((candidate) => candidate.questionId),
    ),
  );

  return filterEligibleCandidates(
    fusedCandidates,
    postvalidatedVersions,
    sourceQuestionId,
  ).slice(0, resultLimit);
};

export {
  findDenseSpladeQuestionCandidates,
  fuseDenseAndSparseByReciprocalRank,
};

export default findDenseSpladeQuestionCandidates;
