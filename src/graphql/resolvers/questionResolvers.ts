import HttpError from "../../utils/httpError.js";

import Question from "../../models/questionModel.js";
import Vote from "../../models/voteModel.js";

import UserWithoutSensitiveInfo from "../../types/userWithoutSesitiveInfo.js";

import mongoose from "mongoose";

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

        { $addFields: { answerCount: { $size: "$answers" } } },

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
              $let: {
                vars: {
                  filteredTop: {
                    $filter: {
                      input: "$answers",
                      as: "a",
                      cond: { $eq: ["$$a.isTopAnswer", true] },
                    },
                  },
                },
                in: {
                  $cond: {
                    if: { $gt: [{ $size: "$$filteredTop" }, 0] },
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

        {
          $lookup: {
            from: "replys",
            let: { topAnswerId: "$topAnswer._id" },
            pipeline: [
              { $match: { $expr: { $eq: ["$answerId", "$$topAnswerId"] } } },
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
              { $limit: 1 },
            ],
            as: "topAnswer.replies",
          },
        },

        {
          $project: {
            _id: 1,
            title: 1,
            body: 1,
            tags: 1,
            upvotes: 1,
            downvotes: 1,
            isDeleted: 1,
            isActive: 1,
            createdAt: 1,
            topAnswer: 1,
            answers: 1,
            answerCount: 1,
            askerId: 1,
          },
        },
      ]);

      const question = questionData[0];

      const questionUserIds = [question.askerId];
      const answerUserIds = question.answers.map((a: any) => a.userId);
      const replyUserIds =
        question.topAnswer?.replies.map((r: any) => r.userId) || [];

      const allUserIds = [
        ...new Set([...questionUserIds, ...answerUserIds, ...replyUserIds]),
      ];

      const users = await loaders.userLoader.loadMany(allUserIds);
      const userMap = new Map();
      users.forEach((u: any) => userMap.set(u.id.toString(), u));

      question.user = userMap.get(question.askerId.toString());
      question.answers = question.answers.map((a: any) => ({
        ...a,
        user: userMap.get(a.userId.toString()),
      }));

      if (question.topAnswer) {
        question.topAnswer.replies = question.topAnswer.replies.map(
          (r: any) => ({
            ...r,
            user: userMap.get(r.userId.toString()),
          }),
        );
      }

      await redisClient.set(
        `question:${id}`,
        JSON.stringify(question),
        "EX",
        60 * 15,
      );

      return question;
    },
  },
};

export default questionResolvers;
