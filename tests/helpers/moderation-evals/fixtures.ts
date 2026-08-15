import type { AiModerationResult } from "../../../src/services/moderation/ai/aiModeration.service.js";

import type { ModerationEvalCase } from "../../../evals/moderation/schema.js";

const createModerationEvalCase = (
  overrides: Partial<ModerationEvalCase> = {},
): ModerationEvalCase => ({
  id: "eval-case-1",
  description: "A deterministic moderation eval case",
  input: {
    contentType: "REPLY",
    body: "A test moderation message",
  },
  expected: {
    flagged: true,
    acceptableCategories: ["harassment"],
    acceptableActions: ["WARN"],
  },
  tags: ["fixture"],
  ...overrides,
});

const createModerationResult = (
  overrides: Partial<Extract<AiModerationResult, { ok: true }>> = {},
): Extract<AiModerationResult, { ok: true }> => ({
  ok: true,
  flagged: true,
  confidence: 0.8,
  severity: 80,
  reasons: ["Fixture moderation reason"],
  categoryScores: { harassment: 0.8 },
  primaryCategory: "harassment",
  recommendedAction: "WARN",
  ...overrides,
});

const createModerationFailure = (
  error = "Fixture moderation failure",
): Extract<AiModerationResult, { ok: false }> => ({
  ok: false,
  error,
});

export { createModerationEvalCase, createModerationResult, createModerationFailure };
