import {
  downstreamAllowedSecurityVerifierStatuses,
  eligibleQuestionProcessingStateMatch,
  publicQuestionProcessingStateMatch,
} from "../processingState/questionProcessingState.query.js";

// Initial Dense v1 beta floor; cosine thresholds are model-specific and
// should be recalibrated as production relevance labels accumulate.
const similarQuestionScoreThreshold = 0.72;
const similarQuestionResultLimit = 15;
const denseCandidateLimit = 50;
const aiAnswerSimilarQuestionScoreThreshold = 0.7;
const aiAnswerSimilarQuestionResultLimit = 8;

const currentLiveQuestionMatch = {
  isActive: true,
  isDeleted: false,
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
  eligibleQuestionProcessingStateMatch,
  publicQuestionProcessingStateMatch,
  currentLiveQuestionMatch,
  denseCandidateLimit,
  similarQuestionResultLimit,
  similarQuestionScoreThreshold,
  type SimilarQuestionsJobData,
};
