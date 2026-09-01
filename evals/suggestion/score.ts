import {
  questionSuggestionSchema,
  type QuestionSuggestionResult,
} from "../../src/validations/question/suggestion.schema.js";

import type {
  SuggestionEvalAssertions,
  SuggestionEvalCase,
  SuggestionEvalInput,
  SemanticJudgeCriterion,
} from "./schema.js";
import {
  judgeSuggestionBatch,
  requestedCriteriaFromAssertions,
} from "./judge.js";

type SuggestionAssertionSeverity = "CRITICAL" | "MAJOR" | "MINOR";

type SuggestionAssertion = {
  name: string;
  passed: boolean;
  severity: SuggestionAssertionSeverity;
  expected?: unknown;
  actual?: unknown;
  message?: string;
};

type SuggestionScore = {
  status: SuggestionScoreStatus;
  assertions: SuggestionAssertion[];
  actual: unknown;
  evaluatorError?: string;
};

type SuggestionScoreStatus = "PASS" | "QUALITY_FAILURE" | "EVALUATOR_FAILURE";

type SuggestionCaseScore = {
  caseId: string;
  score: SuggestionScore;
};

type SuggestionEvalGeneratedCase = {
  testCase: SuggestionEvalCase;
  suggestion: unknown;
};

type ScoreSuggestionCasesOptions = {
  cases: SuggestionEvalGeneratedCase[];
  batchSize?: number;
  judge?: typeof judgeSuggestionBatch;
};

const DEFAULT_SEMANTIC_JUDGE_BATCH_SIZE = 5;

const assertion = (
  name: string,
  passed: boolean,
  severity: SuggestionAssertionSeverity,
  details: Omit<SuggestionAssertion, "name" | "passed" | "severity"> = {},
): SuggestionAssertion => ({
  name,
  passed,
  severity,
  ...details,
});

const rewriteText = (result: QuestionSuggestionResult) =>
  `${result.suggestedTitle}\n${result.suggestedBody}`;

const suggestionText = (result: QuestionSuggestionResult) =>
  [
    result.suggestedTitle,
    result.suggestedBody,
    ...result.suggestedTags,
    ...result.improvementTips.flatMap(({ category, message }) => [
      category,
      message,
    ]),
  ].join("\n");

const scoreQuestionSuggestionCase = (
  testCase: SuggestionEvalCase,
  actual: unknown,
): SuggestionScore => {
  const parsed = questionSuggestionSchema.safeParse(actual);

  if (!parsed.success) {
    return {
      status: "QUALITY_FAILURE",
      actual,
      assertions: [
        assertion("schema", false, "CRITICAL", {
          message: parsed.error.issues
            .map(({ path, message }) => `${path.join(".")} ${message}`.trim())
            .join("; "),
        }),
      ],
    };
  }

  const result = parsed.data;
  const assertions = scoreDeterministicAssertions(testCase.assertions, result);

  return {
    status: assertions.every(({ passed }) => passed)
      ? "PASS"
      : "QUALITY_FAILURE",
    assertions,
    actual: result,
  };
};

