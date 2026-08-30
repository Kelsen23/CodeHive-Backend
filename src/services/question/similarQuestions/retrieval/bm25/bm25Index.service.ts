import type {
  Bm25CorpusSource,
  Bm25QuestionDocument,
} from "../retrieval.types.js";

type Bm25Field = "title" | "body" | "tags";

type Bm25FieldIndex = {
  averageLength: number;
  documentFrequency: Map<string, number>;
  termFrequencyByDocument: Map<string, Map<string, number>>;
  lengthByDocument: Map<string, number>;
};

type Bm25Index = {
  documents: Map<string, Bm25QuestionDocument>;
  fields: Record<Bm25Field, Bm25FieldIndex>;
};

type Bm25Tokenize = (value: string) => string[];

const fields: Bm25Field[] = ["title", "body", "tags"];

const makeDocumentKey = (questionId: string, version: number) =>
  `${questionId}:${version}`;

const buildBm25Index = (
  documents: Bm25QuestionDocument[],
  tokenize: Bm25Tokenize,
): Bm25Index => {
  const index = {} as Record<Bm25Field, Bm25FieldIndex>;

  for (const field of fields) {
    index[field] = {
      averageLength: 0,
      documentFrequency: new Map(),
      termFrequencyByDocument: new Map(),
      lengthByDocument: new Map(),
    };
  }

  for (const document of documents) {
    const documentKey = makeDocumentKey(document.questionId, document.version);

    for (const field of fields) {
      const value =
        field === "tags" ? document.tags.join(" ") : document[field];
      const tokens = tokenize(value);
      const fieldIndex = index[field];
      const termFrequencies = new Map<string, number>();

      for (const token of tokens) {
        termFrequencies.set(token, (termFrequencies.get(token) ?? 0) + 1);
      }

      fieldIndex.lengthByDocument.set(documentKey, tokens.length);
      fieldIndex.termFrequencyByDocument.set(documentKey, termFrequencies);

      for (const token of new Set(tokens)) {
        fieldIndex.documentFrequency.set(
          token,
          (fieldIndex.documentFrequency.get(token) ?? 0) + 1,
        );
      }
    }
  }

  for (const field of fields) {
    const lengths = [...index[field].lengthByDocument.values()];
    index[field].averageLength =
      lengths.length === 0
        ? 0
        : lengths.reduce((total, length) => total + length, 0) / lengths.length;
  }

  return {
    documents: new Map(
      documents.map((document) => [
        makeDocumentKey(document.questionId, document.version),
        document,
      ]),
    ),
    fields: index,
  };
};

let cachedIndex: { source: Bm25CorpusSource; index: Bm25Index } | undefined;
let buildPromise: Promise<Bm25Index> | undefined;

const getBm25Index = async (
  source: Bm25CorpusSource,
  tokenize: Bm25Tokenize,
) => {
  if (cachedIndex?.source === source) return cachedIndex.index;

  if (!buildPromise) {
    buildPromise = source
      .loadCurrentEligibleQuestionDocuments()
      .then((documents) => buildBm25Index(documents, tokenize))
      .finally(() => {
        buildPromise = undefined;
      });
  }

  const index = await buildPromise;
  cachedIndex = { source, index };
  return index;
};

const invalidateBm25Index = () => {
  cachedIndex = undefined;
};

export {
  buildBm25Index,
  getBm25Index,
  invalidateBm25Index,
  makeDocumentKey,
  type Bm25Field,
  type Bm25FieldIndex,
  type Bm25Index,
  type Bm25Tokenize,
};
