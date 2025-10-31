import mongoose from "mongoose";

import Question from "../../models/questionModel.js";
import Answer from "../../models/answerModel.js";

import UserWithoutSensitiveInfo from "../../types/userWithoutSensitiveInfo.js";

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
            achievements: [],
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

    getQuestionById: async (
      _: any,
      { id }: { id: string },
      {
        user,
        redisClient,
        loaders,
      }: { user: UserWithoutSensitiveInfo; redisClient: any; loaders: any },
    ) => {
      const cachedQuestion = await redisClient.get(`question:${id}`);
      if (cachedQuestion) return JSON.parse(cachedQuestion);

      const questionData = await Question.aggregate([
        { $match: { _id: new mongoose.Types.ObjectId(id) } },

        {
          $lookup: {
            from: "answers",
            localField: "_id",
            foreignField: "questionId",
            as: "answers",
          },
        },

        {
          $addFields: { answerCount: { $size: { $ifNull: ["$answers", []] } } },
        },

        {
          $lookup: {
            from: "votes",
            localField: "_id",
            foreignField: "targetId",
            as: "questionVotes",
          },
        },

        {
          $addFields: {
            upvotes: {
              $size: {
                $filter: {
                  input: "$questionVotes",
                  as: "v",
                  cond: { $eq: ["$$v.voteType", "upvote"] },
                },
              },
            },
            downvotes: {
              $size: {
                $filter: {
                  input: "$questionVotes",
                  as: "v",
                  cond: { $eq: ["$$v.voteType", "downvote"] },
                },
              },
            },
          },
        },

        {
          $lookup: {
            from: "votes",
            localField: "answers._id",
            foreignField: "targetId",
            as: "answerVotes",
          },
        },

        {
          $addFields: {
            answers: {
              $filter: {
                input: "$answers",
                as: "a",
                cond: {
                  $and: [
                    { $eq: ["$$a.isActive", true] },
                    { $eq: ["$$a.isDeleted", false] },
                  ],
                },
              },
            },
          },
        },

        {
          $addFields: {
            answers: {
              $map: {
                input: "$answers",
                as: "ans",
                in: {
                  $mergeObjects: [
                    "$$ans",
                    {
                      upvotes: {
                        $size: {
                          $filter: {
                            input: "$answerVotes",
                            as: "v",
                            cond: {
                              $and: [
                                { $eq: ["$$v.targetId", "$$ans._id"] },
                                { $eq: ["$$v.voteType", "upvote"] },
                              ],
                            },
                          },
                        },
                      },
                      downvotes: {
                        $size: {
                          $filter: {
                            input: "$answerVotes",
                            as: "v",
                            cond: {
                              $and: [
                                { $eq: ["$$v.targetId", "$$ans._id"] },
                                { $eq: ["$$v.voteType", "downvote"] },
                              ],
                            },
                          },
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
        },

        {
          $addFields: {
            topAnswer: {
              $cond: {
                if: { $eq: [{ $size: "$answers" }, 0] },
                then: null,
                else: {
                  $let: {
                    vars: {
                      filteredTop: {
                        $filter: {
                          input: "$answers",
                          as: "a",
                          cond: { $eq: ["$$a.isBestAnswerByAsker", true] },
                        },
                      },
                    },
                    in: {
                      $cond: {
                        if: {
                          $gt: [
                            { $size: { $ifNull: ["$$filteredTop", []] } },
                            0,
                          ],
                        },
                        then: { $first: "$$filteredTop" },
                        else: {
                          $first: {
                            $sortArray: {
                              input: "$answers",
                              sortBy: { upvotes: -1, createdAt: 1 },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },

        {
          $lookup: {
            from: "replies",
            let: { topAnswerId: "$topAnswer._id" },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ["$answerId", "$$topAnswerId"] },
                  isActive: true,
                  isDeleted: false,
                },
              },
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
                        as: "v",
                        cond: { $eq: ["$$v.voteType", "upvote"] },
                      },
                    },
                  },
                  downvotes: {
                    $size: {
                      $filter: {
                        input: "$votes",
                        as: "v",
                        cond: { $eq: ["$$v.voteType", "downvote"] },
                      },
                    },
                  },
                },
              },
              { $sort: { upvotes: -1, createdAt: 1 } },
            ],
            as: "topReplies",
          },
        },

        {
          $project: {
            id: "$_id",
            userId: 1,
            title: 1,
            body: 1,
            tags: 1,
            upvotes: 1,
            downvotes: 1,
            answerCount: 1,
            isActive: 1,
            isDeleted: 1,
            createdAt: 1,
            topAnswer: {
              $cond: {
                if: {
                  $and: [
                    { $ne: ["$topAnswer", null] },
                    { $ne: ["$topAnswer._id", null] },
                  ],
                },
                then: {
                  id: "$topAnswer._id",
                  userId: "$topAnswer.userId",
                  body: "$topAnswer.body",
                  upvotes: "$topAnswer.upvotes",
                  downvotes: "$topAnswer.downvotes",
                  isBestAnswerByAsker: "$topAnswer.isBestAnswerByAsker",
                  isActive: "$topAnswer.isActive",
                  isDeleted: "$topAnswer.isDeleted",
                  createdAt: "$topAnswer.createdAt",
                  replyCount: { $size: "$topReplies" },
                  replies: {
                    $map: {
                      input: "$topReplies",
                      as: "reply",
                      in: {
                        id: "$$reply._id",
                        userId: "$$reply.userId",
                        body: "$$reply.body",
                        upvotes: "$$reply.upvotes",
                        downvotes: "$$reply.downvotes",
                        isActive: "$$reply.isActive",
                        isDeleted: "$$reply.isDeleted",
                        createdAt: "$$reply.createdAt",
                      },
                    },
                  },
                },
                else: null,
              },
            },
          },
        },
      ]);

      const question = questionData[0];

      if (!question) {
        return null;
      }

      const userIds = new Set<string>();

      if (question.userId) {
        userIds.add(question.userId.toString());
      }

      if (question.topAnswer?.userId) {
        userIds.add(question.topAnswer.userId.toString());
      }

      if (
        question.topAnswer?.replies &&
        Array.isArray(question.topAnswer.replies)
      ) {
        question.topAnswer.replies.forEach((r: any) => {
          if (r?.userId) userIds.add(r.userId.toString());
        });
      }

      const allUserIds = Array.from(userIds);

      if (allUserIds.length > 0) {
        const users = await loaders.userLoader.loadMany(allUserIds);
        const userMap = new Map();

        users.forEach((u: any) => {
          if (u && !u.error && u.id) {
            userMap.set(u.id.toString(), u);
          }
        });

        if (question.userId) {
          question.user = userMap.get(question.userId.toString());
        }

        if (question.topAnswer?.userId) {
          question.topAnswer.user = userMap.get(
            question.topAnswer.userId.toString(),
          );
        }

        if (
          question.topAnswer?.replies &&
          Array.isArray(question.topAnswer.replies)
        ) {
          question.topAnswer.replies = question.topAnswer.replies.map(
            (r: any) => ({
              ...r,
              user: r?.userId ? userMap.get(r.userId.toString()) : null,
            }),
          );
        }
      }

      await redisClient.set(
        `question:${id}`,
        JSON.stringify(question),
        "EX",
        60 * 15,
      );

      if (question.topAnswer && !question.topAnswer.id) {
        question.topAnswer = null;
      }

      return question;
    },

    loadMoreAnswers: async (
      _: any,
      {
        questionId,
        topAnswerId,
        skipCount = 0,
        limitCount = 10,
      }: {
        questionId: string;
        topAnswerId: string;
        skipCount: number;
        limitCount: number;
      },
      {
        user,
        loaders,
        redisClient,
      }: { user: any; loaders: any; redisClient: any },
    ) => {
      const cachedAnswers = await redisClient.get(
        `answers:${questionId}:${skipCount}`,
      );
      if (cachedAnswers) return JSON.parse(cachedAnswers);

      const matchStage: Record<string, any> = {
        questionId: new mongoose.Types.ObjectId(questionId),
        isDeleted: false,
        isActive: true,
      };

      if (topAnswerId)
        matchStage._id = { $ne: new mongoose.Types.ObjectId(topAnswerId) };

      const answers = await Answer.aggregate([
        {
          $match: matchStage,
        },

        {
          $lookup: {
            from: "replies",
            localField: "_id",
            foreignField: "answerId",
            as: "replies",
            pipeline: [{ $match: { isDeleted: false, isActive: true } }],
          },
        },
        {
          $addFields: {
            replyCount: { $size: "$replies" },
          },
        },

        {
          $lookup: {
            from: "votes",
            let: { answerId: "$_id" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$targetId", "$$answerId"] },
                      { $eq: ["$targetType", "answer"] },
                    ],
                  },
                },
              },
              {
                $group: {
                  _id: "$voteType",
                  count: { $sum: 1 },
                },
              },
            ],
            as: "votes",
          },
        },
        {
          $addFields: {
            upvotes: {
              $ifNull: [
                {
                  $let: {
                    vars: {
                      up: {
                        $arrayElemAt: [
                          {
                            $filter: {
                              input: "$votes",
                              cond: { $eq: ["$$this._id", "upvote"] },
                            },
                          },
                          0,
                        ],
                      },
                    },
                    in: "$$up.count",
                  },
                },
                0,
              ],
            },
            downvotes: {
              $ifNull: [
                {
                  $let: {
                    vars: {
                      down: {
                        $arrayElemAt: [
                          {
                            $filter: {
                              input: "$votes",
                              cond: { $eq: ["$$this._id", "downvote"] },
                            },
                          },
                          0,
                        ],
                      },
                    },
                    in: "$$down.count",
                  },
                },
                0,
              ],
            },
          },
        },

        {
          $addFields: {
            score: { $subtract: ["$upvotes", "$downvotes"] },
          },
        },

        {
          $sort: {
            score: -1,
            replyCount: -1,
            createdAt: -1,
          },
        },

        { $skip: skipCount },
        { $limit: limitCount },

        { $addFields: { id: "$_id" } },

        {
          $project: {
            id: 1,
            userId: 1,
            body: 1,
            replies: 1,
            replyCount: 1,
            isBestAnswerByAsker: 1,
            upvotes: 1,
            downvotes: 1,
            isDeleted: 1,
            isActive: 1,
            createdAt: 1,
          },
        },
      ]);

      const userIds = answers.map((a) => a.userId);
      const uniqueUserIds = [...new Set(userIds)];

      const users = await loaders.userLoader.loadMany(uniqueUserIds);

      const answersWithUsers = answers.map((a) => {
        let user = users.find((u: any) => u && u.id === a.userId);

        if (!user) {
          user = {
            id: a.userId,
            username: "Deleted User",
            email: "deleted@user.com",
            profilePictureUrl: null,
            bio: null,
            reputationPoints: 0,
            role: "USER",
            questionsAsked: 0,
            answersGiven: 0,
            bestAnswers: 0,
            achievements: [],
            status: "TERMINATED",
            isVerified: false,
            createdAt: new Date(0).toISOString(),
          };
        }

        return { ...a, user };
      });

      await redisClient.set(
        `answers:${questionId}:${skipCount}`,
        JSON.stringify(answersWithUsers),
        "EX",
        60 * 5,
      );

      return answersWithUsers;
    },
  },
};

export default questionResolvers;
