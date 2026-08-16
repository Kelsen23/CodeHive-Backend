import { vi } from "vitest";

import type {
  DatasetConfig,
  ModerationEvalRunnerDependencies,
} from "../../../../evals/moderation/runner.js";
import type { ModerationEvalCase } from "../../../../evals/moderation/schema.js";
import { createModerationExecution } from "./fixtures.js";

const createModerationEvalRunnerMocks = (
  cases: ModerationEvalCase[] = [],
) => {
  const loadCases = vi.fn(async (_filename: string) => cases);
  const moderateContent = vi.fn(async (_content: string) =>
    createModerationExecution(),
  );
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
