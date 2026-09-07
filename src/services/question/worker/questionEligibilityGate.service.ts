import evaluateQuestionEligibility from "../ai/questionEligibilityGate.service.js";
import { queueAiSuggestionUnlockedNotification } from "../ai/unlockNotification.service.js";
import {
  buildQuestionEligibilityMetadata,
  questionEligibilityStatusByDecision,
  shouldRunSecurityVerifier,
  type ProcessQuestionEligibilityGateJobData,
} from "../questionEligibilityGate/questionEligibilityGate.shared.js";
import queueQuestionGatewayAudit from "../questionEligibilityGate/queueQuestionGatewayAudit.service.js";
import { questionGatewayAuditDecisionByGateDecision } from "../questionEligibilityGate/questionGatewayAudit.shared.js";
import { queueContentPipelineRoute } from "../pipelineRouter/pipelineRouting.service.js";
import {
  findOneAndUpdateQuestionProcessingState,
  updateQuestionProcessingState,
} from "../processingState/questionProcessingState.service.js";
import routeNotification from "../../notification/routeNotification.service.js";

import { getRedisCacheClient } from "../../../config/redis.config.js";

import { makeJobId } from "../../../utils/job/makeJobId.util.js";
import { clearQuestionDiscoveryCache } from "../../../utils/cache/clearCache.util.js";

import QuestionVersion from "../../../models/questionVersion.model.js";
import Question from "../../../models/question.model.js";
import QuestionProcessingState from "../../../models/questionProcessingState.model.js";

const resetQuestionEligibilityProcessing = async (
  questionId: string,
  version: number,
) => {
  await updateQuestionProcessingState({
    questionId,
    questionVersion: version,
    match: {
      questionEligibilityStatus: "PROCESSING",
    },
    set: {
      questionEligibilityStatus: "PENDING",
      questionEligibilityUpdatedAt: null,
      securityVerifierStatus: "NOT_REQUIRED",
      securityVerifierUpdatedAt: null,
      securityVerifierSourceVersion: version,
    },
  });
};

const queueQuestionEligibilitySideEffects = async ({
  questionId,
  version,
  userId,
  questionEligibilityStatus,
  securityVerifierStatus,
}: {
  questionId: string;
  version: number;
  userId: string;
  questionEligibilityStatus: "ALLOWED" | "CLARIFY" | "REJECTED";
  securityVerifierStatus:
    | "NOT_REQUIRED"
    | "PENDING"
    | "ALLOWED"
    | "ALLOWED_WITH_CONSTRAINTS"
    | "REJECTED";
}) => {
  await getRedisCacheClient().del(`question:${questionId}`);
  await clearQuestionDiscoveryCache();

  await queueContentPipelineRoute({
    contentType: "QUESTION",
    contentId: questionId,
    version,
  });

  if (
    questionEligibilityStatus !== "CLARIFY" &&
    questionEligibilityStatus !== "REJECTED"
  ) {
    if (securityVerifierStatus === "NOT_REQUIRED") {
      await queueAiSuggestionUnlockedNotification({
        questionId,
        version,
        userId,
      });
    }

    return;
  }

  await routeNotification({
    recipientId: userId,
    event: "QUESTION_ELIGIBILITY_UPDATE",
    target: {
      entityType: "QUESTION",
      entityId: questionId,
      questionVersion: version,
    },
    meta: {
      questionId,
      questionVersion: version,
      questionEligibilityStatus,
    },
  });
};

const resumeQuestionEligibilitySideEffects = async ({
  questionId,
  version,
}: ProcessQuestionEligibilityGateJobData) => {
  const [question, processingState] = await Promise.all([
    Question.findOne({
      _id: questionId,
      currentVersion: version,
      isActive: true,
      isDeleted: false,
    })
      .select("userId")
      .lean<{ userId: string }>(),
    QuestionProcessingState.findOne({
      questionId,
      questionVersion: version,
    })
      .select(
        "questionEligibilitySourceVersion questionEligibilityStatus securityVerifierStatus",
      )
      .lean<{
        questionEligibilitySourceVersion: number;
        questionEligibilityStatus: "ALLOWED" | "CLARIFY" | "REJECTED";
        securityVerifierStatus:
          | "NOT_REQUIRED"
          | "PENDING"
          | "ALLOWED"
          | "ALLOWED_WITH_CONSTRAINTS"
          | "REJECTED";
      }>(),
  ]);

  if (!question) return;
  if (!processingState) throw new Error("Question processing state missing");
  if (
    processingState.questionEligibilitySourceVersion !== version ||
    !["ALLOWED", "CLARIFY", "REJECTED"].includes(
      processingState.questionEligibilityStatus,
    )
  ) {
    return;
  }

  await queueQuestionEligibilitySideEffects({
    questionId,
    version,
    userId: String(question.userId),
    questionEligibilityStatus: processingState.questionEligibilityStatus,
    securityVerifierStatus: processingState.securityVerifierStatus,
  });
};

