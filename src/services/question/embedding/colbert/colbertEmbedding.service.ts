import { encodeColbertText } from "./colbertEmbeddingWorker.service.js";

import colbertConfig from "../../../../config/colbert.config.js";

import normalizeText from "../../../../utils/question/normalizeText.util.js";

import QuestionMultiVectorEmbedding from "../../../../models/questionMultiVectorEmbedding.model.js";

const colbertRepresentationVersion = "colbert-v1";

const buildColbertEmbeddingInput = ({
  title,
  body,
  tags,
}: {
  title: string;
  body: string;
  tags: string[];
}) =>
  `Title: ${normalizeText(title)}\nTags: ${tags.map(normalizeText).join(", ")}\nBody: ${normalizeText(body)}`;

const generateColbertEmbedding = async ({
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
  const response = await encodeColbertText(mode, [
    buildColbertEmbeddingInput({ title, body, tags }),
  ]);
  const responseVectors = response.vectors;
  const responseTokenCounts = response.tokenCounts;
  const dimensions = response.dimensions;
  if (!responseVectors || !responseTokenCounts || !dimensions)
    throw new Error("ColBERT worker returned incomplete vectors");
  const vectors = responseVectors[0];
  const tokenCount = responseTokenCounts[0];
  if (!vectors || !tokenCount) throw new Error("ColBERT returned no vectors");

  return {
    vectors,
    dimensions,
    tokenCount,
    model: colbertConfig.model,
    representationVersion: colbertRepresentationVersion,
  };
};

const persistColbertEmbedding = async ({
  questionId,
  version,
  embedding,
}: {
  questionId: string;
  version: number;
  embedding: Awaited<ReturnType<typeof generateColbertEmbedding>>;
}) =>
  QuestionMultiVectorEmbedding.updateOne(
    {
      questionId,
      version,
      model: embedding.model,
      representationVersion: embedding.representationVersion,
    },
    {
      $set: {
        vectors: embedding.vectors,
        dimensions: embedding.dimensions,
        tokenCount: embedding.tokenCount,
      },
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
  buildColbertEmbeddingInput,
  colbertRepresentationVersion,
  generateColbertEmbedding,
  persistColbertEmbedding,
};
