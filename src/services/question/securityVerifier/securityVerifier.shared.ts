import type { SecurityVerifierResult } from "../../../validations/question.schema.js";
import type { SecurityVerifierStatus } from "../questionEligibilityGate/questionEligibilityGate.shared.js";
import type { QuestionGatewayAuditDecision } from "../questionEligibilityGate/questionGatewayAudit.shared.js";

type ProcessSecurityVerifierJobData = {
  questionId: string;
  version: number;
};

const securityVerifierStatusByDecision: Record<
  SecurityVerifierResult["finalSecurityDecision"],
  Extract<
    SecurityVerifierStatus,
    "ALLOWED" | "ALLOWED_WITH_CONSTRAINTS" | "REJECTED"
  >
> = {
  ALLOW: "ALLOWED",
  ALLOW_WITH_CONSTRAINTS: "ALLOWED_WITH_CONSTRAINTS",
  REJECT: "REJECTED",
};

const questionGatewayAuditDecisionBySecurityDecision: Record<
  SecurityVerifierResult["finalSecurityDecision"],
  QuestionGatewayAuditDecision
> = {
  ALLOW: "ALLOW",
  ALLOW_WITH_CONSTRAINTS: "ALLOW_WITH_CONSTRAINTS",
  REJECT: "REJECT",
};

const buildSecurityVerifierMetadata = (
  result: SecurityVerifierResult,
  syntheticFailClosed: boolean,
) => ({
  finalSecurityDecision: result.finalSecurityDecision,
  eligibleForDownstreamProcessing:
    result.downstreamPolicy.eligibleForDownstreamProcessing,
  requireDefensiveFraming: result.downstreamPolicy.requireDefensiveFraming,
  requireQuotedTextIsolation:
    result.downstreamPolicy.requireQuotedTextIsolation,
  promptInjectionDetected: result.promptInjection.detected,
  promptInjectionRisk: result.promptInjection.risk,
  promptInjectionAttackType: result.promptInjection.attackType,
  promptInjectionSuspiciousText: result.promptInjection.suspiciousText,
  harmfulTechnicalIntentDetected: result.harmfulTechnicalIntent.detected,
  harmfulTechnicalIntentCategory: result.harmfulTechnicalIntent.category,
  harmfulTechnicalIntentSeverity: result.harmfulTechnicalIntent.severity,
  syntheticFailClosed,
});

const buildFailClosedSecurityVerifierResult = (
  error: unknown,
): SecurityVerifierResult => {
  const message = error instanceof Error ? error.message : "Unknown error";

  return {
    finalSecurityDecision: "REJECT",
    promptInjection: {
      detected: true,
      risk: "HIGH",
      attackType: "OTHER",
      suspiciousText: [],
    },
    harmfulTechnicalIntent: {
      detected: false,
      category: "NONE",
      severity: "NONE",
    },
    downstreamPolicy: {
      eligibleForDownstreamProcessing: false,
      requireDefensiveFraming: false,
      requireQuotedTextIsolation: false,
    },
    userFacingReason:
      "This question could not be safely verified for downstream AI processing.",
    internalReason: `Security verifier failed closed: ${message}`,
  };
};

export {
  buildFailClosedSecurityVerifierResult,
  buildSecurityVerifierMetadata,
  questionGatewayAuditDecisionBySecurityDecision,
  securityVerifierStatusByDecision,
};

export type { ProcessSecurityVerifierJobData };
