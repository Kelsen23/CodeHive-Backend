import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { loadModerationEvalCases } from "../../../../evals/moderation/load.js";

const temporaryDirectories: string[] = [];

const createJsonlFile = async (contents: string) => {
  const directory = await mkdtemp(join(tmpdir(), "qanopy-moderation-eval-"));
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

describe("loadModerationEvalCases", () => {
  it("loads valid rows, skips blanks, and preserves order", async () => {
    const filename = await createJsonlFile(
      '\n{"id":"case-1","description":"First","input":{"contentType":"REPLY","body":"one"},"expected":{"flagged":false},"tags":["safe"]}\n\n{"id":"case-2","description":"Second","input":{"contentType":"ANSWER","body":"two"},"expected":{"flagged":true},"tags":["unsafe"]}\n',
    );

    await expect(loadModerationEvalCases(filename)).resolves.toMatchObject([
      { id: "case-1" },
      { id: "case-2" },
    ]);
  });

  it("allows an empty dataset", async () => {
    const filename = await createJsonlFile("\n  \n");

    await expect(loadModerationEvalCases(filename)).resolves.toEqual([]);
  });

  it("includes filename and line number for malformed JSON", async () => {
    const filename = await createJsonlFile("not-json\n");

    await expect(loadModerationEvalCases(filename)).rejects.toThrow(
      `${filename}:1: invalid JSON:`,
    );
  });

  it("includes filename and line number for schema failures", async () => {
    const filename = await createJsonlFile(
      '{"id":"case-1","description":"Missing input","expected":{"flagged":false},"tags":["safe"]}\n',
    );

    await expect(loadModerationEvalCases(filename)).rejects.toThrow(
      `${filename}:1: invalid moderation eval case:`,
    );
  });
});
