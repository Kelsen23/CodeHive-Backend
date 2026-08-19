const similarQuestionScoreThreshold = 0;
const similarQuestionResultLimit = 15;
const denseCandidateLimit = 50;
const aiAnswerSimilarQuestionScoreThreshold = 0.7;
const aiAnswerSimilarQuestionResultLimit = 8;

const downstreamAllowedSecurityVerifierStatuses = [
  "NOT_REQUIRED",
  "ALLOWED",
  "ALLOWED_WITH_CONSTRAINTS",
] as const;

type SimilarQuestionsJobData = {
  questionId: string;
  version: number;
};

export {
  aiAnswerSimilarQuestionResultLimit,
  aiAnswerSimilarQuestionScoreThreshold,
  downstreamAllowedSecurityVerifierStatuses,
  denseCandidateLimit,
  similarQuestionResultLimit,
  similarQuestionScoreThreshold,
  type SimilarQuestionsJobData,
};