const processQuestionEligibilityGateJob = async ({
  questionId,
  version,
}: ProcessQuestionEligibilityGateJobData) => {
  const lockedState = await findOneAndUpdateQuestionProcessingState({
    questionId,
    questionVersion: version,
    match: {
      questionEligibilityStatus: "PENDING",
    },
    set: { questionEligibilityStatus: "PROCESSING" },
  });

  if (!lockedState) {
    await resumeQuestionEligibilitySideEffects({ questionId, version });
    return;
  }

  let statusUpdated = false;
  let auditQueued = false;
  try {
    const [question, questionVersion] = await Promise.all([
      Question.findOne({
        _id: questionId,
        currentVersion: version,
        isActive: true,
        isDeleted: false,
      })
        .select("userId")
        .lean<{ userId: string }>(),
      QuestionVersion.findOne({
        questionId,
        version,
        isActive: true,
        moderationStatus: { $in: ["APPROVED", "FLAGGED"] },
      })
        .select("title body tags")
        .lean<{
          title: string;
          body: string;
          tags: string[];
        }>(),
    ]);

    if (!question || !questionVersion) {
      await resetQuestionEligibilityProcessing(questionId, version);
      return;
    }

    const eligibilityResult = await evaluateQuestionEligibility({
      title: String(questionVersion.title ?? ""),
      body: String(questionVersion.body ?? ""),
      tags: Array.isArray(questionVersion.tags) ? questionVersion.tags : [],
    });
    const nextEligibilityStatus =
      questionEligibilityStatusByDecision[eligibilityResult.decision];
    const nextSecurityVerifierStatus = shouldRunSecurityVerifier(
      eligibilityResult,
    )
      ? "PENDING"
      : "NOT_REQUIRED";
    const auditDecisionId = makeJobId(
      "questionEligibilityGateDecision",
      questionId,
      version,
    );
    const updatedAt = new Date();
    const updateResult = await updateQuestionProcessingState({
      questionId,
      questionVersion: version,
      match: {
        questionEligibilityStatus: "PROCESSING",
      },
      set: {
        questionEligibilityStatus: nextEligibilityStatus,
        questionEligibilityUpdatedAt: updatedAt,
        questionEligibilitySourceVersion: version,
        securityVerifierStatus:
          eligibilityResult.decision === "ALLOW"
            ? nextSecurityVerifierStatus
            : "NOT_REQUIRED",
        securityVerifierUpdatedAt: null,
        securityVerifierSourceVersion: version,
      },
    });

    if (updateResult.modifiedCount === 0) return;
    statusUpdated = true;

    await queueQuestionGatewayAudit({
      decisionId: auditDecisionId,
      questionId,
      version,
      userId: String(question.userId),
      stage: "QUESTION_ELIGIBILITY_GATE",
      decision:
        questionGatewayAuditDecisionByGateDecision[eligibilityResult.decision],
      questionEligibilityStatus: nextEligibilityStatus,
      securityVerifierStatus:
        eligibilityResult.decision === "ALLOW"
          ? nextSecurityVerifierStatus
          : "NOT_REQUIRED",
      eligibleForDownstreamProcessing:
        eligibilityResult.eligibleForDownstreamProcessing,
      userFacingReason: eligibilityResult.userFacingReason,
      internalReason: eligibilityResult.internalReason,
      metadata: buildQuestionEligibilityMetadata(eligibilityResult),
    });
    auditQueued = true;

    await queueQuestionEligibilitySideEffects({
      questionId,
      version,
      userId: String(question.userId),
      questionEligibilityStatus: nextEligibilityStatus,
      securityVerifierStatus:
        eligibilityResult.decision === "ALLOW"
          ? nextSecurityVerifierStatus
          : "NOT_REQUIRED",
    });
  } catch (error) {
    if (!statusUpdated || !auditQueued) {
      await resetQuestionEligibilityProcessing(questionId, version);
    }

    throw error;
  }
};

export default processQuestionEligibilityGateJob;
