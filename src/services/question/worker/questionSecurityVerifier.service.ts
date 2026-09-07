import verifyQuestionSecurity from "../ai/securityVerifier.service.js";
import { queueAiSuggestionUnlockedNotification } from "../ai/unlockNotification.service.js";
import { queueContentPipelineRoute } from "../pipelineRouter/pipelineRouting.service.js";
import {
  findOneAndUpdateQuestionProcessingState,
  updateQuestionProcessingState,
} from "../processingState/questionProcessingState.service.js";
import queueQuestionGatewayAudit from "../questionEligibilityGate/queueQuestionGatewayAudit.service.js";
import {
  buildFailClosedSecurityVerifierResult,
  buildSecurityVerifierMetadata,
  questionGatewayAuditDecisionBySecurityDecision,
  securityVerifierStatusByDecision,
  type ProcessSecurityVerifierJobData,
} from "../securityVerifier/securityVerifier.shared.js";
import routeNotification from "../../notification/routeNotification.service.js";

import { getRedisCacheClient } from "../../../config/redis.config.js";

import { makeJobId } from "../../../utils/job/makeJobId.util.js";
import { clearQuestionDiscoveryCache } from "../../../utils/cache/clearCache.util.js";

import QuestionVersion from "../../../models/questionVersion.model.js";
import Question from "../../../models/question.model.js";
import QuestionProcessingState from "../../../models/questionProcessingState.model.js";

const resetSecurityVerifierProcessing = async (
  questionId: string,
  version: number,
) => {
  await updateQuestionProcessingState({
    questionId,
    questionVersion: version,
    match: {
      securityVerifierStatus: "PROCESSING",
    },
    set: {
      securityVerifierStatus: "PENDING",
      securityVerifierUpdatedAt: null,
      securityVerifierSourceVersion: version,
    },
  });
};

const queueSecurityVerifierSideEffects = async ({
  questionId,
  version,
  userId,
  securityVerifierStatus,
}: {
  questionId: string;
  version: number;
  userId: string;
  securityVerifierStatus: "ALLOWED" | "ALLOWED_WITH_CONSTRAINTS" | "REJECTED";
}) => {
  await getRedisCacheClient().del(`question:${questionId}`);
  await clearQuestionDiscoveryCache();

  await queueContentPipelineRoute({
    contentType: "QUESTION",
    contentId: questionId,
    version,
  });

  if (securityVerifierStatus === "REJECTED") {
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
        securityVerifierStatus,
      },
    });

    return;
  }

  await queueAiSuggestionUnlockedNotification({
    questionId,
    version,
    userId,
  });
};

const resumeSecurityVerifierSideEffects = async ({
  questionId,
  version,
}: ProcessSecurityVerifierJobData) => {
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
        "questionEligibilityStatus securityVerifierSourceVersion securityVerifierStatus",
      )
      .lean<{
        questionEligibilityStatus: string;
        securityVerifierSourceVersion: number;
        securityVerifierStatus:
          | "ALLOWED"
          | "ALLOWED_WITH_CONSTRAINTS"
          | "REJECTED";
      }>(),
  ]);

  if (!question) return;
  if (!processingState) throw new Error("Question processing state missing");
  if (
    processingState.questionEligibilityStatus !== "ALLOWED" ||
    processingState.securityVerifierSourceVersion !== version ||
    !["ALLOWED", "ALLOWED_WITH_CONSTRAINTS", "REJECTED"].includes(
      processingState.securityVerifierStatus,
    )
  ) {
    return;
  }

  await queueSecurityVerifierSideEffects({
    questionId,
    version,
    userId: String(question.userId),
    securityVerifierStatus: processingState.securityVerifierStatus,
  });
};

const processQuestionSecurityVerifierJob = async ({
  questionId,
  version,
}: ProcessSecurityVerifierJobData) => {
  const lockedState = await findOneAndUpdateQuestionProcessingState({
    questionId,
    questionVersion: version,
    match: {
      questionEligibilityStatus: "ALLOWED",
      securityVerifierStatus: "PENDING",
    },
    set: { securityVerifierStatus: "PROCESSING" },
  });

  if (!lockedState) {
    await resumeSecurityVerifierSideEffects({ questionId, version });
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
      await resetSecurityVerifierProcessing(questionId, version);
      return;
    }

    let syntheticFailClosed = false;
    const securityResult = await verifyQuestionSecurity({
      title: String(questionVersion.title ?? ""),
      body: String(questionVersion.body ?? ""),
      tags: Array.isArray(questionVersion.tags) ? questionVersion.tags : [],
    }).catch((error) => {
      syntheticFailClosed = true;
      return buildFailClosedSecurityVerifierResult(error);
    });

    const nextSecurityVerifierStatus =
      securityVerifierStatusByDecision[securityResult.finalSecurityDecision];
    const auditDecisionId = makeJobId(
      "securityVerifierDecision",
      questionId,
      version,
    );
    const updatedAt = new Date();
    const updateResult = await updateQuestionProcessingState({
      questionId,
      questionVersion: version,
      match: {
        questionEligibilityStatus: "ALLOWED",
        securityVerifierStatus: "PROCESSING",
      },
      set: {
        securityVerifierStatus: nextSecurityVerifierStatus,
        securityVerifierUpdatedAt: updatedAt,
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
      stage: "QUESTION_SECURITY_VERIFIER",
      decision:
        questionGatewayAuditDecisionBySecurityDecision[
          securityResult.finalSecurityDecision
        ],
      questionEligibilityStatus: "ALLOWED",
      securityVerifierStatus: nextSecurityVerifierStatus,
      eligibleForDownstreamProcessing:
        securityResult.downstreamPolicy.eligibleForDownstreamProcessing,
      userFacingReason: securityResult.userFacingReason,
      internalReason: securityResult.internalReason,
      metadata: buildSecurityVerifierMetadata(
        securityResult,
        syntheticFailClosed,
      ),
    });
    auditQueued = true;

    await queueSecurityVerifierSideEffects({
      questionId,
      version,
      userId: String(question.userId),
      securityVerifierStatus: nextSecurityVerifierStatus,
    });
  } catch (error) {
    if (!statusUpdated || !auditQueued) {
      await resetSecurityVerifierProcessing(questionId, version);
    }

    throw error;
  }
};

export default processQuestionSecurityVerifierJob;
