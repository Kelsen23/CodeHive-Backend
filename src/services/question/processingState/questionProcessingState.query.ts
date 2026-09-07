import mongoose from "mongoose";

import Question from "../../../models/question.model.js";
import QuestionProcessingState from "../../../models/questionProcessingState.model.js";

const downstreamAllowedSecurityVerifierStatuses = [
  "NOT_REQUIRED",
  "ALLOWED",
  "ALLOWED_WITH_CONSTRAINTS",
] as const;

const publicQuestionProcessingStateMatch = {
  moderationStatus: { $in: ["APPROVED", "FLAGGED"] },
  questionEligibilityStatus: "ALLOWED",
  securityVerifierStatus: {
    $in: downstreamAllowedSecurityVerifierStatuses,
  },
};

const eligibleQuestionProcessingStateMatch = {
  ...publicQuestionProcessingStateMatch,
  embeddingStatus: "READY",
};

const buildProcessingStateLookupStages = ({
  as = "processingState",
  match,
  preserveMissing = false,
  requireCurrentVersion = true,
}: {
  as?: string;
  match?: Record<string, unknown>;
  preserveMissing?: boolean;
  requireCurrentVersion?: boolean;
} = {}) => [
  {
    $lookup: {
      from: QuestionProcessingState.collection.name,
      localField: "_id",
      foreignField: "questionId",
      as,
    },
  },
  {
    $unwind: {
      path: `$${as}`,
      preserveNullAndEmptyArrays: preserveMissing,
    },
  },
  ...(requireCurrentVersion
    ? [
        {
          $match: {
            $or: [
              { [`${as}.questionVersion`]: { $exists: false } },
              {
                $expr: {
                  $eq: [`$${as}.questionVersion`, "$currentVersion"],
                },
              },
            ],
          },
        },
      ]
    : []),
  ...(match
    ? [
        {
          $match: Object.fromEntries(
            Object.entries(match).map(([key, value]) => [
              `${as}.${key}`,
              value,
            ]),
          ),
        },
      ]
    : []),
];

const loadQuestionWithProcessingState = async ({
  questionId,
  questionMatch = {},
}: {
  questionId: string;
  questionMatch?: Record<string, unknown>;
}) => {
  const [result] = await Question.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(questionId),
        ...questionMatch,
      },
    },
    ...buildProcessingStateLookupStages({
      preserveMissing: true,
      requireCurrentVersion: false,
    }),
    { $limit: 1 },
  ]);

  return result ?? null;
};

export {
  buildProcessingStateLookupStages,
  downstreamAllowedSecurityVerifierStatuses,
  eligibleQuestionProcessingStateMatch,
  loadQuestionWithProcessingState,
  publicQuestionProcessingStateMatch,
};
