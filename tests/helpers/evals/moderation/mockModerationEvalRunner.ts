import { vi } from "vitest";

import type { AiModerationResult } from "../../../../src/services/moderation/ai/aiModeration.service.js";

import type {
  DatasetConfig,
  ModerationEvalRunnerDependencies,
} from "../../../../evals/moderation/runner.js";
import type { ModerationEvalCase } from "../../../../evals/moderation/schema.js";

const createModerationEvalRunnerMocks = (
  cases: ModerationEvalCase[] = [],
  result: AiModerationResult = {
    ok: true,
    flagged: true,
    confidence: 0.8,
    severity: 80,
    reasons: ["Fixture moderation reason"],
    categoryScores: { harassment: 0.8 },
    primaryCategory: "harassment",
    recommendedAction: "WARN",
  },
) => {
  const loadCases = vi.fn(async (_filename: string) => cases);
  const moderateContent = vi.fn(async (_content: string) => result);
  const now = vi
    .fn<() => number>()
    .mockReturnValueOnce(100)
    .mockReturnValue(125);
  const getTimestamp = vi.fn(() => "2026-01-01T00:00:00.000Z");
  const getGitCommit = vi.fn(() => "fixture-commit");
  const writeReport = vi.fn(async (_filename: string, _report: unknown) => {});
  const createReportDirectory = vi.fn(async (_directory: string) => {});
  const log = vi.fn();

  const dependencies: ModerationEvalRunnerDependencies = {
    loadCases,
    moderateContent,
    now,
    getTimestamp,
    getGitCommit,
    writeReport,
    createReportDirectory,
    log,
  };

  const datasetConfig: DatasetConfig = {
    path: "/fixtures/cases.jsonl",
    reportDirectory: "/fixtures/reports",
  };

  return {
    dependencies,
    datasetConfig,
    loadCases,
    moderateContent,
    now,
    getTimestamp,
    getGitCommit,
    writeReport,
    createReportDirectory,
    log,
  };
};

export { createModerationEvalRunnerMocks };
