import type {
  DenseEmbeddingRecord,
  RetrievalCandidate,
} from "../retrieval.types.js";

import { denseRepresentationVersion } from "../../../embedding/dense/questionEmbedding.shared.js";
import { makeQuestionVersionKey } from "./denseValidation.service.js";

const cosineSimilarity = (left: number[], right: number[]) => {
  if (
    left.length === 0 ||
    left.length !== right.length ||
    left.some((value) => !Number.isFinite(value)) ||
    right.some((value) => !Number.isFinite(value))
  ) {
    return null;
  }

  let dotProduct = 0;
  let leftNormSquared = 0;
  let rightNormSquared = 0;

  for (let index = 0; index < left.length; index += 1) {
    dotProduct += left[index] * right[index];
    leftNormSquared += left[index] * left[index];
    rightNormSquared += right[index] * right[index];
  }

  if (leftNormSquared === 0 || rightNormSquared === 0) return null;

  return dotProduct / Math.sqrt(leftNormSquared * rightNormSquared);
};

const scoreDenseEmbedding = (
  queryVector: number[],
  embedding: DenseEmbeddingRecord,
): RetrievalCandidate | null => {
  const score = cosineSimilarity(queryVector, embedding.vector);

  if (score === null) return null;

  return {
    questionId: embedding.questionId,
    version: embedding.version,
    score,
    retrievalVersion: denseRepresentationVersion,
    model: embedding.model,
    representationVersion: embedding.representationVersion,
  };
};

const compareCandidates = (
  left: RetrievalCandidate,
  right: RetrievalCandidate,
) =>
  right.score - left.score ||
  left.questionId.localeCompare(right.questionId) ||
  left.version - right.version;

const selectTopCandidates = (
  candidates: RetrievalCandidate[],
  limit: number,
) => {
  const bestByVersion = new Map<string, RetrievalCandidate>();

  for (const candidate of candidates) {
    const key = `${candidate.questionId}:${candidate.version}:${candidate.model}:${candidate.representationVersion}`;
    const existing = bestByVersion.get(key);

    if (!existing || compareCandidates(candidate, existing) < 0) {
      bestByVersion.set(key, candidate);
    }
  }

  return [...bestByVersion.values()].sort(compareCandidates).slice(0, limit);
};

const scanDenseEmbeddings = async ({
  queryVector,
  embeddings,
  eligibleVersions,
  sourceQuestionId,
  limit,
  scoreThreshold = 0,
}: {
  queryVector: number[];
  embeddings: AsyncIterable<DenseEmbeddingRecord>;
  eligibleVersions: Set<string>;
  sourceQuestionId: string;
  limit: number;
  scoreThreshold?: number;
}) => {
  let topCandidates: RetrievalCandidate[] = [];

  for await (const embedding of embeddings) {
    if (
      embedding.questionId === sourceQuestionId ||
      !eligibleVersions.has(
        makeQuestionVersionKey(embedding.questionId, embedding.version),
      )
    ) {
      continue;
    }

    const candidate = scoreDenseEmbedding(queryVector, embedding);

    if (!candidate || candidate.score < scoreThreshold) continue;

    topCandidates = selectTopCandidates([...topCandidates, candidate], limit);
  }

  return topCandidates;
};

export {
  cosineSimilarity,
  scanDenseEmbeddings,
  scoreDenseEmbedding,
  selectTopCandidates,
};
