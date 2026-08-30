import { describe, expect, it } from "vitest";

import buildQuestionEmbeddingInput from "../../../../../src/services/question/embedding/dense/questionEmbeddingText.service.js";

describe("buildQuestionEmbeddingInput", () => {
  it("builds the production query and document representation", () => {
    expect(
      buildQuestionEmbeddingInput({
        title: "  How   do I deploy?  ",
        body: "  The   application fails in production.\n",
      }).text,
    ).toBe(
      "Title: How do I deploy?\nBody: The application fails in production.",
    );
  });

  it("does not include tags in the embedding representation", () => {
    expect(
      buildQuestionEmbeddingInput({
        title: "Question",
        body: "Body",
      }).text,
    ).toBe("Title: Question\nBody: Body");
  });
});
