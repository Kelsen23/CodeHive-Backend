import mongoose from "mongoose";

import Question from "../../models/questionModel.js";
import Answer from "../../models/answerModel.js";
import Reply from "../../models/replyModel.js";

import UserWithoutSensitiveInfo from "../../types/userWithoutSensitiveInfo.js";

import HttpError from "../../utils/httpError.js";
import interests from "../../utils/interests.js";

interface SearchQuestionStage {
  $search: {
    index: string;
    compound: {
      must: any[];
      should?: any[];
      minimumShouldMatch?: number;
    };
  };
}

const questionResolvers = {
  Query: {
    getRecommendedQuestions: async (
      _: any,
      {
        skipCount = 0,
        limitCount = 10,
      }: { skipCount: number; limitCount: number },
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

      const searchStage = interests.length
        ? ({
            $search: {
              index: "recommended_index",
              compound: {
                should: interests.map((interest) => ({
                  text: {
                    query: interest,
                    path: ["title", "body", "tags"],
                    fuzzy: { maxEdits: 1, prefixLength: 2 },
                  },
                })),
                minimumShouldMatch: 1,
              },
            },
          } as any)
        : null;

      const pipeline: any[] = [];

      if (searchStage) pipeline.push(searchStage);

      pipeline.push(
        {
          $match: {
            isDeleted: false,
            isActive: true,
          },
        },
        {
          $sort: {
            upvoteCount: -1,
            createdAt: -1,
          } as any,
        },

        { $skip: skipCount },
        { $limit: limitCount },

        {
          $project: {
            id: "$_id",
            title: 1,
            body: 1,
            tags: 1,
            userId: 1,
            upvotes: "$upvoteCount",
            downvotes: "$downvoteCount",
            answerCount: 1,
            isDeleted: 1,
            isActive: 1,
            createdAt: 1,
          },
        },
      );

      const questions = await Question.aggregate(pipeline);

      const uniqueUserIds = [...new Set(questions.map((q) => q.userId))];

      const users = await loaders.userLoader.loadMany(uniqueUserIds);

      const userMap = new Map(users.map((u: any) => [u?.id, u]));

      const questionsWithUsers = questions.map((q) => {
        let user = userMap.get(q.userId);

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
                              sortBy: { upvoteCount: -1, createdAt: 1 },
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
              { $sort: { upvoteCount: -1, createdAt: 1 } },
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
            upvotes: "$upvoteCount",
            downvotes: "$downvoteCount",
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
                  upvotes: "$topAnswer.upvoteCount",
                  downvotes: "$topAnswer.downvoteCount",
                  isBestAnswerByAsker: "$topAnswer.isBestAnswerByAsker",
                  isActive: "$topAnswer.isActive",
                  isDeleted: "$topAnswer.isDeleted",
                  createdAt: "$topAnswer.createdAt",
                  replyCount: "$topAnswer.replyCount",
                  replies: {
                    $map: {
                      input: "$topReplies",
                      as: "reply",
                      in: {
                        id: "$$reply._id",
                        userId: "$$reply.userId",
                        body: "$$reply.body",
                        upvotes: "$$reply.upvoteCount",
                        downvotes: "$$reply.downvoteCount",
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
          $addFields: {
            score: { $subtract: ["$upvoteCount", "$downvoteCount"] },
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

        {
          $project: {
            id: "$_id",
            userId: 1,
            body: 1,
            replies: [],
            replyCount: 1,
            isBestAnswerByAsker: 1,
            upvotes: "$upvoteCount",
            downvotes: "$downvoteCount",
            isDeleted: 1,
            isActive: 1,
            createdAt: 1,
          },
        },
      ]);

      const uniqueUserIds = [...new Set(answers.map((a) => a.userId))];

      const users = await loaders.userLoader.loadMany(uniqueUserIds);

      const userMap = new Map(users.map((u: any) => [u?.id, u]));

      const answersWithUsers = answers.map((a) => {
        let user = userMap.get(a.userId);

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

    loadMoreReplies: async (
      _: any,
      {
        answerId,
        skipCount = 0,
        limitCount = 10,
      }: { answerId: string; skipCount: number; limitCount: number },
      {
        user,
        loaders,
        redisClient,
      }: { user: any; loaders: any; redisClient: any },
    ) => {
      const cachedReplies = await redisClient.get(
        `replies:${answerId}:${skipCount}`,
      );

      if (cachedReplies) return JSON.parse(cachedReplies);

      const replies = await Reply.aggregate([
        {
          $match: {
            answerId: new mongoose.Types.ObjectId(answerId),
            isDeleted: false,
            isActive: true,
          },
        },

        {
          $addFields: {
            score: { $subtract: ["$upvoteCount", "$downvoteCount"] },
          },
        },

        {
          $sort: {
            score: -1,
            createdAt: -1,
          },
        },

        { $skip: skipCount },
        { $limit: limitCount },

        {
          $project: {
            id: "$_id",
            userId: 1,
            body: 1,
            upvotes: "$upvoteCount",
            downvotes: "$downvoteCount",
            isActive: 1,
            isDeleted: 1,
            createdAt: 1,
          },
        },
      ]);

      const uniqueUserIds = [...new Set(replies.map((a) => a.userId))];

      const users = await loaders.userLoader.loadMany(uniqueUserIds);

      const userMap = new Map(users.map((u: any) => [u?.id, u]));

      const repliesWithUsers = replies.map((r) => {
        let user = userMap.get(r.userId);

        if (!user) {
          user = {
            id: r.userId,
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

        return { ...r, user };
      });

      await redisClient.set(
        `replies:${answerId}:${skipCount}`,
        JSON.stringify(repliesWithUsers),
        "EX",
        5 * 60,
      );

      return repliesWithUsers;
    },

    getSearchSuggestions: async (
      _: any,
      {
        searchKeyword,
        limitCount = 10,
      }: { searchKeyword: string; limitCount: number },
      { redisClient }: { redisClient: any },
    ) => {
      const cachedSuggestions = await redisClient.get(
        `searchSuggestions:${searchKeyword}`,
      );

      if (cachedSuggestions) return JSON.parse(cachedSuggestions);

      const results = await Question.aggregate([
        {
          $search: {
            index: "questions_autocomplete",
            autocomplete: {
              query: searchKeyword,
              path: "title",
              fuzzy: { maxEdits: 1 },
            },
          },
        },

        {
          $group: {
            _id: "$title",
            title: { $first: "$title" },
          },
        },

        { $limit: limitCount },

        { $project: { _id: 0, title: 1 } },
      ]);

      const suggestions = results.map((r) => r.title);

      await redisClient.set(
        `searchSuggestions:${searchKeyword}`,
        JSON.stringify(suggestions),
        "EX",
        60 * 60,
      );

      return suggestions;
    },

    searchQuestions: async (
      _: any,
      {
        searchKeyword,
        tags,
        sortOption,
        skipCount = 0,
        limitCount = 15,
      }: {
        searchKeyword: string;
        limitCount: number;
        tags: string[];
        sortOption: string;
        skipCount: number;
      },
      { redisClient, loaders }: { redisClient: any; loaders: any },
    ) => {
      if (!["LATEST", "INTERACTED"].includes(sortOption))
        throw new HttpError(
          `Invalid sort option. Allowed values: ${["LATEST", "INTERACTED"].join(", ")}`,
          400,
        );

      const invalidTags = tags.filter((tag) => !interests.includes(tag));

      if (invalidTags.length > 0)
        throw new HttpError(`Invalid tags: ${invalidTags.join(", ")}`, 400);

      const cachedQuestions = await redisClient.get(
        `searchQuestions:${searchKeyword}:${tags.sort().join(", ")}:${sortOption}:${skipCount}`,
      );

      if (cachedQuestions) return JSON.parse(cachedQuestions);

      const sortMapping: Record<string, any> = {
        LATEST: { createdAt: -1 },
        INTERACTED: { answerCount: -1, upvoteCount: -1, downvoteCount: -1 },
      };

      const searchStage: SearchQuestionStage = {
        $search: {
          index: "search_index",
          compound: {
            must: [
              {
                text: {
                  query: searchKeyword,
                  path: ["title", "body"],
                  fuzzy: { maxEdits: 1, prefixLength: 2 },
                },
              },
            ],
          },
        },
      };

      if (tags.length > 0) {
        searchStage.$search.compound.should = tags.map((tag) => ({
          text: {
            query: tag,
            path: ["title", "body", "tags"],
            fuzzy: { maxEdits: 1, prefixLength: 2 },
          },
        }));

        searchStage.$search.compound.minimumShouldMatch = 1;
      }

      const questions = await Question.aggregate([
        searchStage,

        { $match: { isDeleted: false, isActive: true } },

        { $sort: sortMapping[sortOption] },
        { $skip: skipCount },
        { $limit: limitCount },

        {
          $project: {
            id: "$_id",
            title: 1,
            body: 1,
            tags: 1,
            userId: 1,
            upvotes: "$upvoteCount",
            downvotes: "$downvoteCount",
            answerCount: 1,
            isDeleted: 1,
            isActive: 1,
            createdAt: 1,
          },
        },
      ]);

      const uniqueUserIds = [...new Set(questions.map((q) => q.userId))];

      const users = await loaders.userLoader.loadMany(uniqueUserIds);

      const userMap = new Map(users.map((u: any) => [u?.id, u]));

      const questionsWithUsers = questions.map((q) => {
        let user = userMap.get(q.userId);

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
        `searchQuestions:${searchKeyword}:${tags.sort().join(", ")}:${sortOption}:${skipCount}`,
        JSON.stringify(questionsWithUsers),
        "EX",
        60 * 15,
      );

      return questionsWithUsers;
    },
  },
};

export default questionResolvers;
