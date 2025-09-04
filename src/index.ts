import dotenv from "dotenv";
import path from "path";
import http from "http";

import express from "express";

import authRouter from "./routes/authRoutes.js";

import cookieParser from "cookie-parser";

import connectMongoDB from "./config/mongoDB.js";
import { checkRedisConnection } from "./config/redis.js";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const app = express();
const server = http.createServer(app);

connectMongoDB(process.env.MONGO_URI as string);
checkRedisConnection();

const port = Number(process.env.PORT) || 5000;

app.set("trust proxy", 1);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use("/api/auth", authRouter);

server.on("error", (err) => {
  console.error("Server failed to start:", err);
  process.exit(1);
});

server.listen(port, () =>
  console.log(`Server running on http://localhost:${port}`),
);
