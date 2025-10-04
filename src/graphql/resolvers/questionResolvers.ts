import HttpError from "../../utils/httpError.js";

import Vote from "../../models/voteModel.js";
import Question from "../../models/questionModel.js";

import UserWithoutSensitiveInfo from "../../types/userWithoutSesitiveInfo.js";

const questionResolvers = {
  Query: {
    getRecommendedQuestions: async (
      _: any,
      { skipCount }: { skipCount: number },
      {
        user,
        prisma,
        redisClient,
        loaders,
      }: {
        user: UserWithoutSensitiveInfo;
        prisma: any;
        redisClient: any;
        loaders: any;
      },
    ) => {
      const interests = user.interests || [];

      const sortedInterests = [...interests].sort().join(",");

      const cachedQuestions = await redisClient.get(
        `recommendedQuestions:${sortedInterests}:${skipCount}`,
      );

      if (cachedQuestions) return JSON.parse(cachedQuestions);

      if (interests.length <= 0) {
        const questions = await Vote.aggregate([
          {
            $group: {
              _id: "$targetId",
              upvotes: {
                $sum: { $cond: [{ $eq: ["$voteType", "upvote"] }, 1, 0] },
              },
              downvotes: {
                $sum: { $cond: [{ $eq: ["$voteType", "downvote"] }, 1, 0] },
              },
            },
          },

          {
            $lookup: {
              from: "questions",
              localField: "_id",
              foreignField: "_id",
              as: "question",
            },
          },

          { $unwind: "$question" },

          {
            $match: { "question.isDeleted": false, "question.isActive": true },
          },

          { $sort: { upvotes: -1 } },

          { $skip: skipCount * 10 },

          { $limit: 10 },

          {
            $project: {
              id: "$question._id",
              title: "$question.title",
              body: "$question.body",
              tags: "$question.tags",
              userId: "$question.userId",
              upvotes: 1,
              downvotes: 1,
              createdAt: "$question.createdAt",
            },
          },
        ]);

        const userIds = questions.map((q) => q.userId);
        const uniqueUserIds = [...new Set(userIds)];

        const users = await loaders.userLoader.loadMany(uniqueUserIds);

        const questionsWithUsers = questions.map((q) => {
          let user = users.find((u: any) => u && u.id === q.userId);

          if (!user) {
            user = {
              id: q.userId,
              username: "Deleted User",
              email: "deleted@user.com",
              profilePictureUrl: null,
              bio: null,
              reputationPoints: 0,
              role: "USER",
              questionsAsked: 0,
              answersGiven: 0,
              bestAnswers: 0,
              achievments: [],
              status: "TERMINATED",
              isVerified: false,
              createdAt: new Date(0).toISOString(),
            };
          }

          return {
            ...q,
            user,
          };
        });

        await redisClient.set(
          `recommendedQuestions:${sortedInterests}:${skipCount}`,
          JSON.stringify(questionsWithUsers),
          "EX",
          60 * 5,
        );

        return questionsWithUsers;
      } else {
        const questions = await Vote.aggregate([
          {
            $group: {
              _id: "$targetId",
              upvotes: {
                $sum: { $cond: [{ $eq: ["$voteType", "upvote"] }, 1, 0] },
              },
              downvotes: {
                $sum: { $cond: [{ $eq: ["$voteType", "downvote"] }, 1, 0] },
              },
            },
          },

          {
            $lookup: {
              from: "questions",
              localField: "_id",
              foreignField: "_id",
              as: "question",
            },
          },

          { $unwind: "$question" },

          {
            $match: {
              "question.isDeleted": false,
              "question.isActive": true,
              ...(interests.length > 0
                ? { "question.tags": { $in: interests } }
                : {}),
            },
          },

          { $sort: { upvotes: -1 } },
          { $skip: skipCount * 10 },
          { $limit: 10 },

          {
            $project: {
              id: "$question._id",
              title: "$question.title",
              body: "$question.body",
              tags: "$question.tags",
              userId: "$question.userId",
              upvotes: 1,
              downvotes: 1,
              createdAt: "$question.createdAt",
            },
          },
        ]);

        const userIds = questions.map((q) => q.userId);
        const uniqueUserIds = [...new Set(userIds)];

        const users = await loaders.userLoader.loadMany(uniqueUserIds);

        const questionsWithUsers = questions.map((q) => {
          let user = users.find((u: any) => u && u.id === q.userId);

          if (!user) {
            user = {
              id: q.userId,
              username: "Deleted User",
              email: "deleted@user.com",
              profilePictureUrl: null,
              bio: null,
              reputationPoints: 0,
              role: "USER",
              questionsAsked: 0,
              answersGiven: 0,
              bestAnswers: 0,
              achievments: [],
              status: "TERMINATED",
              isVerified: false,
              createdAt: new Date(0).toISOString(),
            };
          }

          return {
            ...q,
            user,
          };
        });

        await redisClient.set(
          `recommendedQuestions:${sortedInterests}:${skipCount}`,
          JSON.stringify(questionsWithUsers),
          "EX",
          60 * 5,
        );

        return questionsWithUsers;
      }
    },
  },
};

export default questionResolvers;
