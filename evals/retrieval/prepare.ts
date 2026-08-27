import generateEmbedding from "../../src/services/question/ai/generateEmbedding.service.js";
import buildQuestionEmbeddingInput from "../../src/services/question/embedding/questionEmbeddingText.service.js";
import type {
  DenseCorpusSource,
  DenseEmbeddingRecord,
} from "../../src/services/question/similarQuestions/retrieval/retrieval.types.js";

import type { RetrievalCorpus } from "./schema.js";

type EmbeddingGenerator = (text: string) => Promise<{
  embedding: number[];
  model: string;
}>;

const prepareDenseEvalCorpus = async (
  corpus: RetrievalCorpus,
  embeddingGenerator: EmbeddingGenerator = generateEmbedding,
): Promise<DenseCorpusSource> => {
  const embeddings: DenseEmbeddingRecord[] = [];

  for (const question of corpus) {
    const { embedding, model } = await embeddingGenerator(
      buildQuestionEmbeddingInput(question).text,
    );

    embeddings.push({
      questionId: question.questionId,
      version: question.version,
      vector: embedding,
      model,
      representationVersion: "dense-v1",
    });
  }

  const models = new Set(embeddings.map(({ model }) => model));

  if (models.size !== 1) {
    throw new Error(
      `Dense eval corpus must use exactly one embedding model; found ${models.size}`,
    );
  }

  const loadCurrentEligibleQuestionVersions = async () =>
    corpus.map(({ questionId, version }) => ({ questionId, version }));
  const loadCurrentEligibleQuestionVersionsById = async (
    questionIds: string[],
  ) => {
    const questionIdSet = new Set(questionIds);

    return corpus
      .filter(({ questionId }) => questionIdSet.has(questionId))
      .map(({ questionId, version }) => ({ questionId, version }));
  };

  return {
    loadCurrentEligibleQuestionVersions,
    loadCurrentEligibleQuestionVersionsById,
    streamDenseEmbeddings: ({ model }) => {
      const stream = (async function* () {
        for (const embedding of embeddings) {
          if (embedding.model === model) yield embedding;
        }
      })();

      return Object.assign(stream, {
        close: async () => undefined,
      });
    },
  };
};

export { prepareDenseEvalCorpus };
