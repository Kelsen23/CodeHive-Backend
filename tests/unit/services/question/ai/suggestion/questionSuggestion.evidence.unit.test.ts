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
        protectedEvidence.placeholders,
      ),
    ).toBe(body);
  });

  it("leaves ordinary prose unchanged", () => {
    const body = "The request fails after a few seconds.";

    expect(protectTechnicalEvidence(body)).toEqual({
      text: body,
      blocks: [],
      placeholders: [],
    });
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
        protectedEvidence.placeholders,
      ),
    ).toBe(body);
  });

  it("protects an opening fence that has no closing delimiter", () => {
    const body = [
      "Before",
      "```log",
      "status=500",
      "still part of the log",
    ].join("\n");
    const protectedEvidence = protectTechnicalEvidence(body);

    expect(protectedEvidence.blocks).toEqual([body.slice(body.indexOf("```"))]);
    expect(
      restoreTechnicalEvidence(
        protectedEvidence.text,
        protectedEvidence.blocks,
        protectedEvidence.placeholders,
      ),
    ).toBe(body);
  });

  it("protects fences nested in blockquotes and list items", () => {
    const body = [
      "> ```js",
      "> const quoted = true;",
      "> ```",
      "- ```text",
      "  list-value=1",
      "  ```",
    ].join("\n");
    const protectedEvidence = protectTechnicalEvidence(body);

    expect(protectedEvidence.blocks).toEqual([
      ["> ```js", "> const quoted = true;", "> ```"].join("\n"),
      ["- ```text", "  list-value=1", "  ```"].join("\n"),
    ]);
    expect(
      restoreTechnicalEvidence(
        protectedEvidence.text,
        protectedEvidence.blocks,
        protectedEvidence.placeholders,
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

  it("accepts a raw block when it was preserved exactly once", () => {
    const block = "```js\nconst value = 1;\n```";

    expect(restoreTechnicalEvidence(block, [block])).toBe(block);
  });

  it("rejects a raw block alongside its placeholder", () => {
    const block = "```js\nconst value = 1;\n```";

    expect(() =>
      restoreTechnicalEvidence(`__QANOPY_TECHNICAL_BLOCK_0__\n${block}`, [
        block,
      ]),
    ).toThrow("was duplicated in the generated body");
  });

  it("avoids collisions with literal placeholder-shaped evidence", () => {
    const body = [
      "The log contains __QANOPY_TECHNICAL_BLOCK_0__.",
      "```text",
      "value=1",
      "```",
    ].join("\n");

    const protectedEvidence = protectTechnicalEvidence(body);

    expect(protectedEvidence.placeholders[0]).not.toBe(
      "__QANOPY_TECHNICAL_BLOCK_0__",
    );
    expect(
      restoreTechnicalEvidence(
        protectedEvidence.text,
        protectedEvidence.blocks,
        protectedEvidence.placeholders,
      ),
    ).toBe(body);
  });
});
