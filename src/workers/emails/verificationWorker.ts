import { Worker } from "bullmq";
import { redisMessagingClientConnection } from "../../config/redis.js";

import transporter from "../../config/nodemailer.js";

new Worker(
  "verificationQueue",
  async (job) => {
    const { email, htmlContent } = job.data;

    await transporter.sendMail({
      from: `'QANOPY' <${process.env.QANOPY_EMAIL}>`,
      to: email,
      subject: "Verify Email",
      html: htmlContent,
    });
  },
  { connection: redisMessagingClientConnection, concurrency: 20 },
);
