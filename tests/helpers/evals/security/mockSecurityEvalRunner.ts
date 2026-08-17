import { vi } from "vitest";

import type {
  DatasetConfig,
  SecurityEvalRunnerDependencies,
} from "../../../../evals/security/runner.js";
import type { SecurityEvalCase } from "../../../../evals/security/schema.js";
import { createSecurityExecution } from "./fixtures.js";

const createSecurityEvalRunnerMocks = (cases: SecurityEvalCase[] = []) => {
  const loadCases = vi.fn(async (_filename: string) => cases);
  const verifySecurity = vi.fn(async () => createSecurityExecution());
  const now = vi
    .fn<() => number>()
    .mockReturnValueOnce(100)
    .mockReturnValue(125);
  const getTimestamp = vi.fn(() => "2026-01-01T00:00:00.000Z");
  const getGitCommit = vi.fn(() => "fixture-commit");
  const writeReport = vi.fn(async (_filename: string, _report: unknown) => {});
  const createReportDirectory = vi.fn(async (_directory: string) => {});
  const log = vi.fn();

  const dependencies: SecurityEvalRunnerDependencies = {
    loadCases,
    verifySecurity,
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
    verifySecurity,
    now,
    getTimestamp,
    getGitCommit,
    writeReport,
    createReportDirectory,
    log,
  };
};

export { createSecurityEvalRunnerMocks };
