import type {
  RetrievalCandidate,
  SparseEmbeddingRecord,
} from "../retrieval.types.js";

import { sparseRepresentationVersion } from "./sparseCorpus.service.js";

const sparseDotProduct = (
  queryIndices: number[],
  queryValues: number[],
  documentIndices: number[],
  documentValues: number[],
) => {
  if (
    queryIndices.length !== queryValues.length ||
    documentIndices.length !== documentValues.length ||
    queryIndices.some((value) => !Number.isInteger(value) || value < 0) ||
    documentIndices.some((value) => !Number.isInteger(value) || value < 0) ||
    queryValues.some((value) => !Number.isFinite(value)) ||
    documentValues.some((value) => !Number.isFinite(value))
  )
    return null;

  const document = new Map(
    documentIndices.map((index, position) => [index, documentValues[position]]),
  );
  let score = 0;
  for (const [position, index] of queryIndices.entries()) {
    const value = document.get(index);
    if (value !== undefined) score += queryValues[position] * value;
  }
  return Number.isFinite(score) ? score : null;
};

const scoreSparseEmbedding = (
  query: { indices: number[]; values: number[] },
  embedding: SparseEmbeddingRecord,
): RetrievalCandidate | null => {
  const score = sparseDotProduct(
    query.indices,
    query.values,
    embedding.indices,
    embedding.values,
  );
  if (score === null) return null;

  return {
    questionId: embedding.questionId,
    version: embedding.version,
    score,
    retrievalVersion: sparseRepresentationVersion,
    model: embedding.model,
    representationVersion: embedding.representationVersion,
  };
};

const compareSparseCandidates = (
  left: RetrievalCandidate,
  right: RetrievalCandidate,
) =>
  right.score - left.score ||
  left.questionId.localeCompare(right.questionId) ||
  left.version - right.version;

const selectTopSparseCandidates = (
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
    .sort(compareSparseCandidates)
    .slice(0, limit);

const scanSparseEmbeddings = async ({
  query,
  embeddings,
  eligibleVersions,
  sourceQuestionId,
  limit,
}: {
  query: { indices: number[]; values: number[] };
  embeddings: AsyncIterable<SparseEmbeddingRecord>;
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
    const candidate = scoreSparseEmbedding(query, embedding);
    if (candidate)
      candidates = selectTopSparseCandidates([...candidates, candidate], limit);
  }
  return candidates;
};

export {
  scanSparseEmbeddings,
  scoreSparseEmbedding,
  selectTopSparseCandidates,
  sparseDotProduct,
};
