type RetrievalInput = {
  sourceQuestionId: string;
  sourceVersion: number;
  title: string;
  body: string;
  tags: string[];
  limit: number;
};

type RetrievalCandidate = {
  questionId: string;
  version: number;
  score: number;
  retrievalVersion: string;
  model: string;
  representationVersion: string;
  diagnostics?: RetrievalCandidateDiagnostics;
};

type RetrievalCandidateDiagnostics = {
  dense?: {
    rank: number;
    score: number;
  };
  bm25?: {
    rank: number;
    score: number;
  };
  sparse?: {
    rank: number;
    score: number;
  };
  rrf?: {
    k: number;
    weights?: {
      dense?: number;
      sparse?: number;
      bm25?: number;
    };
  };
  colbert?: {
    queryTokenCount: number;
    documentTokenCount: number;
    dimensions: number;
  };
  reranker?: {
    rank: number;
    score: number;
  };
};

type Bm25QuestionDocument = {
  questionId: string;
  version: number;
  title: string;
  body: string;
  tags: string[];
};

type RerankerQuestionDocument = Bm25QuestionDocument;

type DenseEmbeddingRecord = {
  questionId: string;
  version: number;
  vector: number[];
  model: string;
  representationVersion: string;
};

type SparseEmbeddingRecord = {
  questionId: string;
  version: number;
  indices: number[];
  values: number[];
  model: string;
  representationVersion: string;
};

type SparseQuestionDocument = Bm25QuestionDocument;

type MultiVectorEmbeddingRecord = {
  questionId: string;
  version: number;
  vectors: number[][];
  model: string;
  dimensions: number;
  tokenCount: number;
  representationVersion: string;
};

type EligibleQuestionVersion = {
  questionId: string;
  version: number;
};

type DenseEmbeddingStream = AsyncIterable<DenseEmbeddingRecord> & {
  close?: () => Promise<unknown>;
};

type DenseCorpusSource = {
  loadCurrentEligibleQuestionVersions: () => Promise<EligibleQuestionVersion[]>;
  streamDenseEmbeddings: (input: { model: string }) => DenseEmbeddingStream;
  loadCurrentEligibleQuestionVersionsById: (
    questionIds: string[],
  ) => Promise<EligibleQuestionVersion[]>;
};

type SparseEmbeddingStream = AsyncIterable<SparseEmbeddingRecord> & {
  close?: () => Promise<unknown>;
};

type SparseCorpusSource = {
  loadCurrentEligibleQuestionVersions: () => Promise<EligibleQuestionVersion[]>;
  streamSparseEmbeddings: (input: { model: string }) => SparseEmbeddingStream;
  loadCurrentEligibleQuestionVersionsById: (
    questionIds: string[],
  ) => Promise<EligibleQuestionVersion[]>;
};

type MultiVectorEmbeddingStream = AsyncIterable<MultiVectorEmbeddingRecord> & {
  close?: () => Promise<unknown>;
};

type MultiVectorCorpusSource = {
  loadCurrentEligibleQuestionVersions: () => Promise<EligibleQuestionVersion[]>;
  streamMultiVectorEmbeddings: (input: {
    model: string;
  }) => MultiVectorEmbeddingStream;
  loadCurrentEligibleQuestionVersionsById: (
    questionIds: string[],
  ) => Promise<EligibleQuestionVersion[]>;
};

type Bm25CorpusSource = {
  loadCurrentEligibleQuestionDocuments: () => Promise<Bm25QuestionDocument[]>;
  loadCurrentEligibleQuestionDocumentsById: (
    questionIds: string[],
  ) => Promise<EligibleQuestionVersion[]>;
};

type HybridCorpusSource = DenseCorpusSource & Bm25CorpusSource;

type DenseSparseCorpusSource = DenseCorpusSource & SparseCorpusSource;

type DenseSparseBm25CorpusSource = DenseSparseCorpusSource & Bm25CorpusSource;

type RerankerCorpusSource = DenseCorpusSource & {
  loadQuestionDocumentsById: (
    identities: Array<{ questionId: string; version: number }>,
  ) => Promise<RerankerQuestionDocument[]>;
};

type RetrievalRunner = (input: RetrievalInput) => Promise<RetrievalCandidate[]>;

export type {
  DenseEmbeddingRecord,
  SparseEmbeddingRecord,
  SparseEmbeddingStream,
  SparseCorpusSource,
  SparseQuestionDocument,
  MultiVectorEmbeddingRecord,
  MultiVectorEmbeddingStream,
  MultiVectorCorpusSource,
  DenseCorpusSource,
  DenseEmbeddingStream,
  Bm25CorpusSource,
  Bm25QuestionDocument,
  HybridCorpusSource,
  DenseSparseCorpusSource,
  DenseSparseBm25CorpusSource,
  RerankerCorpusSource,
  RerankerQuestionDocument,
  EligibleQuestionVersion,
  RetrievalCandidateDiagnostics,
  RetrievalCandidate,
  RetrievalInput,
  RetrievalRunner,
};
