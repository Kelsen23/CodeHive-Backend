import type { RetrievalCandidate } from "../retrieval.types.js";

const rrfK = 60;

type RrfWeights = {
  dense: number;
  sparse?: number;
  bm25?: number;
};

const makeCandidateKey = (candidate: RetrievalCandidate) =>
  `${candidate.questionId}:${candidate.version}`;

const fuseByReciprocalRank = ({
  denseCandidates,
  bm25Candidates,
  limit,
  k = rrfK,
  weights = { dense: 1, bm25: 1 },
}: {
  denseCandidates: RetrievalCandidate[];
  bm25Candidates: RetrievalCandidate[];
  limit: number;
  k?: number;
  weights?: RrfWeights;
}) => {
  const fused = new Map<
    string,
    RetrievalCandidate & { denseRank?: number; bm25Rank?: number }
  >();

  const addBranch = (
    candidates: RetrievalCandidate[],
    branch: "dense" | "bm25",
  ) => {
    candidates.forEach((candidate, index) => {
      const key = makeCandidateKey(candidate);
      const rank = index + 1;
      const existing = fused.get(key);
      const contribution =
        (branch === "dense" ? weights.dense : (weights.bm25 ?? 1)) / (k + rank);
      const next = existing ?? {
        ...candidate,
        score: 0,
        model: candidate.model,
        representationVersion: candidate.representationVersion,
      };

      next.score += contribution;
      if (branch === "dense") next.denseRank = rank;
      else next.bm25Rank = rank;
      fused.set(key, next);
    });
  };

  addBranch(denseCandidates, "dense");
  addBranch(bm25Candidates, "bm25");

  return [...fused.values()]
    .map(({ denseRank, bm25Rank, ...candidate }) => {
      const denseCandidate = denseCandidates[denseRank ? denseRank - 1 : -1];
      const bm25Candidate = bm25Candidates[bm25Rank ? bm25Rank - 1 : -1];

      return {
        ...candidate,
        retrievalVersion: "hybrid-v1",
        model: denseCandidate?.model ?? "hybrid",
        representationVersion: "hybrid-v1",
        diagnostics: {
          dense: denseCandidate
            ? { rank: denseRank!, score: denseCandidate.score }
            : undefined,
          bm25: bm25Candidate
            ? { rank: bm25Rank!, score: bm25Candidate.score }
            : undefined,
          rrf: { k, weights },
        },
      };
    })
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.questionId.localeCompare(right.questionId) ||
        left.version - right.version,
    )
    .slice(0, limit);
};

export { fuseByReciprocalRank, makeCandidateKey, rrfK };
export type { RrfWeights };
