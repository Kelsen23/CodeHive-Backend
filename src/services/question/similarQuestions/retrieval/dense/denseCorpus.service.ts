import type {
  DenseEmbeddingRecord,
  EligibleQuestionVersion,
} from "../retrieval.types.js";

import { denseRepresentationVersion } from "../../../embedding/dense/questionEmbedding.shared.js";
import {
  currentEligibleQuestionMatch,
  currentLiveEligibleQuestionMatch,
} from "../../similarQuestions.shared.js";
import {
  buildDenseAnnIndex,
  type DenseAnnIndex,
} from "./denseAnnIndex.service.js";

import Question from "../../../../../models/question.model.js";
import QuestionEmbedding from "../../../../../models/questionEmbedding.model.js";

const denseAnnIndexMaxAgeMs = 5 * 60 * 1000;
const denseAnnCandidateOversampleFactor = 5;
const denseAnnIndexCache = new Map<
  string,
  { builtAt: number; promise: Promise<DenseAnnIndex | null> }
>();

const loadCurrentEligibleQuestionVersions = async () => {
  const questions = await Question.find(currentEligibleQuestionMatch)
    .select("_id currentVersion")
    .lean<{ _id: unknown; currentVersion: number }[]>();

  return questions.map<EligibleQuestionVersion>((question) => ({
    questionId: String(question._id),
    version: question.currentVersion,
  }));
};

const streamDenseEmbeddings = ({ model }: { model: string }) =>
  QuestionEmbedding.find({
    model,
    representationVersion: denseRepresentationVersion,
  })
    .select("questionId version vector model representationVersion")
    .lean<DenseEmbeddingRecord>()
    .cursor();

const buildModelDenseAnnIndex = async (model: string) => {
  const embeddings: DenseEmbeddingRecord[] = [];
  const cursor = streamDenseEmbeddings({ model });

  try {
    for await (const embedding of cursor) embeddings.push(embedding);
  } finally {
    await cursor.close?.();
  }

  return buildDenseAnnIndex(embeddings);
};

const getModelDenseAnnIndex = (model: string) => {
  const cached = denseAnnIndexCache.get(model);
  const now = Date.now();

  if (cached && now - cached.builtAt < denseAnnIndexMaxAgeMs)
    return cached.promise;

  const promise = buildModelDenseAnnIndex(model);
  denseAnnIndexCache.set(model, { builtAt: now, promise });

  void promise.catch(() => {
    if (denseAnnIndexCache.get(model)?.promise === promise)
      denseAnnIndexCache.delete(model);
  });

  return promise;
};

const searchDenseEmbeddings = async ({
  queryVector,
  model,
  limit,
}: {
  queryVector: number[];
  model: string;
  limit: number;
}) =>
  (await getModelDenseAnnIndex(model))?.search(
    queryVector,
    Math.max(limit * denseAnnCandidateOversampleFactor + 1, 101),
  ) ?? [];

const loadCurrentEligibleQuestionVersionsById = async (
  questionIds: string[],
) => {
  if (questionIds.length === 0) return [];

  const questions = await Question.find({
    _id: { $in: questionIds },
    ...currentEligibleQuestionMatch,
  })
    .select("_id currentVersion")
    .lean<{ _id: unknown; currentVersion: number }[]>();

  return questions.map<EligibleQuestionVersion>((question) => ({
    questionId: String(question._id),
    version: question.currentVersion,
  }));
};

const loadCurrentLiveEligibleQuestionVersionsById = async (
  questionIds: string[],
) => {
  if (questionIds.length === 0) return [];

  const questions = await Question.find({
    _id: { $in: questionIds },
    ...currentLiveEligibleQuestionMatch,
  })
    .select("_id currentVersion")
    .lean<{ _id: unknown; currentVersion: number }[]>();

  return questions.map<EligibleQuestionVersion>((question) => ({
    questionId: String(question._id),
    version: question.currentVersion,
  }));
};

export {
  currentEligibleQuestionMatch,
  currentLiveEligibleQuestionMatch,
  denseRepresentationVersion,
  denseAnnIndexMaxAgeMs,
  loadCurrentEligibleQuestionVersions,
  loadCurrentEligibleQuestionVersionsById,
  loadCurrentLiveEligibleQuestionVersionsById,
  searchDenseEmbeddings,
  streamDenseEmbeddings,
};
