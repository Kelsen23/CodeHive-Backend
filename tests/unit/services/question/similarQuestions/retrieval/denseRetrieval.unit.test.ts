import { describe, expect, it, vi } from "vitest";

import findSimilarQuestionCandidates from "../../../../../../src/services/question/similarQuestions/similarQuestionsSearch.service.js";

const embedding = (questionId: string, version: number, vector: number[]) => ({
  questionId,
  version,
  vector,
  model: "test-model",
  representationVersion: "dense-v1",
});

describe("dense retrieval orchestration", () => {
  it("supports an injected corpus and post-retrieval validation", async () => {
    let streamClosed = false;

    const candidates = await findSimilarQuestionCandidates({
      sourceQuestionId: "source",
      sourceVersion: 1,
      title: "Source title",
      body: "Source body",
      tags: [],
      limit: 50,
      resultLimit: 50,
      queryVector: [1, 0],
      model: "test-model",
      corpus: {
        loadCurrentEligibleQuestionVersions: async () => [
          { questionId: "source", version: 1 },
          { questionId: "candidate", version: 2 },
          { questionId: "weak-candidate", version: 1 },
        ],
        streamDenseEmbeddings: () => {
          const stream = (async function* () {
            yield embedding("source", 1, [1, 0]);
            yield embedding("candidate", 2, [1, 0]);
            yield embedding("weak-candidate", 1, [
              0.7,
              Math.sqrt(1 - 0.7 ** 2),
            ]);
          })();

          return Object.assign(stream, {
            close: async () => {
              streamClosed = true;
            },
          });
        },
        loadCurrentEligibleQuestionVersionsById: async () => [
          { questionId: "candidate", version: 2 },
          { questionId: "weak-candidate", version: 1 },
        ],
      },
    });

    expect(candidates).toEqual([
      {
        questionId: "candidate",
        version: 2,
        score: 1,
        retrievalVersion: "dense-v1",
        model: "test-model",
        representationVersion: "dense-v1",
      },
    ]);
    expect(streamClosed).toBe(true);
  });

  it("removes a candidate that becomes ineligible during retrieval", async () => {
    const candidates = await findSimilarQuestionCandidates({
      sourceQuestionId: "source",
      sourceVersion: 1,
      title: "Source title",
      body: "Source body",
      tags: [],
      limit: 50,
      queryVector: [1, 0],
      model: "test-model",
      corpus: {
        loadCurrentEligibleQuestionVersions: async () => [
          { questionId: "candidate", version: 1 },
        ],
        streamDenseEmbeddings: () =>
          (async function* () {
            yield embedding("candidate", 1, [1, 0]);
          })(),
        loadCurrentEligibleQuestionVersionsById: async () => [],
      },
    });

    expect(candidates).toEqual([]);
  });

  it("uses indexed retrieval without scanning the full corpus", async () => {
    const searchDenseEmbeddings = vi.fn(async () => [
      {
        questionId: "source",
        version: 1,
        score: 0.99,
        retrievalVersion: "dense-v1",
        model: "test-model",
        representationVersion: "dense-v1",
      },
      {
        questionId: "candidate",
        version: 2,
        score: 0.8,
        retrievalVersion: "dense-v1",
        model: "test-model",
        representationVersion: "dense-v1",
      },
      {
        questionId: "stale-candidate",
        version: 1,
        score: 0.9,
        retrievalVersion: "dense-v1",
        model: "test-model",
        representationVersion: "dense-v1",
      },
      {
        questionId: "below-threshold",
        version: 1,
        score: 0.71,
        retrievalVersion: "dense-v1",
        model: "test-model",
        representationVersion: "dense-v1",
      },
    ]);
    const loadCurrentEligibleQuestionVersions = vi.fn(async () => {
      throw new Error("indexed retrieval must not scan the full corpus");
    });
    const loadCurrentEligibleQuestionVersionsById = vi.fn(async () => [
      { questionId: "candidate", version: 2 },
    ]);

    const candidates = await findSimilarQuestionCandidates({
      sourceQuestionId: "source",
      sourceVersion: 1,
      title: "Source title",
      body: "Source body",
      tags: [],
      limit: 50,
      queryVector: [1, 0],
      model: "test-model",
      scoreThreshold: 0.72,
      corpus: {
        loadCurrentEligibleQuestionVersions,
        streamDenseEmbeddings: () => {
          throw new Error("indexed retrieval must not stream embeddings");
        },
        loadCurrentEligibleQuestionVersionsById,
        searchDenseEmbeddings,
      },
    });

    expect(searchDenseEmbeddings).toHaveBeenCalledWith({
      queryVector: [1, 0],
      model: "test-model",
      limit: 50,
    });
    expect(loadCurrentEligibleQuestionVersions).not.toHaveBeenCalled();
    expect(loadCurrentEligibleQuestionVersionsById).toHaveBeenCalledWith([
      "source",
      "candidate",
      "stale-candidate",
    ]);
    expect(candidates).toEqual([
      {
        questionId: "candidate",
        version: 2,
        score: 0.8,
        retrievalVersion: "dense-v1",
        model: "test-model",
        representationVersion: "dense-v1",
      },
    ]);
  });
});
