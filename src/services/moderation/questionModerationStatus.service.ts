import type { ClientSession } from "mongoose";

import { updateQuestionProcessingState } from "../question/processingState/questionProcessingState.service.js";

import QuestionVersion from "../../models/questionVersion.model.js";

type ModerationStatus = "PENDING" | "APPROVED" | "FLAGGED" | "REJECTED";

type QuestionVersionModerationSnapshot = {
  version: number;
  moderationStatus?: ModerationStatus | null;
};

const moderationSeverity: Record<ModerationStatus, number> = {
  PENDING: 0,
  APPROVED: 1,
  FLAGGED: 2,
  REJECTED: 3,
};

const normalizeModerationStatus = (
  status?: ModerationStatus | null,
): ModerationStatus => status ?? "PENDING";

const isWorseQuestionVersionStatus = (
  candidate: QuestionVersionModerationSnapshot,
  current: QuestionVersionModerationSnapshot,
) => {
  const candidateStatus = normalizeModerationStatus(candidate.moderationStatus);
  const currentStatus = normalizeModerationStatus(current.moderationStatus);
  const candidateSeverity = moderationSeverity[candidateStatus];
  const currentSeverity = moderationSeverity[currentStatus];

  if (candidateSeverity !== currentSeverity) {
    return candidateSeverity > currentSeverity;
  }

  return Number(candidate.version) > Number(current.version);
};

const getWorstQuestionVersionModerationStatus = async (
  questionId: string,
  session: ClientSession,
) => {
  const questionVersions = await QuestionVersion.find({ questionId })
    .select("version moderationStatus")
    .session(session)
    .lean<QuestionVersionModerationSnapshot[]>();

  if (questionVersions.length === 0) {
    return null;
  }

  const worstQuestionVersion = questionVersions.reduce((worst, candidate) =>
    isWorseQuestionVersionStatus(candidate, worst) ? candidate : worst,
  );

  return {
    moderationStatus: normalizeModerationStatus(
      worstQuestionVersion.moderationStatus,
    ),
    moderationSourceVersion: Number(worstQuestionVersion.version),
  };
};

const syncQuestionModerationStatusFromVersions = async ({
  questionId,
  moderationUpdatedAt,
  session,
}: {
  questionId: string;
  moderationUpdatedAt: Date;
  session: ClientSession;
}) => {
  const worstVersionStatus = await getWorstQuestionVersionModerationStatus(
    questionId,
    session,
  );

  if (!worstVersionStatus) {
    throw new Error("Question version not found");
  }

  const updatedState = await updateQuestionProcessingState({
    questionId,
    set: {
      moderationStatus: worstVersionStatus.moderationStatus,
      moderationUpdatedAt,
      moderationSourceVersion: worstVersionStatus.moderationSourceVersion,
    },
    session,
  });

  if (updatedState.matchedCount !== 1) {
    throw new Error("Question processing state not found");
  }

  return worstVersionStatus;
};

export type { ModerationStatus };

export {
  moderationSeverity,
  getWorstQuestionVersionModerationStatus,
  syncQuestionModerationStatusFromVersions,
};
