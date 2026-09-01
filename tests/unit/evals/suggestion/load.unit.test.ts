import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { loadSuggestionEvalCases } from "../../../../evals/suggestion/load.js";

const temporaryDirectories: string[] = [];

const createJsonlFile = async (contents: string) => {
  const directory = await mkdtemp(join(tmpdir(), "qanopy-suggestion-eval-"));
  temporaryDirectories.push(directory);
  const filename = join(directory, "cases.jsonl");
  await writeFile(filename, contents, "utf8");
  return filename;
};

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

const validCase = (id: string) =>
  JSON.stringify({
    id,
    description: `Case ${id}`,
    input: {
      title: "Why does my Node.js request fail?",
      body: "Node.js 22.3.0 returns ECONNRESET when I call the service.",
      tags: ["NODE_JS"],
    },
    assertions: {
      mustPreserve: ["Node.js 22.3.0", "ECONNRESET"],
      requiredTags: ["NODE_JS"],
    },
    scenarioTags: ["fixture"],
  });

describe("loadSuggestionEvalCases", () => {
  it("loads valid rows, skips blank lines, and preserves order", async () => {
    const filename = await createJsonlFile(
      `\n${validCase("case-1")}\n\n${validCase("case-2")}\n`,
    );

    await expect(loadSuggestionEvalCases(filename)).resolves.toMatchObject([
      { id: "case-1" },
      { id: "case-2" },
    ]);
  });

  it("allows an empty dataset", async () => {
    const filename = await createJsonlFile("\n  \n");

    await expect(loadSuggestionEvalCases(filename)).resolves.toEqual([]);
  });

  it("reports malformed JSON with filename and line number", async () => {
    const filename = await createJsonlFile("not-json\n");

    await expect(loadSuggestionEvalCases(filename)).rejects.toThrow(
      `${filename}:1: invalid JSON:`,
    );
  });

  it("reports schema failures with filename and line number", async () => {
    const filename = await createJsonlFile(
      '\n\n{"id":"case-1","description":"Missing input","assertions":{},"scenarioTags":["fixture"]}\n',
    );

    await expect(loadSuggestionEvalCases(filename)).rejects.toThrow(
      `${filename}:3: invalid suggestion eval case:`,
    );
  });

  it("rejects duplicate case IDs", async () => {
    const filename = await createJsonlFile(
      `${validCase("case-1")}\n${validCase("case-1")}\n`,
    );

    await expect(loadSuggestionEvalCases(filename)).rejects.toThrow(
      `${filename}:2: duplicate suggestion eval case ID: case-1`,
    );
  });
});
