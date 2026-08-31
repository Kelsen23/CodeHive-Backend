import type {
  DenseSparseCorpusSource,
  HybridCorpusSource,
  RetrievalCandidate,
  RetrievalInput,
} from "../retrieval.types.js";

import generateEmbedding from "../../../ai/generateEmbedding.service.js";
import buildQuestionEmbeddingInput from "../../../embedding/dense/questionEmbeddingText.service.js";
import { findSpladeQuestionCandidates } from "../splade/spladeRetrieval.service.js";
import {
  scanDenseEmbeddings,
  selectTopCandidates,
} from "../dense/denseScoring.service.js";
import {
  filterEligibleCandidates,
  makeEligibleQuestionVersionSet,
} from "../dense/denseValidation.service.js";
import { denseRepresentationVersion } from "../dense/denseCorpus.service.js";
import {
  denseCandidateLimit,
  similarQuestionResultLimit,
} from "../../similarQuestions.shared.js";
import { getBm25Index } from "../bm25/bm25Index.service.js";
import { scoreBm25Index, tokenizeBm25 } from "../bm25/bm25Scoring.service.js";
import {
  loadCurrentEligibleQuestionDocuments,
  loadCurrentEligibleQuestionDocumentsById,
} from "../bm25/bm25Corpus.service.js";
import {
  loadCurrentEligibleQuestionVersions,
  loadCurrentLiveEligibleQuestionVersionsById,
  streamDenseEmbeddings,
} from "../dense/denseCorpus.service.js";
import { streamSparseEmbeddings } from "../splade/sparseCorpus.service.js";

const makeCandidateKey = ({ questionId, version }: RetrievalCandidate) =>
  `${questionId}:${version}`;

const defaultDenseSparseExpansionCorpus: DenseSparseCorpusSource = {
  loadCurrentEligibleQuestionVersions,
  loadCurrentEligibleQuestionVersionsById:
    loadCurrentLiveEligibleQuestionVersionsById,
  streamDenseEmbeddings,
  streamSparseEmbeddings,
};

const defaultDenseBm25ExpansionCorpus: HybridCorpusSource = {
  loadCurrentEligibleQuestionVersions,
  loadCurrentEligibleQuestionVersionsById:
    loadCurrentLiveEligibleQuestionVersionsById,
  streamDenseEmbeddings,
  loadCurrentEligibleQuestionDocuments,
  loadCurrentEligibleQuestionDocumentsById,
};

type DenseExpansionRequest = RetrievalInput & {
  queryVector?: number[];
  denseModel?: string;
  sparseModel?: string;
  resultLimit?: number;
};

const rankDenseCandidatePool = async ({
  queryVector,
  model,
  sourceQuestionId,
  candidateIdentities,
  corpus,
}: {
  queryVector: number[];
  model: string;
  sourceQuestionId: string;
  candidateIdentities: Set<string>;
  corpus: DenseSparseCorpusSource | HybridCorpusSource;
}) => {
  const eligibleVersions = await corpus.loadCurrentEligibleQuestionVersions();
  const poolVersions = eligibleVersions.filter(({ questionId, version }) =>
    candidateIdentities.has(`${questionId}:${version}`),
  );
  const cursor = corpus.streamDenseEmbeddings({ model });

  try {
    return await scanDenseEmbeddings({
      queryVector,
      embeddings: cursor,
      eligibleVersions: makeEligibleQuestionVersionSet(poolVersions),
      sourceQuestionId,
      limit: poolVersions.length,
    });
  } finally {
    await cursor.close?.();
  }
};

