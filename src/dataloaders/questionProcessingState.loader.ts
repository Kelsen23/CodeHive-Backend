import DataLoader from "dataloader";

import QuestionProcessingState from "../models/questionProcessingState.model.js";

const batchQuestionProcessingStates = async (
  questionIds: readonly string[],
) => {
  const states = await QuestionProcessingState.find({
    questionId: { $in: questionIds },
  }).lean();
  const stateByQuestionId = new Map(
    states.map((state) => [String(state.questionId), state]),
  );

  return questionIds.map(
    (questionId) => stateByQuestionId.get(questionId) ?? null,
  );
};

const createQuestionProcessingStateLoader = () =>
  new DataLoader(batchQuestionProcessingStates);

export default createQuestionProcessingStateLoader;
