import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: 587,
  secure: false,
  auth: {
    user: process.env.SENDER_EMAIL,
    pass: process.env.SENDER_PASS,
  },
});

export default transporter;
