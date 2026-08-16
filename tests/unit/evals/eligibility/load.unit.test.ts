import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { loadQuestionEligibilityEvalCases } from "../../../../evals/eligibility/load.js";

const temporaryDirectories: string[] = [];

const createJsonlFile = async (contents: string) => {
  const directory = await mkdtemp(join(tmpdir(), "qanopy-eligibility-eval-"));
  temporaryDirectories.push(directory);
  const filename = join(directory, "cases.jsonl");
  await writeFile(filename, contents, "utf8");
  return filename;
};

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

const validCase = (id: string) =>
  JSON.stringify({
    id,
    description: `Case ${id}`,
    input: {
      title: "How do I fix this TypeScript error?",
      body: "The compiler reports an error and I need help understanding it.",
      tags: ["TYPESCRIPT"],
    },
    expected: {
      decision: "ALLOW",
      eligibleForDownstreamProcessing: true,
      understandability: { acceptableStatuses: ["UNDERSTANDABLE"] },
      softwareValidity: {
        isSoftwareRelated: true,
        hasRealQuestionOrProblem: true,
        acceptableIntents: ["DEBUGGING"],
      },
      answerability: { status: "ANSWERABLE" },
      security: {
        acceptablePromptInjectionRisks: ["NONE"],
        hasSuspiciousInstructionalText: false,
        acceptableHarmfulTechnicalIntents: ["NONE"],
      },
    },
    tags: ["fixture"],
  });

describe("loadQuestionEligibilityEvalCases", () => {
  it("loads valid rows, skips blank lines, and preserves order", async () => {
    const filename = await createJsonlFile(
      `\n${validCase("case-1")}\n\n${validCase("case-2")}\n`,
    );

    await expect(loadQuestionEligibilityEvalCases(filename)).resolves.toMatchObject([
      { id: "case-1" },
      { id: "case-2" },
    ]);
  });

  it("allows an empty dataset", async () => {
    const filename = await createJsonlFile("\n  \n");

    await expect(loadQuestionEligibilityEvalCases(filename)).resolves.toEqual([]);
  });

  it("includes filename and line number for malformed JSON", async () => {
    const filename = await createJsonlFile("not-json\n");

    await expect(loadQuestionEligibilityEvalCases(filename)).rejects.toThrow(
      `${filename}:1: invalid JSON:`,
    );
  });

  it("includes filename and line number for schema failures", async () => {
    const filename = await createJsonlFile(
      '{"id":"case-1","description":"Missing input","expected":{"decision":"ALLOW"},"tags":["safe"]}\n',
    );

    await expect(loadQuestionEligibilityEvalCases(filename)).rejects.toThrow(
      `${filename}:1: invalid question eligibility eval case:`,
    );
  });
});
