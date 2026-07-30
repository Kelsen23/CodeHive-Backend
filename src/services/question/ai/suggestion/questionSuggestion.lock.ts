import crypto from "crypto";

import { getRedisCacheClient } from "../../../../config/redis.config.js";

const QUESTION_SUGGESTION_LOCK_TTL_MS = 60000;
const QUESTION_SUGGESTION_LOCK_RENEW_INTERVAL_MS = 20000;

class QuestionSuggestionLockConflictError extends Error {
  constructor(questionId: string, version: number) {
    super(
      `AI suggestion generation already in progress for question ${questionId} version ${version}`,
    );
    this.name = "QuestionSuggestionLockConflictError";
  }
}

class QuestionSuggestionLockLostError extends Error {
  constructor(questionId: string, version: number) {
    super(
      `AI suggestion generation lock lost for question ${questionId} version ${version}`,
    );
    this.name = "QuestionSuggestionLockLostError";
  }
}

const acquireQuestionSuggestionLock = async (
  questionId: string,
  version: number,
) => {
  const redis = getRedisCacheClient();
  const lockKey = `question:ai-suggestion:${questionId}:${version}`;
  const lockToken = crypto.randomUUID();
  const acquired = await redis.set(
    lockKey,
    lockToken,
    "PX",
    QUESTION_SUGGESTION_LOCK_TTL_MS,
    "NX",
  );

  if (acquired !== "OK") {
    throw new QuestionSuggestionLockConflictError(questionId, version);
  }

  return { lockKey, lockToken };
};

const releaseQuestionSuggestionLock = async (
  lockKey: string,
  lockToken: string,
) => {
  const redis = getRedisCacheClient();

  await redis.eval(
    `
      if redis.call("GET", KEYS[1]) == ARGV[1] then
        return redis.call("DEL", KEYS[1])
      end
      return 0
    `,
    1,
    lockKey,
    lockToken,
  );
};

const safelyReleaseQuestionSuggestionLock = async (
  questionId: string,
  version: number,
  lockKey: string,
  lockToken: string,
) => {
  try {
    await releaseQuestionSuggestionLock(lockKey, lockToken);
  } catch (error) {
    console.error(
      `Failed to release AI suggestion lock for question ${questionId} version ${version}:`,
      error,
    );
  }
};

const renewQuestionSuggestionLock = async (
  lockKey: string,
  lockToken: string,
) => {
  const redis = getRedisCacheClient();

  const renewed = await redis.eval(
    `
      if redis.call("GET", KEYS[1]) == ARGV[1] then
        return redis.call("PEXPIRE", KEYS[1], ARGV[2])
      end
      return 0
    `,
    1,
    lockKey,
    lockToken,
    String(QUESTION_SUGGESTION_LOCK_TTL_MS),
  );

  return Number(renewed) === 1;
};

const isQuestionSuggestionLockHeld = async (
  lockKey: string,
  lockToken: string,
) => {
  const redis = getRedisCacheClient();

  const isHeld = await redis.eval(
    `
      if redis.call("GET", KEYS[1]) == ARGV[1] then
        return 1
      end
      return 0
    `,
    1,
    lockKey,
    lockToken,
  );

  return Number(isHeld) === 1;
};

const waitForRenewalToSettle = async (
  renewalInFlight: Promise<void> | null,
) => {
  if (!renewalInFlight) return;

  await Promise.allSettled([renewalInFlight]);
};

const withQuestionSuggestionLock = async <T>(
  questionId: string,
  version: number,
  action: (helpers: { assertLockHeld: () => Promise<void> }) => Promise<T>,
) => {
  const { lockKey, lockToken } = await acquireQuestionSuggestionLock(
    questionId,
    version,
  );
  let lockError: Error | null = null;
  let renewalInFlight: Promise<void> | null = null;

  const markLockLost = (error?: unknown) => {
    if (lockError) return;

    lockError =
      error instanceof Error
        ? error
        : new QuestionSuggestionLockLostError(questionId, version);
  };

  const assertLockHeld = async () => {
    await waitForRenewalToSettle(renewalInFlight);

    if (lockError) throw lockError;

    const stillHeld = await isQuestionSuggestionLockHeld(lockKey, lockToken);

    if (!stillHeld) {
      const error = new QuestionSuggestionLockLostError(questionId, version);
      markLockLost(error);
      throw error;
    }
  };

  const lockRenewer = setInterval(() => {
    renewalInFlight = renewQuestionSuggestionLock(lockKey, lockToken)
      .then((renewed) => {
        if (!renewed) {
          const error = new QuestionSuggestionLockLostError(
            questionId,
            version,
          );
          console.error(error.message);
          markLockLost(error);
        }
      })
      .catch((error) => {
        console.error(
          `Failed to renew AI suggestion lock for question ${questionId} version ${version}:`,
          error,
        );
        markLockLost(error);
      })
      .finally(() => {
        renewalInFlight = null;
      });
  }, QUESTION_SUGGESTION_LOCK_RENEW_INTERVAL_MS);

  try {
    return await action({ assertLockHeld });
  } finally {
    clearInterval(lockRenewer);
    await waitForRenewalToSettle(renewalInFlight);
    await safelyReleaseQuestionSuggestionLock(
      questionId,
      version,
      lockKey,
      lockToken,
    );
  }
};

export { QuestionSuggestionLockConflictError, withQuestionSuggestionLock };
