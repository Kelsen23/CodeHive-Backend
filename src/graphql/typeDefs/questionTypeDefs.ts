import { gql } from "graphql-tag";

const questionTypeDefs = gql`
  type Question {
    id: ID!
    userId: String!
    title: String!
    body: String!
    upvotes: Int!
    downvotes: Int!
    tags: [String]!
    answerCount: Int!
    isDeleted: Boolean!
    isActive: Boolean!
    createdAt: String!
    user: User!
  }

  type Reply {
    id: ID!
    userId: String!
    body: String!
    upvotes: Int!
    downvotes: Int!
    isActive: Boolean!
    isDeleted: Boolean!
    createdAt: String!
    user: User!
  }

  type Answer {
    id: ID!
    userId: String!
    body: String!
    upvotes: Int!
    downvotes: Int!
    replyCount: Int!
    replies: [Reply!]!
    isBestAnswerByAsker: Boolean!
    isActive: Boolean!
    isDeleted: Boolean!
    createdAt: String!
    user: User!
  }

  type QuestionDetails {
    id: ID!
    userId: String!
    title: String!
    body: String!
    tags: [String]!
    upvotes: Int!
    downvotes: Int!
    answerCount: Int!
    topAnswer: Answer
    isActive: Boolean!
    isDeleted: Boolean!
    createdAt: String!
    user: User!
  }

  type Query {
    getRecommendedQuestions(skipCount: Int, limitCount: Int): [Question!]!
    getQuestionById(id: ID!): QuestionDetails!
    loadMoreAnswers(
      questionId: ID!
      topAnswerId: ID
      skipCount: Int
      limitCount: Int
    ): [Answer!]!
    loadMoreReplies(answerId: Int!, skipCount: Int, limitCount: Int): [Reply!]!
  }
`;

export default questionTypeDefs;
