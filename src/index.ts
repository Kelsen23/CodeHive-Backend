import dotenv from "dotenv";
import path from "path";
import http from "http";
import cors from "cors";

import express from "express";

import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@as-integrations/express5";
import bodyParser from "body-parser";

import authenticateGraphQLUser from "./middlewares/graphqlAuth.js";

import UserWithoutSensitiveInfo from "./types/userWithoutSesitiveInfo.js";

import createUserLoader from "./dataloaders/userLoader.js";

import typeDefs from "./graphql/typeDefs/index.js";
import resolvers from "./graphql/resolvers/index.js";

import authRoute from "./routes/authRoute.js";
import uploadFileRoute from "./routes/uploadFileRoute.js";
import userRoute from "./routes/userRoute.js";
import questionRoute from "./routes/questionRoutes.js";

import cookieParser from "cookie-parser";

import { PrismaClient } from "./generated/prisma/index.js";

import connectMongoDB from "./config/mongoDB.js";
import { checkRedisConnection, redisClient } from "./config/redis.js";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const apolloServer = new ApolloServer({
  typeDefs,
  resolvers,
});

await apolloServer.start();

const app = express();
const server = http.createServer(app);

export const prisma = new PrismaClient();

connectMongoDB(process.env.MONGO_URI as string);
checkRedisConnection();

const port = Number(process.env.PORT) || 5000;

app.set("trust proxy", 1);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use("/api/auth", authRoute);
app.use("/api/upload", uploadFileRoute);
app.use("/api/user", userRoute);
app.use("/api/question", questionRoute);

app.use(
  "/graphql",
  cors<cors.CorsRequest>({
    credentials: true,
  }),
  bodyParser.json(),
  expressMiddleware(apolloServer, {
    context: async ({ req }) => {
      const user: UserWithoutSensitiveInfo = await authenticateGraphQLUser(
        req as any,
      );

      return {
        token: req.headers.authorization,
        prisma,
        redisClient,
        user,
        loaders: {
          userLoader: createUserLoader(),
        },
      };
    },
  }),
);

server.on("error", (err) => {
  console.error("Server failed to start:", err);
  process.exit(1);
});

server.listen(port, () =>
  console.log(`Server running on http://localhost:${port}`),
);
