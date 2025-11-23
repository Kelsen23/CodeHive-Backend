import { Worker } from "bullmq";
import { redisConnection } from "../config/redis.js";

import transporter from "../config/nodemailer.js";

new Worker(
  "verificationQueue",
  async (job) => {
    const { email, htmlContent } = job.data;

    await transporter.sendMail({
      from: `'CodeHive' <${process.env.CODEHIVE_EMAIL}>`,
      to: email,
      subject: "Verify Email",
      html: htmlContent,
    });
  },
  { connection: redisConnection, concurrency: 20 },
);
