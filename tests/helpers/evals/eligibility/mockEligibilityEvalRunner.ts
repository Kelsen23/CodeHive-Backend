import { vi } from "vitest";

import type {
  DatasetConfig,
  QuestionEligibilityEvalRunnerDependencies,
} from "../../../../evals/eligibility/runner.js";
import type { QuestionEligibilityEvalCase } from "../../../../evals/eligibility/schema.js";
import { createEligibilityResult } from "./fixtures.js";

const createEligibilityEvalRunnerMocks = (
  cases: QuestionEligibilityEvalCase[] = [],
) => {
  const loadCases = vi.fn(async (_filename: string) => cases);
  const evaluateEligibility = vi.fn(async () => createEligibilityResult());
  const now = vi
    .fn<() => number>()
    .mockReturnValueOnce(100)
    .mockReturnValue(125);
  const getTimestamp = vi.fn(() => "2026-01-01T00:00:00.000Z");
  const getGitCommit = vi.fn(() => "fixture-commit");
  const writeReport = vi.fn(async (_filename: string, _report: unknown) => {});
  const createReportDirectory = vi.fn(async (_directory: string) => {});
  const log = vi.fn();

  const dependencies: QuestionEligibilityEvalRunnerDependencies = {
    loadCases,
    evaluateEligibility,
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
    evaluateEligibility,
    now,
    getTimestamp,
    getGitCommit,
    writeReport,
    createReportDirectory,
    log,
  };
};

export { createEligibilityEvalRunnerMocks };
