import type {
  Bm25QuestionDocument,
  RetrievalCandidate,
} from "../retrieval.types.js";
import type { Bm25Field, Bm25Index } from "./bm25Index.service.js";

import { makeDocumentKey } from "./bm25Index.service.js";

const bm25RepresentationVersion = "bm25-v1";
const bm25RetrievalVersion = "bm25-v1";
const bm25K1 = 1.2;
const bm25B = 0.75;
const bm25FieldWeights: Record<Bm25Field, number> = {
  title: 3,
  tags: 2,
  body: 1,
};

const tokenizeBm25 = (value: string) =>
  value.toLocaleLowerCase().match(/[a-z0-9]+(?:[._:/#-][a-z0-9]+)*/g) ?? [];

const fieldValue = (document: Bm25QuestionDocument, field: Bm25Field) =>
  field === "tags" ? document.tags.join(" ") : document[field];

const scoreBm25Document = ({
  query,
  document,
  index,
  tokenize = tokenizeBm25,
}: {
  query: Bm25QuestionDocument;
  document: Bm25QuestionDocument;
  index: Bm25Index;
  tokenize?: (value: string) => string[];
}) => {
  let score = 0;

  for (const field of ["title", "body", "tags"] as Bm25Field[]) {
    const fieldIndex = index.fields[field];
    const queryTerms = new Set(tokenize(fieldValue(query, field)));
    const documentKey = makeDocumentKey(document.questionId, document.version);
    const termFrequencies = fieldIndex.termFrequencyByDocument.get(documentKey);
    const documentLength = fieldIndex.lengthByDocument.get(documentKey) ?? 0;

    if (!termFrequencies || documentLength === 0) continue;

    for (const term of queryTerms) {
      const termFrequency = termFrequencies.get(term) ?? 0;
      const documentFrequency = fieldIndex.documentFrequency.get(term) ?? 0;

      if (termFrequency === 0 || documentFrequency === 0) continue;

      const idf = Math.log(
        1 +
          (index.documents.size - documentFrequency + 0.5) /
            (documentFrequency + 0.5),
      );
      const normalization =
        bm25K1 *
        (1 -
          bm25B +
          bm25B * (documentLength / Math.max(fieldIndex.averageLength, 1)));
      const termScore =
        idf *
        ((termFrequency * (bm25K1 + 1)) / (termFrequency + normalization));

      score += bm25FieldWeights[field] * termScore;
    }
  }

  return score;
};

const compareBm25Candidates = (
  left: RetrievalCandidate,
  right: RetrievalCandidate,
) =>
  right.score - left.score ||
  left.questionId.localeCompare(right.questionId) ||
  left.version - right.version;

const scoreBm25Index = ({
  query,
  index,
  sourceQuestionId,
  limit,
  tokenize = tokenizeBm25,
}: {
  query: Bm25QuestionDocument;
  index: Bm25Index;
  sourceQuestionId: string;
  limit: number;
  tokenize?: (value: string) => string[];
}) => {
  const candidates = [...index.documents.values()]
    .filter((document) => document.questionId !== sourceQuestionId)
    .map((document) => ({
      questionId: document.questionId,
      version: document.version,
      score: scoreBm25Document({ query, document, index, tokenize }),
      retrievalVersion: bm25RetrievalVersion,
      model: "bm25",
      representationVersion: bm25RepresentationVersion,
    }))
    .filter((candidate) => candidate.score > 0)
    .sort(compareBm25Candidates)
    .slice(0, limit);

  return candidates.map((candidate, index) => ({
    ...candidate,
    diagnostics: {
      bm25: { rank: index + 1, score: candidate.score },
    },
  }));
};

export {
  bm25B,
  bm25FieldWeights,
  bm25K1,
  bm25RepresentationVersion,
  bm25RetrievalVersion,
  compareBm25Candidates,
  scoreBm25Document,
  scoreBm25Index,
  tokenizeBm25,
};
