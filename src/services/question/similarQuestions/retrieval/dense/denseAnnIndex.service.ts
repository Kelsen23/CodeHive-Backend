import hnswlib from "hnswlib-node";

import type {
  DenseEmbeddingRecord,
  RetrievalCandidate,
} from "../retrieval.types.js";

import { scoreDenseEmbedding } from "./denseScoring.service.js";

const denseAnnIndexDimension = 1024;

type DenseAnnIndex = {
  search: (queryVector: number[], limit: number) => RetrievalCandidate[];
};

const isValidDenseEmbedding = (embedding: DenseEmbeddingRecord) =>
  embedding.vector.length === denseAnnIndexDimension &&
  embedding.vector.every((value) => Number.isFinite(value));

const buildDenseAnnIndex = (
  embeddings: DenseEmbeddingRecord[],
): DenseAnnIndex | null => {
  const validEmbeddings = embeddings.filter(isValidDenseEmbedding);
  if (validEmbeddings.length === 0) return null;

  const index = new hnswlib.HierarchicalNSW("cosine", denseAnnIndexDimension);
  index.initIndex({
    maxElements: validEmbeddings.length,
    m: 16,
    efConstruction: 200,
  });
  index.setEf(200);

  validEmbeddings.forEach((embedding, label) => {
    index.addPoint(embedding.vector, label);
  });

  return {
    search: (queryVector, limit) => {
      if (
        queryVector.length !== denseAnnIndexDimension ||
        queryVector.some((value) => !Number.isFinite(value))
      )
        return [];

      const neighborCount = Math.min(
        Math.max(Math.floor(limit), 1),
        validEmbeddings.length,
      );

      return index
        .searchKnn(queryVector, neighborCount)
        .neighbors.map((label) =>
          scoreDenseEmbedding(queryVector, validEmbeddings[label]),
        )
        .filter((candidate): candidate is RetrievalCandidate =>
          Boolean(candidate),
        );
    },
  };
};

export { buildDenseAnnIndex, denseAnnIndexDimension };
export type { DenseAnnIndex };
