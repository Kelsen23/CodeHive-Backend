import mongoose from "mongoose";

import type {
  DenseEmbeddingRecord,
  EligibleQuestionVersion,
} from "../retrieval.types.js";

import { denseRepresentationVersion } from "../../../embedding/dense/questionEmbedding.shared.js";
import {
  eligibleQuestionProcessingStateMatch,
  publicQuestionProcessingStateMatch,
} from "../../similarQuestions.shared.js";
import {
  buildDenseAnnIndex,
  type DenseAnnIndex,
} from "./denseAnnIndex.service.js";

import Question from "../../../../../models/question.model.js";
import QuestionEmbedding from "../../../../../models/questionEmbedding.model.js";
import QuestionProcessingState from "../../../../../models/questionProcessingState.model.js";

const denseAnnIndexMaxAgeMs = 5 * 60 * 1000;
const denseAnnCandidateOversampleFactor = 5;
const denseAnnIndexCache = new Map<
  string,
  { builtAt: number; promise: Promise<DenseAnnIndex | null> }
>();

const loadEligibleQuestionVersions = async ({
  questionIds,
  requireEmbedding,
}: {
  questionIds?: string[];
  requireEmbedding: boolean;
}) => {
  if (questionIds?.length === 0) return [];

  const states = await QuestionProcessingState.aggregate<{
    questionId: unknown;
    questionVersion: number;
  }>([
    {
      $match: {
        ...(requireEmbedding
          ? eligibleQuestionProcessingStateMatch
          : publicQuestionProcessingStateMatch),
        ...(questionIds
          ? {
              questionId: {
                $in: questionIds.map((id) => new mongoose.Types.ObjectId(id)),
              },
            }
          : {}),
      },
    },
    {
      $lookup: {
        from: Question.collection.name,
        let: { questionId: "$questionId", version: "$questionVersion" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$_id", "$$questionId"] },
                  { $eq: ["$currentVersion", "$$version"] },
                  { $eq: ["$isActive", true] },
                  { $eq: ["$isDeleted", false] },
                ],
              },
            },
          },
          { $project: { _id: 1 } },
        ],
        as: "question",
      },
    },
    { $unwind: "$question" },
    { $project: { _id: 0, questionId: 1, questionVersion: 1 } },
  ]);

  return states.map<EligibleQuestionVersion>((state) => ({
    questionId: String(state.questionId),
    version: state.questionVersion,
  }));
};

const loadCurrentEligibleQuestionVersions = async () =>
  loadEligibleQuestionVersions({ requireEmbedding: true });

const loadCurrentLiveEligibleQuestionVersions = async () =>
  loadEligibleQuestionVersions({ requireEmbedding: false });

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
  return loadEligibleQuestionVersions({ questionIds, requireEmbedding: true });
};

const loadCurrentLiveEligibleQuestionVersionsById = async (
  questionIds: string[],
) => {
  return loadEligibleQuestionVersions({ questionIds, requireEmbedding: false });
};

export {
  denseRepresentationVersion,
  denseAnnIndexMaxAgeMs,
  loadCurrentEligibleQuestionVersions,
  loadCurrentEligibleQuestionVersionsById,
  loadCurrentLiveEligibleQuestionVersions,
  loadCurrentLiveEligibleQuestionVersionsById,
  searchDenseEmbeddings,
  streamDenseEmbeddings,
};
