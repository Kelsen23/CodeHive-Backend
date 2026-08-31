import {
  queueContentModerationRoute,
  queueQuestionPipelineStep,
} from "./pipelineRouting.service.js";
import { invalidateSimilarQuestions } from "../similarQuestions/similarQuestionsState.service.js";

import Question from "../../../models/question.model.js";
import QuestionVersion from "../../../models/questionVersion.model.js";

type QuestionPipelineRouteDecision =
  | { type: "NOOP" }
  | { type: "MODERATE" }
  | { type: "ELIGIBILITY_GATE" }
  | { type: "QUESTION_SECURITY_VERIFIER" }
  | { type: "EMBED" }
  | { type: "SIMILAR" };

type QuestionPipelineRouteState = {
  moderationStatus: "PENDING" | "APPROVED" | "FLAGGED" | "REJECTED";
  questionEligibilityStatus?:
    | "PENDING"
    | "PROCESSING"
    | "ALLOWED"
    | "CLARIFY"
    | "REJECTED";
  securityVerifierStatus?:
    | "NOT_REQUIRED"
    | "PENDING"
    | "PROCESSING"
    | "ALLOWED"
    | "ALLOWED_WITH_CONSTRAINTS"
    | "REJECTED";
  embeddingStatus?: "NONE" | "PENDING" | "PROCESSING" | "READY";
  similarQuestionsStatus?: "NONE" | "PENDING" | "PROCESSING" | "READY";
  isActive: boolean;
  isDeleted: boolean;
  isCurrentVersion: boolean;
};

const completedSecurityVerifierStatuses = new Set<
  NonNullable<QuestionPipelineRouteState["securityVerifierStatus"]>
>(["NOT_REQUIRED", "ALLOWED", "ALLOWED_WITH_CONSTRAINTS"]);

const loadQuestionPipelineRouteState = async (
  questionId: string,
  version: number,
): Promise<QuestionPipelineRouteState | null> => {
  const questionVersion = await QuestionVersion.findOne({ questionId, version })
    .select("moderationStatus")
    .lean<{
      moderationStatus: QuestionPipelineRouteState["moderationStatus"];
    }>();

  if (!questionVersion) return null;

  const question = await Question.findOne({
    _id: questionId,
    currentVersion: version,
  })
    .select(
      "questionEligibilityStatus securityVerifierStatus embeddingStatus similarQuestionsStatus isActive isDeleted",
    )
    .lean<{
      questionEligibilityStatus: QuestionPipelineRouteState["questionEligibilityStatus"];
      securityVerifierStatus: QuestionPipelineRouteState["securityVerifierStatus"];
      embeddingStatus: QuestionPipelineRouteState["embeddingStatus"];
      similarQuestionsStatus: QuestionPipelineRouteState["similarQuestionsStatus"];
      isActive: boolean;
      isDeleted: boolean;
    }>();

  if (!question) {
    return {
      moderationStatus: questionVersion.moderationStatus,
      isActive: false,
      isDeleted: true,
      isCurrentVersion: false,
    };
  }

  return {
    moderationStatus: questionVersion.moderationStatus,
    questionEligibilityStatus: question.questionEligibilityStatus,
    securityVerifierStatus: question.securityVerifierStatus,
    embeddingStatus: question.embeddingStatus,
    similarQuestionsStatus: question.similarQuestionsStatus,
    isActive: question.isActive,
    isDeleted: question.isDeleted,
    isCurrentVersion: true,
  };
};

const resolveQuestionPipelineRouteDecision = (
  state: QuestionPipelineRouteState | null,
): QuestionPipelineRouteDecision => {
  if (!state) return { type: "NOOP" };

  if (state.moderationStatus === "PENDING") return { type: "MODERATE" };
  if (state.moderationStatus === "REJECTED") return { type: "NOOP" };

  if (!state.isCurrentVersion) return { type: "NOOP" };

  if (state.questionEligibilityStatus === "PENDING") {
    return { type: "ELIGIBILITY_GATE" };
  }

  if (state.questionEligibilityStatus !== "ALLOWED") return { type: "NOOP" };

  if (state.securityVerifierStatus === "PENDING") {
    return { type: "QUESTION_SECURITY_VERIFIER" };
  }

  if (
    !state.securityVerifierStatus ||
    !completedSecurityVerifierStatuses.has(state.securityVerifierStatus)
  ) {
    return { type: "NOOP" };
  }

  if (state.embeddingStatus === "NONE") {
    return { type: "EMBED" };
  }

  if (
    state.embeddingStatus === "READY" &&
    (state.similarQuestionsStatus === "NONE" ||
      state.similarQuestionsStatus === "PENDING")
  ) {
    return { type: "SIMILAR" };
  }

  return { type: "NOOP" };
};

const questionRouter = async (questionId: string, version: number) => {
  const routeState = await loadQuestionPipelineRouteState(questionId, version);

  if (
    routeState?.isCurrentVersion &&
    (routeState.moderationStatus === "PENDING" ||
      routeState.moderationStatus === "REJECTED" ||
      !routeState.isActive ||
      routeState.isDeleted ||
      routeState.questionEligibilityStatus !== "ALLOWED" ||
      !completedSecurityVerifierStatuses.has(
        routeState.securityVerifierStatus as NonNullable<
          QuestionPipelineRouteState["securityVerifierStatus"]
        >,
      ) ||
      routeState.embeddingStatus !== "READY")
  ) {
    await invalidateSimilarQuestions(questionId, version);
  }

  const routeDecision = resolveQuestionPipelineRouteDecision(routeState);

  if (routeDecision.type === "MODERATE") {
    return queueContentModerationRoute({
      contentType: "QUESTION",
      contentId: questionId,
      version,
    });
  }

  if (routeDecision.type === "ELIGIBILITY_GATE") {
    return queueQuestionPipelineStep({
      questionId,
      version,
      step: "ELIGIBILITY_GATE",
    });
  }

  if (routeDecision.type === "QUESTION_SECURITY_VERIFIER") {
    return queueQuestionPipelineStep({
      questionId,
      version,
      step: "QUESTION_SECURITY_VERIFIER",
    });
  }

  if (routeDecision.type === "EMBED") {
    return queueQuestionPipelineStep({
      questionId,
      version,
      step: "EMBED",
    });
  }

  if (routeDecision.type === "SIMILAR") {
    return queueQuestionPipelineStep({
      questionId,
      version,
      step: "SIMILAR",
    });
  }
};

export default questionRouter;
