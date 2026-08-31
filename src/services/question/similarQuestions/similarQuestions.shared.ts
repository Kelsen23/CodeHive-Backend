// Initial Dense v1 beta floor; cosine thresholds are model-specific and
// should be recalibrated as production relevance labels accumulate.
const similarQuestionScoreThreshold = 0.72;
const similarQuestionResultLimit = 15;
const denseCandidateLimit = 50;
const aiAnswerSimilarQuestionScoreThreshold = 0.7;
const aiAnswerSimilarQuestionResultLimit = 8;

const downstreamAllowedSecurityVerifierStatuses = [
  "NOT_REQUIRED",
  "ALLOWED",
  "ALLOWED_WITH_CONSTRAINTS",
] as const;

const currentLiveEligibleQuestionMatch = {
  isActive: true,
  isDeleted: false,
  moderationStatus: { $in: ["APPROVED", "FLAGGED"] },
  questionEligibilityStatus: "ALLOWED",
  securityVerifierStatus: {
    $in: downstreamAllowedSecurityVerifierStatuses,
  },
};

const currentEligibleQuestionMatch = {
  ...currentLiveEligibleQuestionMatch,
  embeddingStatus: "READY",
};

type SimilarQuestionsJobData = {
  questionId: string;
  version: number;
  refresh?: boolean;
};

export {
  aiAnswerSimilarQuestionResultLimit,
  aiAnswerSimilarQuestionScoreThreshold,
  downstreamAllowedSecurityVerifierStatuses,
  currentEligibleQuestionMatch,
  currentLiveEligibleQuestionMatch,
  denseCandidateLimit,
  similarQuestionResultLimit,
  similarQuestionScoreThreshold,
  type SimilarQuestionsJobData,
};
