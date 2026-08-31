import type {
  RerankerCorpusSource,
  RetrievalCandidate,
  RetrievalInput,
} from "../retrieval.types.js";

import {
  buildRerankerText,
  rerankerRepresentationVersion,
  scoreRerankerTextPairs,
} from "../../../embedding/reranker/reranker.service.js";
import {
  denseCandidateLimit,
  similarQuestionResultLimit,
} from "../../similarQuestions.shared.js";
import findDenseQuestionCandidates from "../../similarQuestionsSearch.service.js";
import {
  filterEligibleCandidates,
  makeEligibleQuestionVersionSet,
} from "../dense/denseValidation.service.js";

import rerankerConfig from "../../../../../config/reranker.config.js";

type DenseRerankerRequest = RetrievalInput & {
  queryVector?: number[];
  denseModel?: string;
  resultLimit?: number;
  corpus: RerankerCorpusSource;
};

const findDenseRerankerQuestionCandidates = async ({
  sourceQuestionId,
  sourceVersion,
  title,
  body,
  tags,
  limit = denseCandidateLimit,
  resultLimit = similarQuestionResultLimit,
  queryVector,
  denseModel,
  corpus,
}: DenseRerankerRequest): Promise<RetrievalCandidate[]> => {
  const denseCandidates = await findDenseQuestionCandidates({
    sourceQuestionId,
    sourceVersion,
    title,
    body,
    tags,
    limit,
    resultLimit: limit,
    queryVector,
    model: denseModel,
    corpus,
  });

  const documents = await corpus.loadQuestionDocumentsById(
    denseCandidates.map(({ questionId, version }) => ({ questionId, version })),
  );

  const documentsByIdentity = new Map(
    documents.map((document) => [
      JSON.stringify([document.questionId, document.version]),
      document,
    ]),
  );

  const pairs: Array<[string, string]> = [];

  const candidates = denseCandidates.map((candidate, index) => {
    const document = documentsByIdentity.get(
      JSON.stringify([candidate.questionId, candidate.version]),
    );
    if (!document)
      throw new Error(
        `Missing reranker document for ${candidate.questionId}:${candidate.version}`,
      );
    pairs.push([
      buildRerankerText(
        { title, body, tags },
        { maxCharacters: rerankerConfig.queryMaxCharacters },
      ),
      buildRerankerText(document, {
        maxCharacters: rerankerConfig.candidateMaxCharacters,
      }),
    ]);
    return {
      candidate: {
        ...candidate,
        diagnostics: {
          ...candidate.diagnostics,
          dense: { rank: index + 1, score: candidate.score },
        },
      },
      document,
    };
  });

  if (pairs.length === 0) return [];

  const { scores, model } = await scoreRerankerTextPairs(pairs);

  const reranked = candidates
    .map(({ candidate }, index) => ({
      ...candidate,
      score: scores[index]!,
      retrievalVersion: "dense-reranker-v1",
      model,
      representationVersion: rerankerRepresentationVersion,
      diagnostics: {
        ...candidate.diagnostics,
        reranker: { rank: 0, score: scores[index]! },
      },
    }))
    .sort(
      (left, right) =>
        right.score - left.score ||
        (right.diagnostics?.dense?.score ?? 0) -
          (left.diagnostics?.dense?.score ?? 0) ||
        left.questionId.localeCompare(right.questionId) ||
        left.version - right.version,
    )
    .map((candidate, index) => ({
      ...candidate,
      diagnostics: {
        ...candidate.diagnostics,
        reranker: { rank: index + 1, score: candidate.score },
      },
    }));

  const postvalidatedVersions = makeEligibleQuestionVersionSet(
    await corpus.loadCurrentEligibleQuestionVersionsById(
      reranked.map(({ questionId }) => questionId),
    ),
  );

  return filterEligibleCandidates(
    reranked,
    postvalidatedVersions,
    sourceQuestionId,
  ).slice(0, resultLimit);
};

export { findDenseRerankerQuestionCandidates };
export default findDenseRerankerQuestionCandidates;