const makeDensePrimaryCandidates = async ({
  sourceQuestionId,
  queryVector,
  denseModel,
  branchCandidates,
  branchName,
  corpus,
}: {
  sourceQuestionId: string;
  queryVector: number[];
  denseModel: string;
  branchCandidates: RetrievalCandidate[][];
  branchName: "sparse" | "bm25";
  corpus: DenseSparseCorpusSource | HybridCorpusSource;
}) => {
  const candidateIdentities = new Set(
    branchCandidates
      .flat()
      .map(({ questionId, version }) => `${questionId}:${version}`),
  );
  const denseCandidates = await rankDenseCandidatePool({
    queryVector,
    model: denseModel,
    sourceQuestionId,
    candidateIdentities,
    corpus,
  });
  const denseByIdentity = new Map(
    denseCandidates.map((candidate) => [
      makeCandidateKey(candidate),
      candidate,
    ]),
  );
  const branchByIdentity = new Map(
    branchCandidates
      .flat()
      .map((candidate) => [makeCandidateKey(candidate), candidate]),
  );

  return [...denseByIdentity.values()]
    .map((candidate, index) => {
      const branchCandidate = branchByIdentity.get(makeCandidateKey(candidate));
      const branchRank = branchCandidate
        ? branchCandidates[0]!.findIndex(
            (item) => makeCandidateKey(item) === makeCandidateKey(candidate),
          ) + 1
        : undefined;

      return {
        ...candidate,
        retrievalVersion: "dense-primary-expansion-v1",
        model: candidate.model,
        representationVersion: denseRepresentationVersion,
        diagnostics: {
          ...candidate.diagnostics,
          dense: { rank: index + 1, score: candidate.score },
          sparse:
            branchName === "sparse" && branchRank
              ? { rank: branchRank, score: branchCandidate!.score }
              : undefined,
          bm25:
            branchName === "bm25" && branchRank
              ? { rank: branchRank, score: branchCandidate!.score }
              : undefined,
        },
      };
    })
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.questionId.localeCompare(right.questionId) ||
        left.version - right.version,
    );
};

const findDenseSpladeExpansionQuestionCandidates = async ({
  sourceQuestionId,
  sourceVersion,
  title,
  body,
  tags,
  limit = denseCandidateLimit,
  queryVector,
  denseModel,
  sparseModel,
  resultLimit = similarQuestionResultLimit,
  corpus = defaultDenseSparseExpansionCorpus,
}: DenseExpansionRequest & {
  corpus?: DenseSparseCorpusSource;
}): Promise<RetrievalCandidate[]> => {
  let vector = queryVector;
  let model = denseModel;

  if (!vector) {
    const generated = await generateEmbedding(
      buildQuestionEmbeddingInput({ title, body }).text,
    );
    vector = generated.embedding;
    model = generated.model;
  }
  if (!model) throw new Error("Dense expansion requires an embedding model");

  const sparseCandidates = await findSpladeQuestionCandidates({
    sourceQuestionId,
    sourceVersion,
    title,
    body,
    tags,
    limit,
    model: sparseModel,
    resultLimit: limit,
    corpus,
  });
  const candidates = await makeDensePrimaryCandidates({
    sourceQuestionId,
    queryVector: vector,
    denseModel: model,
    branchCandidates: [sparseCandidates],
    branchName: "sparse",
    corpus,
  });
  const postvalidatedVersions = makeEligibleQuestionVersionSet(
    await corpus.loadCurrentEligibleQuestionVersionsById(
      candidates.map(({ questionId }) => questionId),
    ),
  );

  return filterEligibleCandidates(
    selectTopCandidates(candidates, limit),
    postvalidatedVersions,
    sourceQuestionId,
  ).slice(0, resultLimit);
};

const findDenseBm25ExpansionQuestionCandidates = async ({
  sourceQuestionId,
  sourceVersion,
  title,
  body,
  tags,
  limit = denseCandidateLimit,
  queryVector,
  denseModel,
  resultLimit = similarQuestionResultLimit,
  corpus = defaultDenseBm25ExpansionCorpus,
}: DenseExpansionRequest & {
  corpus?: HybridCorpusSource;
}): Promise<RetrievalCandidate[]> => {
  let vector = queryVector;
  let model = denseModel;

  if (!vector) {
    const generated = await generateEmbedding(
      buildQuestionEmbeddingInput({ title, body }).text,
    );
    vector = generated.embedding;
    model = generated.model;
  }
  if (!model) throw new Error("Dense expansion requires an embedding model");

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
  const candidates = await makeDensePrimaryCandidates({
    sourceQuestionId,
    queryVector: vector,
    denseModel: model,
    branchCandidates: [bm25Candidates],
    branchName: "bm25",
    corpus,
  });
  const postvalidatedVersions = makeEligibleQuestionVersionSet(
    await corpus.loadCurrentEligibleQuestionVersionsById(
      candidates.map(({ questionId }) => questionId),
    ),
  );

  return filterEligibleCandidates(
    selectTopCandidates(candidates, limit),
    postvalidatedVersions,
    sourceQuestionId,
  ).slice(0, resultLimit);
};

export {
  findDenseBm25ExpansionQuestionCandidates,
  findDenseSpladeExpansionQuestionCandidates,
};
