import HttpError from "../../utils/httpError.js";

import Question from "../../models/questionModel.js";
import Vote from "../../models/voteModel.js";

import UserWithoutSensitiveInfo from "../../types/userWithoutSesitiveInfo.js";

const questionResolvers = {
  Query: {
    getRecommendedQuestions: async (
      _: any,
      { skipCount }: { skipCount: number },
      {
        user,
        redisClient,
        loaders,
      }: {
        user: UserWithoutSensitiveInfo;
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

      const matchStage: any = { isDeleted: false, isActive: true };
      if (interests.length > 0) matchStage.tags = { $in: interests };

      const questions = await Question.aggregate([
        { $match: matchStage },

        {
          $lookup: {
            from: "votes",
            localField: "_id",
            foreignField: "targetId",
            as: "votes",
          },
        },

        {
          $addFields: {
            upvotes: {
              $size: {
                $filter: {
                  input: "$votes",
                  cond: { $eq: ["$$this.voteType", "upvote"] },
                },
              },
            },
            downvotes: {
              $size: {
                $filter: {
                  input: "$votes",
                  cond: { $eq: ["$$this.voteType", "downvote"] },
                },
              },
            },
          },
        },

        { $sort: { upvotes: -1 } },
        { $skip: skipCount * 10 },
        { $limit: 10 },

        {
          $project: {
            id: "$_id",
            title: 1,
            body: 1,
            tags: 1,
            userId: 1,
            upvotes: 1,
            downvotes: 1,
            isDeleted: 1,
            isActive: 1,
            createdAt: 1,
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

        return { ...q, user };
      });

      await redisClient.set(
        `recommendedQuestions:${sortedInterests}:${skipCount}`,
        JSON.stringify(questionsWithUsers),
        "EX",
        60 * 5,
      );

      return questionsWithUsers;
    },
  },
};

export default questionResolvers;
