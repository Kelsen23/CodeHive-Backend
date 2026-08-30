import generateEmbedding from "../ai/generateEmbedding.service.js";
import runQuestionEmbeddingReadySideEffects from "../embedding/dense/questionEmbeddingSideEffects.service.js";
import {
  finalizeQuestionEmbedding,
  loadCurrentQuestionVersionForEmbedding,
  loadReadyQuestionForEmbeddingSideEffects,
  lockQuestionForEmbedding,
  resetQuestionEmbeddingProcessing,
} from "../embedding/dense/questionEmbeddingState.service.js";
import buildQuestionEmbeddingInput from "../embedding/dense/questionEmbeddingText.service.js";
import {
  denseRepresentationVersion,
  type QuestionEmbeddingJobData,
} from "../embedding/dense/questionEmbedding.shared.js";

import QuestionEmbedding from "../../../models/questionEmbedding.model.js";

const runReadySideEffectsIfCurrent = async ({
  questionId,
  version,
  userId,
}: {
  questionId: string;
  version: number;
  userId?: unknown;
}) => {
  const readyQuestion = userId
    ? { userId }
    : await loadReadyQuestionForEmbeddingSideEffects(questionId, version);

  if (!readyQuestion) return;

  await runQuestionEmbeddingReadySideEffects({
    questionId,
    version,
    userId: String(readyQuestion.userId),
  });
};

const processQuestionEmbeddingJob = async ({
  questionId,
  version,
}: QuestionEmbeddingJobData) => {
  const locked = await lockQuestionForEmbedding(questionId, version);

  if (!locked) {
    await runReadySideEffectsIfCurrent({ questionId, version });
    return;
  }

  const questionVersion = await loadCurrentQuestionVersionForEmbedding(
    questionId,
    version,
  );

  if (!questionVersion) {
    await resetQuestionEmbeddingProcessing(questionId, version);
    return;
  }

  const { text } = buildQuestionEmbeddingInput({
    title: questionVersion.title,
    body: questionVersion.body,
  });

  const existingEmbedding = await QuestionEmbedding.findOne({
    questionId,
    version,
    representationVersion: denseRepresentationVersion,
  }).lean();

  if (existingEmbedding?.vector?.length) {
    const updated = await finalizeQuestionEmbedding({
      questionId,
      version,
      embedding: existingEmbedding.vector,
      model: existingEmbedding.model,
    });

    if (updated.acknowledged) {
      await runReadySideEffectsIfCurrent({
        questionId,
        version,
        userId: locked.userId,
      });
    }

    return;
  }

  let generated;
  try {
    generated = await generateEmbedding(text);
  } catch (error) {
    await resetQuestionEmbeddingProcessing(questionId, version);
    throw error;
  }

  const updated = await finalizeQuestionEmbedding({
    questionId,
    version,
    embedding: generated.embedding,
    model: generated.model,
  });

  if (!updated.acknowledged) return;

  await runReadySideEffectsIfCurrent({
    questionId,
    version,
    userId: locked.userId,
  });
};

export default processQuestionEmbeddingJob;
