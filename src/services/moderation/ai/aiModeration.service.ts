import type { LLMMetadata } from "../../llmGateway/llmGateway.types.js";

import llmGateway from "../../llmGateway/llmGateway.service.js";

import {
  buildAiModerationPolicy,
  type AiModerationPolicyResult,
} from "./aiModeration.policy.js";

type AiModerationFailureResult = {
  ok: false;
  error: string;
};

type AiModerationSuccessResult = AiModerationPolicyResult & {
  ok: true;
};

type AiModerationResult = AiModerationSuccessResult | AiModerationFailureResult;

type AiModerationEvaluation = {
  result: AiModerationResult;
  routing?: Pick<
    LLMMetadata,
    "provider" | "model" | "fallbackUsed" | "routedModel"
  >;
};

const aiModerateContentWithMetadata = async (
  content: string,
): Promise<AiModerationEvaluation> => {
  try {
    const result = await llmGateway.moderate({ input: content });

    return {
      result: {
        ok: true,
        ...buildAiModerationPolicy({
          flagged: result.flagged,
          category_scores: result.categoryScores,
        } as {
          flagged: boolean;
          category_scores?: Record<string, number>;
        }),
      },
      routing: {
        provider: result.metadata.provider,
        model: result.metadata.model,
        fallbackUsed: result.metadata.fallbackUsed,
        routedModel: result.metadata.routedModel,
      },
    };
  } catch (error) {
    console.error("AI moderation error:", error);

    return {
      result: {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown AI moderation error",
      },
    };
  }
};

const aiModerateContent = async (
  content: string,
): Promise<AiModerationResult> =>
  (await aiModerateContentWithMetadata(content)).result;

export type {
  AiModerationResult,
  AiModerationFailureResult,
  AiModerationSuccessResult,
  AiModerationEvaluation,
};

export { aiModerateContentWithMetadata };
export default aiModerateContent;