const scoreDeterministicAssertions = (
  expected: SuggestionEvalAssertions,
  actual: QuestionSuggestionResult,
): SuggestionAssertion[] => {
  const output = suggestionText(actual);
  const text = rewriteText(actual);
  const result: SuggestionAssertion[] = [];

  for (const value of expected.mustPreserve ?? []) {
    result.push(
      assertion(`mustPreserve:${value}`, text.includes(value), "MAJOR", {
        expected: value,
        actual: text.includes(value),
      }),
    );
  }

  for (const value of expected.mustPreserveVerbatim ?? []) {
    result.push(
      assertion(
        `mustPreserveVerbatim:${value}`,
        text.includes(value),
        "CRITICAL",
        { expected: value, actual: text.includes(value) },
      ),
    );
  }

  for (const value of expected.mustNotContain ?? []) {
    result.push(
      assertion(
        `mustNotContain:${value}`,
        !output.includes(value),
        "CRITICAL",
        { expected: value, actual: output.includes(value) },
      ),
    );
  }

  for (const value of expected.mustNotPreserve ?? []) {
    result.push(
      assertion(`mustNotPreserve:${value}`, !text.includes(value), "MAJOR", {
        expected: value,
        actual: text.includes(value),
      }),
    );
  }

  const actualTags = new Set(actual.suggestedTags);
  for (const tag of expected.requiredTags ?? []) {
    result.push(
      assertion(`requiredTag:${tag}`, actualTags.has(tag), "MAJOR", {
        expected: true,
        actual: actualTags.has(tag),
      }),
    );
  }

  for (const tag of expected.forbiddenTags ?? []) {
    result.push(
      assertion(`forbiddenTag:${tag}`, !actualTags.has(tag), "MAJOR", {
        expected: false,
        actual: actualTags.has(tag),
      }),
    );
  }

  const actualTipCategories = actual.improvementTips.map(
    ({ category }) => category,
  );
  const actualTipCategorySet = new Set(actualTipCategories);

  for (const category of expected.requiredTipCategories ?? []) {
    result.push(
      assertion(
        `requiredTipCategory:${category}`,
        actualTipCategorySet.has(category),
        "MAJOR",
        { expected: true, actual: actualTipCategorySet.has(category) },
      ),
    );
  }

  if (expected.allowedTipCategories) {
    const allowed = new Set(expected.allowedTipCategories);
    const invalidCategories = actualTipCategories.filter(
      (category) => !allowed.has(category),
    );
    result.push(
      assertion(
        "allowedTipCategories",
        invalidCategories.length === 0,
        "MAJOR",
        {
          expected: expected.allowedTipCategories,
          actual: invalidCategories,
        },
      ),
    );
  }

  if (expected.forbiddenTipCategories) {
    const forbidden = new Set(expected.forbiddenTipCategories);
    const forbiddenCategories = actualTipCategories.filter((category) =>
      forbidden.has(category),
    );
    result.push(
      assertion(
        "forbiddenTipCategories",
        forbiddenCategories.length === 0,
        "MAJOR",
        {
          expected: expected.forbiddenTipCategories,
          actual: forbiddenCategories,
        },
      ),
    );
  }

  if (expected.expectNoTips !== undefined) {
    result.push(
      assertion(
        "expectNoTips",
        expected.expectNoTips === (actual.improvementTips.length === 0),
        "MAJOR",
        {
          expected: expected.expectNoTips,
          actual: actual.improvementTips.length === 0,
        },
      ),
    );
  }

  if (expected.suggestedBodyMaxLength !== undefined) {
    result.push(
      assertion(
        "suggestedBodyMaxLength",
        actual.suggestedBody.length <= expected.suggestedBodyMaxLength,
        "CRITICAL",
        {
          expected: `<= ${expected.suggestedBodyMaxLength}`,
          actual: actual.suggestedBody.length,
        },
      ),
    );
  }

  if (expected.tipCount) {
    const { min, max } = expected.tipCount;
    result.push(
      assertion(
        "tipCount",
        (min === undefined || actual.improvementTips.length >= min) &&
          (max === undefined || actual.improvementTips.length <= max),
        "MAJOR",
        {
          expected: expected.tipCount,
          actual: actual.improvementTips.length,
        },
      ),
    );
  }

  return result;
};

const addSemanticAssertions = (
  score: SuggestionScore,
  criterion: SemanticJudgeCriterion,
  judgment: { passed: boolean; reason: string },
) => {
  score.assertions.push(
    assertion(
      criterion,
      judgment.passed,
      severityForSemanticCriterion(criterion),
      {
        expected: true,
        actual: judgment.passed,
        message: judgment.reason,
      },
    ),
  );

  if (!judgment.passed) {
    score.status = "QUALITY_FAILURE";
  }
};

