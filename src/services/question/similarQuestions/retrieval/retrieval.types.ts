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
};

type DenseEmbeddingRecord = {
  questionId: string;
  version: number;
  vector: number[];
  model: string;
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

type RetrievalRunner = (input: RetrievalInput) => Promise<RetrievalCandidate[]>;

export type {
  DenseEmbeddingRecord,
  DenseCorpusSource,
  DenseEmbeddingStream,
  EligibleQuestionVersion,
  RetrievalCandidate,
  RetrievalInput,
  RetrievalRunner,
};
