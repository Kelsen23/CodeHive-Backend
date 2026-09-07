import type {
  Bm25QuestionDocument,
  EligibleQuestionVersion,
} from "../retrieval.types.js";

import {
  loadCurrentLiveEligibleQuestionVersions,
  loadCurrentLiveEligibleQuestionVersionsById,
} from "../dense/denseCorpus.service.js";

import QuestionVersion from "../../../../../models/questionVersion.model.js";

const loadCurrentEligibleQuestionDocuments = async () => {
  const questions = await loadCurrentLiveEligibleQuestionVersions();

  if (questions.length === 0) return [];

  const currentVersions = new Map(
    questions.map((question) => [question.questionId, question.version]),
  );
  const versions = await QuestionVersion.find({
    questionId: { $in: questions.map(({ questionId }) => questionId) },
    isActive: true,
  })
    .select("questionId version title body tags")
    .lean<
      {
        questionId: unknown;
        version: number;
        title: string;
        body: string;
        tags?: string[];
      }[]
    >();

  return versions.reduce<Bm25QuestionDocument[]>((documents, version) => {
    const questionId = String(version.questionId);

    if (currentVersions.get(questionId) !== version.version) return documents;

    documents.push({
      questionId,
      version: version.version,
      title: version.title,
      body: version.body,
      tags: Array.isArray(version.tags) ? version.tags : [],
    });
    return documents;
  }, []);
};

const loadCurrentEligibleQuestionDocumentsById = async (
  questionIds: string[],
): Promise<EligibleQuestionVersion[]> =>
  loadCurrentLiveEligibleQuestionVersionsById(questionIds);

export {
  loadCurrentEligibleQuestionDocuments,
  loadCurrentEligibleQuestionDocumentsById,
};
