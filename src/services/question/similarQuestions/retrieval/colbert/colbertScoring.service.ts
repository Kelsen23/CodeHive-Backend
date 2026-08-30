import type {
  MultiVectorEmbeddingRecord,
  RetrievalCandidate,
} from "../retrieval.types.js";

import { colbertRepresentationVersion } from "./colbertCorpus.service.js";

const cosineSimilarity = (left: number[], right: number[]) => {
  if (
    left.length === 0 ||
    left.length !== right.length ||
    left.some((value) => !Number.isFinite(value)) ||
    right.some((value) => !Number.isFinite(value))
  )
    return null;

  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftNorm += left[index] * left[index];
    rightNorm += right[index] * right[index];
  }
  if (leftNorm === 0 || rightNorm === 0) return null;
  return dot / Math.sqrt(leftNorm * rightNorm);
};

const maxSimScore = (queryVectors: number[][], documentVectors: number[][]) => {
  if (queryVectors.length === 0 || documentVectors.length === 0) return null;
  let total = 0;
  for (const queryVector of queryVectors) {
    let maximum: number | null = null;
    for (const documentVector of documentVectors) {
      const score = cosineSimilarity(queryVector, documentVector);
      if (score !== null && (maximum === null || score > maximum))
        maximum = score;
    }
    if (maximum === null) return null;
    total += maximum;
  }
  return Number.isFinite(total) ? total : null;
};

const scoreColbertEmbedding = (
  queryVectors: number[][],
  embedding: MultiVectorEmbeddingRecord,
): RetrievalCandidate | null => {
  const score = maxSimScore(queryVectors, embedding.vectors);
  if (score === null) return null;
  return {
    questionId: embedding.questionId,
    version: embedding.version,
    score,
    retrievalVersion: colbertRepresentationVersion,
    model: embedding.model,
    representationVersion: embedding.representationVersion,
    diagnostics: {
      colbert: {
        queryTokenCount: queryVectors.length,
        documentTokenCount: embedding.tokenCount,
        dimensions: embedding.dimensions,
      },
    },
  };
};

const compareCandidates = (
  left: RetrievalCandidate,
  right: RetrievalCandidate,
) =>
  right.score - left.score ||
  left.questionId.localeCompare(right.questionId) ||
  left.version - right.version;

const selectTopColbertCandidates = (
  candidates: RetrievalCandidate[],
  limit: number,
) =>
  [
    ...new Map(
      candidates.map((candidate) => [
        `${candidate.questionId}:${candidate.version}`,
        candidate,
      ]),
    ).values(),
  ]
    .sort(compareCandidates)
    .slice(0, limit);

const scanColbertEmbeddings = async ({
  queryVectors,
  embeddings,
  eligibleVersions,
  sourceQuestionId,
  limit,
}: {
  queryVectors: number[][];
  embeddings: AsyncIterable<MultiVectorEmbeddingRecord>;
  eligibleVersions: Set<string>;
  sourceQuestionId: string;
  limit: number;
}) => {
  let candidates: RetrievalCandidate[] = [];
  for await (const embedding of embeddings) {
    if (
      embedding.questionId === sourceQuestionId ||
      !eligibleVersions.has(`${embedding.questionId}:${embedding.version}`)
    )
      continue;
    const candidate = scoreColbertEmbedding(queryVectors, embedding);
    if (candidate)
      candidates = selectTopColbertCandidates(
        [...candidates, candidate],
        limit,
      );
  }
  return candidates;
};

export {
  cosineSimilarity,
  maxSimScore,
  scanColbertEmbeddings,
  scoreColbertEmbedding,
  selectTopColbertCandidates,
};
