import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";

import type { ZodError } from "zod";

import type { SuggestionEvalCase } from "./schema.js";
import { suggestionEvalCaseSchema } from "./schema.js";

const formatValidationIssues = (error: ZodError) =>
  error.issues
    .map(({ path, message }) => {
      const issuePath = path.length > 0 ? `.${path.join(".")}` : "";

      return `${issuePath} ${message}`;
    })
    .join("; ");

const loadSuggestionEvalCases = async (
  filename: string,
): Promise<SuggestionEvalCase[]> => {
  const cases: SuggestionEvalCase[] = [];
  const caseIds = new Set<string>();
  const lines = createInterface({
    input: createReadStream(filename),
    crlfDelay: Infinity,
  });

  let lineNumber = 0;

  try {
    for await (const line of lines) {
      lineNumber += 1;

      if (line.trim().length === 0) continue;

      let parsedLine: unknown;

      try {
        parsedLine = JSON.parse(line);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);

        throw new Error(`${filename}:${lineNumber}: invalid JSON: ${message}`);
      }

      const result = suggestionEvalCaseSchema.safeParse(parsedLine);

      if (!result.success) {
        throw new Error(
          `${filename}:${lineNumber}: invalid suggestion eval case: ${formatValidationIssues(result.error)}`,
        );
      }

      if (caseIds.has(result.data.id)) {
        throw new Error(
          `${filename}:${lineNumber}: duplicate suggestion eval case ID: ${result.data.id}`,
        );
      }

      caseIds.add(result.data.id);
      cases.push(result.data);
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes(`${filename}:`)) {
      throw error;
    }

    const message = error instanceof Error ? error.message : String(error);

    throw new Error(`${filename}: unable to read JSONL file: ${message}`);
  } finally {
    lines.close();
  }

  return cases;
};

export { loadSuggestionEvalCases };
