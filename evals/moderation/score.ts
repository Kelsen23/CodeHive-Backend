import type { AiModerationResult } from "../../src/services/moderation/ai/aiModeration.service.js";

import type { ModerationEvalExpected } from "./schema.js";

type ModerationEvalCaseStatus =
  | "PASS"
  | "QUALITY_FAILURE"
  | "EXECUTION_FAILURE";

type ModerationAssertionName = "flagged" | "category" | "action";

type ModerationAssertionResult = {
  name: ModerationAssertionName;
  passed: boolean;
  expected: unknown;
  actual: unknown;
};

type ModerationCaseScore = {
  status: ModerationEvalCaseStatus;
  assertions: ModerationAssertionResult[];
};

const scoreModerationCase = (
  expected: ModerationEvalExpected,
  result: AiModerationResult,
): ModerationCaseScore => {
  if (!result.ok) {
    return {
      status: "EXECUTION_FAILURE",
      assertions: [],
    };
  }

  const assertions: ModerationAssertionResult[] = [
    {
      name: "flagged",
      passed: result.flagged === expected.flagged,
      expected: expected.flagged,
      actual: result.flagged,
    },
  ];

  if (expected.acceptableCategories) {
    assertions.push({
      name: "category",
      passed: expected.acceptableCategories.includes(
        result.primaryCategory ?? "",
      ),
      expected: expected.acceptableCategories,
      actual: result.primaryCategory,
    });
  }

  if (expected.acceptableActions) {
    assertions.push({
      name: "action",
      passed: expected.acceptableActions.includes(result.recommendedAction),
      expected: expected.acceptableActions,
      actual: result.recommendedAction,
    });
  }

  return {
    status: assertions.every((assertion) => assertion.passed)
      ? "PASS"
      : "QUALITY_FAILURE",
    assertions,
  };
};

export type {
  ModerationEvalCaseStatus,
  ModerationAssertionName,
  ModerationAssertionResult,
  ModerationCaseScore,
};

export { scoreModerationCase };
