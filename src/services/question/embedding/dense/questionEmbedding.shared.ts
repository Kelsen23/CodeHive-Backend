const downstreamAllowedSecurityVerifierStatuses = [
  "NOT_REQUIRED",
  "ALLOWED",
  "ALLOWED_WITH_CONSTRAINTS",
] as const;

type DownstreamAllowedSecurityVerifierStatus =
  (typeof downstreamAllowedSecurityVerifierStatuses)[number];

type QuestionEmbeddingJobData = {
  questionId: string;
  version: number;
};

const denseRepresentationVersion = "dense-v1";

export {
  downstreamAllowedSecurityVerifierStatuses,
  type DownstreamAllowedSecurityVerifierStatus,
  type QuestionEmbeddingJobData,
  denseRepresentationVersion,
};
