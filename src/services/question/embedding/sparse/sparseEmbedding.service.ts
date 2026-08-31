import buildQuestionEmbeddingInput from "../dense/questionEmbeddingText.service.js";
import {
  encodeSparseText,
  type SparseVector,
} from "./sparseEmbeddingWorker.service.js";

import spladeConfig from "../../../../config/splade.config.js";
import QuestionSparseEmbedding from "../../../../models/questionSparseEmbedding.model.js";

const sparseRepresentationVersion = "splade-v1";

const buildSparseEmbeddingInput = ({
  title,
  body,
  tags,
}: {
  title: string;
  body: string;
  tags: string[];
}) =>
  `${buildQuestionEmbeddingInput({ title, body }).text}\nTags: ${tags.join(", ")}`;

const generateSparseEmbedding = async ({
  title,
  body,
  tags,
  mode = "document",
}: {
  title: string;
  body: string;
  tags: string[];
  mode?: "query" | "document";
}) => {
  const [vector] = await encodeSparseText(mode, [
    buildSparseEmbeddingInput({ title, body, tags }),
  ]);
  if (!vector) throw new Error("SPLADE worker returned an empty result");
  return {
    ...vector,
    model: spladeConfig.model,
    representationVersion: sparseRepresentationVersion,
  };
};

const persistSparseEmbedding = async ({
  questionId,
  version,
  embedding,
}: {
  questionId: string;
  version: number;
  embedding: SparseVector & { model: string; representationVersion: string };
}) =>
  QuestionSparseEmbedding.updateOne(
    {
      questionId,
      version,
      model: embedding.model,
      representationVersion: embedding.representationVersion,
    },
    {
      $set: { indices: embedding.indices, values: embedding.values },
      $setOnInsert: {
        questionId,
        version,
        model: embedding.model,
        representationVersion: embedding.representationVersion,
      },
    },
    { upsert: true },
  );

export {
  buildSparseEmbeddingInput,
  generateSparseEmbedding,
  persistSparseEmbedding,
  sparseRepresentationVersion,
};
