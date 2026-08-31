import type {
  EligibleQuestionVersion,
  RetrievalCandidate,
} from "../retrieval.types.js";

const makeQuestionVersionKey = (questionId: string, version: number) =>
  `${questionId}:${version}`;

const makeEligibleQuestionVersionSet = (versions: EligibleQuestionVersion[]) =>
  new Set(
    versions.map(({ questionId, version }) =>
      makeQuestionVersionKey(questionId, version),
    ),
  );

const filterEligibleCandidates = (
  candidates: RetrievalCandidate[],
  eligibleVersions: Set<string>,
  sourceQuestionId: string,
) =>
  candidates.filter(
    (candidate) =>
      candidate.questionId !== sourceQuestionId &&
      eligibleVersions.has(
        makeQuestionVersionKey(candidate.questionId, candidate.version),
      ),
  );

export {
  filterEligibleCandidates,
  makeEligibleQuestionVersionSet,
  makeQuestionVersionKey,
};
