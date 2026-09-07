import { describe, expect, it, vi } from "vitest";

const find = vi.hoisted(() => vi.fn());

vi.mock("../../../src/models/questionProcessingState.model.js", () => ({
  default: { find },
}));

const { default: createQuestionProcessingStateLoader } = await import(
  "../../../src/dataloaders/questionProcessingState.loader.js"
);

describe("question processing state dataloader", () => {
  it("batches state reads and preserves requested order", async () => {
    const lean = vi.fn(async () => [
      { questionId: "question_2", canGetAIAnswer: true },
      { questionId: "question_1", canGetAIAnswer: false },
    ]);
    find.mockReturnValueOnce({ lean });
    const loader = createQuestionProcessingStateLoader();

    const results = await Promise.all([
      loader.load("question_1"),
      loader.load("question_2"),
      loader.load("question_3"),
    ]);

    expect(find).toHaveBeenCalledOnce();
    expect(find).toHaveBeenCalledWith({
      questionId: {
        $in: ["question_1", "question_2", "question_3"],
      },
    });
    expect(results).toEqual([
      { questionId: "question_1", canGetAIAnswer: false },
      { questionId: "question_2", canGetAIAnswer: true },
      null,
    ]);
  });
});
