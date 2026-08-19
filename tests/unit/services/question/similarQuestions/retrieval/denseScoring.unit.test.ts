import { describe, expect, it } from "vitest";

import {
  cosineSimilarity,
  scanDenseEmbeddings,
  scoreDenseEmbedding,
  selectTopCandidates,
} from "../../../../../../src/services/question/similarQuestions/retrieval/denseScoring.service.js";

const embedding = (questionId: string, version: number, vector: number[]) => ({
  questionId,
  version,
  vector,
  model: "test-model",
  representationVersion: "dense-v1",
});

describe("dense scoring", () => {
  it("calculates cosine similarity for identical, orthogonal, and opposite vectors", () => {
    expect(cosineSimilarity([1, 0], [1, 0])).toBe(1);
    expect(cosineSimilarity([1, 0], [0, 1])).toBe(0);
    expect(cosineSimilarity([1, 0], [-1, 0])).toBe(-1);
  });

  it("rejects invalid vectors", () => {
    expect(cosineSimilarity([], [])).toBeNull();
    expect(cosineSimilarity([1], [1, 2])).toBeNull();
    expect(cosineSimilarity([0, 0], [1, 0])).toBeNull();
    expect(cosineSimilarity([Number.NaN], [1])).toBeNull();
  });

  it("orders and bounds candidates deterministically", () => {
    const candidates = [
      scoreDenseEmbedding([1, 0], embedding("q-low", 1, [0.5, 0.5])),
      scoreDenseEmbedding([1, 0], embedding("q-high", 1, [1, 0])),
      scoreDenseEmbedding([1, 0], embedding("q-mid", 1, [0.8, 0.2])),
    ].filter((candidate) => candidate !== null);

    expect(
      selectTopCandidates(candidates, 2).map(({ questionId }) => questionId),
    ).toEqual(["q-high", "q-mid"]);
  });

  it("keeps only the highest 50 candidates while applying deterministic ties", async () => {
    const candidates = await scanDenseEmbeddings({
      queryVector: [1, 0],
      embeddings: (async function* () {
        for (let index = 0; index < 51; index += 1) {
          yield embedding(`q-${String(index).padStart(2, "0")}`, 1, [1, 0]);
        }
      })(),
      eligibleVersions: new Set(
        Array.from(
          { length: 51 },
          (_, index) => `q-${String(index).padStart(2, "0")}:1`,
        ),
      ),
      sourceQuestionId: "source",
      limit: 50,
    });

    expect(candidates).toHaveLength(50);
    expect(candidates[0]?.questionId).toBe("q-00");
    expect(candidates.at(-1)?.questionId).toBe("q-49");
  });

  it("filters source, historical, and ineligible versions before scoring", async () => {
    const candidates = await scanDenseEmbeddings({
      queryVector: [1, 0],
      embeddings: (async function* () {
        yield embedding("source", 1, [1, 0]);
        yield embedding("historical", 1, [1, 0]);
        yield embedding("valid", 2, [1, 0]);
      })(),
      eligibleVersions: new Set(["valid:2"]),
      sourceQuestionId: "source",
      limit: 50,
    });

    expect(
      candidates.map(({ questionId, version }) => `${questionId}:${version}`),
    ).toEqual(["valid:2"]);
  });
});
