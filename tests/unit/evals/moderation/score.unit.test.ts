import { describe, expect, it } from "vitest";

import {
  createModerationEvalCase,
  createModerationFailure,
  createModerationResult,
} from "../../../helpers/moderation-evals/fixtures.js";
import { scoreModerationCase } from "../../../../evals/moderation/score.js";

describe("scoreModerationCase", () => {
  it("passes a matching flagged result", () => {
    const score = scoreModerationCase(
      { flagged: true },
      createModerationResult(),
    );

    expect(score.status).toBe("PASS");
    expect(score.assertions).toEqual([
      { name: "flagged", passed: true, expected: true, actual: true },
    ]);
  });

  it("reports a flagged mismatch", () => {
    const score = scoreModerationCase(
      { flagged: false },
      createModerationResult(),
    );

    expect(score.status).toBe("QUALITY_FAILURE");
    expect(score.assertions[0]).toMatchObject({
      name: "flagged",
      passed: false,
      expected: false,
      actual: true,
    });
  });

  it("checks acceptable categories and actions", () => {
    const expected = createModerationEvalCase().expected;
    const score = scoreModerationCase(expected, createModerationResult());

    expect(score.status).toBe("PASS");
    expect(score.assertions).toHaveLength(3);

    const mismatch = scoreModerationCase(
      {
        flagged: true,
        acceptableCategories: ["violence"],
        acceptableActions: ["BAN_TEMP"],
      },
      createModerationResult(),
    );

    expect(mismatch.status).toBe("QUALITY_FAILURE");
    expect(mismatch.assertions.filter(({ passed }) => !passed)).toHaveLength(2);
  });

  it("returns execution failure without quality assertions", () => {
    const score = scoreModerationCase(
      { flagged: true },
      createModerationFailure(),
    );

    expect(score).toEqual({ status: "EXECUTION_FAILURE", assertions: [] });
  });
});
