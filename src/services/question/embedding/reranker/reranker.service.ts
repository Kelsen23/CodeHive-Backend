import normalizeText from "../../../../utils/question/normalizeText.util.js";

import { scoreRerankerPairs } from "./rerankerWorker.service.js";

const rerankerRepresentationVersion = "dense-reranker-text-v1";

const truncateText = (text: string, maxCharacters: number) =>
  text.length > maxCharacters ? text.slice(0, maxCharacters) : text;

const buildRerankerText = (
  {
    title,
    body,
    tags,
  }: {
    title: string;
    body: string;
    tags: string[];
  },
  { maxCharacters = Number.MAX_SAFE_INTEGER }: { maxCharacters?: number } = {},
) =>
  truncateText(
    `Title: ${normalizeText(title)}\nTags: ${tags.map(normalizeText).join(", ")}\nBody: ${body.trim().replace(/\r\n/g, "\n")}`,
    maxCharacters ?? Number.MAX_SAFE_INTEGER,
  );

const scoreRerankerTextPairs = (pairs: Array<[string, string]>) =>
  scoreRerankerPairs(pairs);

export {
  buildRerankerText,
  rerankerRepresentationVersion,
  scoreRerankerTextPairs,
};
