import client from "../config/openai.js";

type AiDecision =
  | "REMOVE_CONTENT"
  | "BAN_USER_TEMP"
  | "BAN_USER_PERM"
  | "IGNORE"
  | "UNCERTAIN";

interface AiModerationResult {
  decisions: AiDecision[];
  confidence: number;
  reasons: string[];
}

const aiModerateReport = async (
  content: string,
): Promise<AiModerationResult> => {
  try {
    const response = await client.moderations.create({
      model: "omni-moderation-latest",
      input: content,
    });

    const result = response.results[0];
    const decisions: AiDecision[] = [];
    let maxConfidence = 0;
    const reasons: string[] = [];

    if (!result.flagged) {
      decisions.push("IGNORE");
    } else {
      if (result.categories.hate || result.categories.harassment) {
        const c = Math.max(
          result.category_scores.hate,
          result.category_scores.harassment,
        );
        maxConfidence = Math.max(maxConfidence, c);
        decisions.push(c >= 0.8 ? "BAN_USER_PERM" : "BAN_USER_TEMP");
        decisions.push("REMOVE_CONTENT");
        reasons.push("Hate/harassment detected");
      }

      if (result.categories.sexual || result.categories.violence) {
        const c = Math.max(
          result.category_scores.sexual,
          result.category_scores.violence,
        );
        maxConfidence = Math.max(maxConfidence, c);
        decisions.push(c >= 0.8 ? "BAN_USER_PERM" : "BAN_USER_TEMP");
        decisions.push("REMOVE_CONTENT");
        reasons.push("Inappropriate content detected");
      }

      if (decisions.length === 0) {
        decisions.push("UNCERTAIN");
        reasons.push("Flagged but unclear");
      }
    }

    return {
      decisions: [...new Set(decisions)],
      confidence: maxConfidence,
      reasons: [...new Set(reasons)],
    };
  } catch (err: any) {
    console.error("AI moderation error:", err);
    return {
      decisions: ["UNCERTAIN"],
      confidence: 0,
      reasons: [],
    };
  }
};

export default aiModerateReport;
