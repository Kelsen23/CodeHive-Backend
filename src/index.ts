import dotenv from "dotenv";
import path from "path";
import http from "http";

import express from "express";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const app = express();
const server = http.createServer(app);

const port = Number(process.env.PORT) || 5000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/", (req, res) => {
  res.send("Hello From CodeHive 👋");
});

server.on("error", (err) => {
  console.error("Server failed to start:", err);
  process.exit(1);
});

server.listen(port, () =>
  console.log(`Server running on http://localhost:${port}`),
);
