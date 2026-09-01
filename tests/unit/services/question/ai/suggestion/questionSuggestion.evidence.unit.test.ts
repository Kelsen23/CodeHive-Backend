import { describe, expect, it } from "vitest";

import {
  protectTechnicalEvidence,
  restoreTechnicalEvidence,
} from "../../../../../../src/services/question/ai/suggestion/questionSuggestion.evidence.js";

describe("question suggestion technical evidence protection", () => {
  it("replaces fenced blocks while preserving their exact contents for restoration", () => {
    const body = [
      "Before",
      "```js",
      "function add(a, b) {",
      "  return a - b;",
      "}",
      "",
      "console.log(add(4, 2));",
      "```",
      "After",
      "~~~yaml",
      "server:",
      "  port: 4100",
      "~~~",
    ].join("\n");

    const protectedEvidence = protectTechnicalEvidence(body);

    expect(protectedEvidence.text).toContain("__QANOPY_TECHNICAL_BLOCK_0__");
    expect(protectedEvidence.text).toContain("__QANOPY_TECHNICAL_BLOCK_1__");
    expect(protectedEvidence.text).not.toContain("function add");
    expect(protectedEvidence.blocks).toEqual([
      [
        "```js",
        "function add(a, b) {",
        "  return a - b;",
        "}",
        "",
        "console.log(add(4, 2));",
        "```",
      ].join("\n"),
      ["~~~yaml", "server:", "  port: 4100", "~~~"].join("\n"),
    ]);
    expect(
      restoreTechnicalEvidence(
        protectedEvidence.text,
        protectedEvidence.blocks,
      ),
    ).toBe(body);
  });

  it("leaves ordinary prose unchanged", () => {
    const body = "The request fails after a few seconds.";

    expect(protectTechnicalEvidence(body)).toEqual({ text: body, blocks: [] });
  });

  it("protects indented fences with a longer closing fence", () => {
    const body = [
      "Before",
      "   ```js",
      "const value = 1;",
      "   `````",
      "After",
    ].join("\n");

    const protectedEvidence = protectTechnicalEvidence(body);

    expect(protectedEvidence.blocks).toEqual([
      ["   ```js", "const value = 1;", "   `````"].join("\n"),
    ]);
    expect(
      restoreTechnicalEvidence(
        protectedEvidence.text,
        protectedEvidence.blocks,
      ),
    ).toBe(body);
  });

  it("rejects missing or duplicated protected placeholders", () => {
    expect(() =>
      restoreTechnicalEvidence("no block", ["```js\nvalue\n```"]),
    ).toThrow("must occur exactly once; found 0");
    expect(() =>
      restoreTechnicalEvidence(
        "__QANOPY_TECHNICAL_BLOCK_0__ __QANOPY_TECHNICAL_BLOCK_0__",
        ["```js\nvalue\n```"],
      ),
    ).toThrow("must occur exactly once; found 2");
  });
});
