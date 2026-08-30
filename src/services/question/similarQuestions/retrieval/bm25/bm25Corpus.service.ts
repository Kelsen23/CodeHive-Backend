import type {
  Bm25QuestionDocument,
  EligibleQuestionVersion,
} from "../retrieval.types.js";

import {
  currentLiveEligibleQuestionMatch,
  loadCurrentLiveEligibleQuestionVersionsById,
} from "../dense/denseCorpus.service.js";

import Question from "../../../../../models/question.model.js";
import QuestionVersion from "../../../../../models/questionVersion.model.js";

const loadCurrentEligibleQuestionDocuments = async () => {
  const questions = await Question.find(currentLiveEligibleQuestionMatch)
    .select("_id currentVersion")
    .lean<{ _id: unknown; currentVersion: number }[]>();

  if (questions.length === 0) return [];

  const currentVersions = new Map(
    questions.map((question) => [
      String(question._id),
      question.currentVersion,
    ]),
  );
  const versions = await QuestionVersion.find({
    questionId: { $in: questions.map(({ _id }) => _id) },
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