const severityForSemanticCriterion = (
  criterion: SemanticJudgeCriterion,
): SuggestionAssertionSeverity => {
  switch (criterion) {
    case "noInventedFacts":
    case "noDiagnosisOrSolution":
    case "preserveMeaning":
      return "CRITICAL";
    case "preserveUncertainty":
    case "preserveLanguage":
    case "tipsOnlyForMissingInformation":
      return "MAJOR";
  }
};

const scoreSuggestionCases = async ({
  cases,
  batchSize = DEFAULT_SEMANTIC_JUDGE_BATCH_SIZE,
  judge = judgeSuggestionBatch,
}: ScoreSuggestionCasesOptions): Promise<SuggestionCaseScore[]> => {
  if (!Number.isInteger(batchSize) || batchSize < 1) {
    throw new Error(
      "Suggestion semantic judge batch size must be a positive integer",
    );
  }

  const scores = cases.map(({ testCase, suggestion }) => ({
    caseId: testCase.id,
    score: scoreQuestionSuggestionCase(testCase, suggestion),
  }));
  const generatedCasesById = new Map(
    cases.map(({ testCase, suggestion }) => {
      const parsed = questionSuggestionSchema.safeParse(suggestion);

      return [
        testCase.id,
        parsed.success ? { testCase, suggestion: parsed.data } : undefined,
      ] as const;
    }),
  );
  const scoresById = new Map(
    scores.map((entry) => [entry.caseId, entry.score]),
  );
  const criteria = new Set<SemanticJudgeCriterion>();

  for (const { testCase } of cases) {
    for (const criterion of requestedCriteriaFromAssertions(
      testCase.assertions,
    )) {
      criteria.add(criterion);
    }
  }

  for (const criterion of criteria) {
    const relevantCases = cases.flatMap(({ testCase }) => {
      const generatedCase = generatedCasesById.get(testCase.id);

      if (
        !generatedCase ||
        !requestedCriteriaFromAssertions(testCase.assertions).includes(
          criterion,
        )
      ) {
        return [];
      }

      return [generatedCase];
    });

    for (let offset = 0; offset < relevantCases.length; offset += batchSize) {
      const batch = relevantCases.slice(offset, offset + batchSize);
      let execution: Awaited<ReturnType<typeof judge>>;

      try {
        execution = await judge({
          criterion,
          items: batch.map(({ testCase, suggestion }) => ({
            caseId: testCase.id,
            input: testCase.input as SuggestionEvalInput,
            suggestion,
          })),
        });
      } catch (error) {
        const evaluatorError =
          error instanceof Error ? error.message : String(error);

        for (const { testCase } of batch) {
          const score = scoresById.get(testCase.id);

          if (score) {
            score.evaluatorError = `${criterion}: ${evaluatorError}`;

            if (score.status === "PASS") {
              score.status = "EVALUATOR_FAILURE";
            }
          }
        }

        continue;
      }

      const judgmentsByCaseId = new Map(
        execution.result.judgments.map((judgment) => [
          judgment.caseId,
          judgment,
        ]),
      );

      for (const { testCase } of batch) {
        const judgment = judgmentsByCaseId.get(testCase.id);
        const score = scoresById.get(testCase.id);

        if (!judgment || !score) {
          throw new Error(
            `Suggestion semantic judge result was missing case ${testCase.id}`,
          );
        }

        addSemanticAssertions(score, criterion, judgment);
      }
    }
  }

  return scores;
};

export {
  scoreQuestionSuggestionCase,
  scoreDeterministicAssertions,
  scoreSuggestionCases,
  severityForSemanticCriterion,
};
export type {
  SuggestionAssertion,
  SuggestionAssertionSeverity,
  SuggestionScore,
  SuggestionScoreStatus,
  SuggestionCaseScore,
  SuggestionEvalGeneratedCase,
  ScoreSuggestionCasesOptions,
};
