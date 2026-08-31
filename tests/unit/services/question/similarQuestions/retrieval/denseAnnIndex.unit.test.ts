import { describe, expect, it } from "vitest";

import {
  buildDenseAnnIndex,
  denseAnnIndexDimension,
} from "../../../../../../src/services/question/similarQuestions/retrieval/dense/denseAnnIndex.service.js";

const vector = (firstValue: number) => {
  const values = new Array(denseAnnIndexDimension).fill(0);
  values[0] = firstValue;
  return values;
};

const embedding = (questionId: string, firstValue: number) => ({
  questionId,
  version: 1,
  vector: vector(firstValue),
  model: "test-model",
  representationVersion: "dense-v1",
});

describe("dense ANN index", () => {
  it("returns exact cosine-scored candidates from indexed neighbors", () => {
    const index = buildDenseAnnIndex([
      embedding("same-direction", 1),
      embedding("opposite-direction", -1),
    ]);

    expect(index?.search(vector(1), 2)).toEqual([
      {
        questionId: "same-direction",
        version: 1,
        score: 1,
        retrievalVersion: "dense-v1",
        model: "test-model",
        representationVersion: "dense-v1",
      },
      {
        questionId: "opposite-direction",
        version: 1,
        score: -1,
        retrievalVersion: "dense-v1",
        model: "test-model",
        representationVersion: "dense-v1",
      },
    ]);
  });

  it("does not create an index for invalid dimensions", () => {
    expect(
      buildDenseAnnIndex([
        {
          ...embedding("invalid", 1),
          vector: [1, 0],
        },
      ]),
    ).toBeNull();
  });
});
