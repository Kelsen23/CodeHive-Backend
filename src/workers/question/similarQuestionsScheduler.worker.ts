import { scheduleStaleSimilarQuestions } from "../../services/question/similarQuestions/similarQuestionsScheduler.service.js";

import connectMongoDB from "../../config/mongodb.config.js";

const schedulerIntervalMs = 15 * 60 * 1000;

const runScheduler = async () => {
  const result = await scheduleStaleSimilarQuestions();
  console.log("[similarQuestionsScheduler]", result);
};

const startWorker = async () => {
  await connectMongoDB(process.env.MONGO_URI as string);
  await runScheduler();

  const interval = setInterval(() => {
    runScheduler().catch((error) => {
      console.error("[similarQuestionsScheduler] Failed:", error);
    });
  }, schedulerIntervalMs);

  const shutdown = () => {
    clearInterval(interval);
    process.exit(0);
  };

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
};

startWorker().catch((error) => {
  console.error("Failed to start similar questions scheduler:", error);
  process.exit(1);
});
