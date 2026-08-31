import { describe, expect, it } from "vitest";

import { scanSparseEmbeddings } from "../../../../../../src/services/question/similarQuestions/retrieval/splade/sparseScoring.service.js";

const embedding = (
  questionId: string,
  indices: number[],
  values: number[],
) => ({
  questionId,
  version: 1,
  indices,
  values,
  model: "test-model",
  representationVersion: "splade-v1",
});

describe("sparse scoring", () => {
  it("excludes candidates with zero sparse overlap", async () => {
    const candidates = await scanSparseEmbeddings({
      query: { indices: [1], values: [1] },
      embeddings: (async function* () {
        yield embedding("zero-overlap", [2], [1]);
        yield embedding("positive-overlap", [1], [0.5]);
      })(),
      eligibleVersions: new Set(["zero-overlap:1", "positive-overlap:1"]),
      sourceQuestionId: "source",
      limit: 50,
    });

    expect(candidates.map(({ questionId }) => questionId)).toEqual([
      "positive-overlap",
    ]);
  });
});
