import { gql } from "graphql-tag";

const questionTypeDefs = gql`
  type Question {
    id: ID!
    userId: String!
    title: String!
    body: String!
    tags: [String]!
    isDeleted: Boolean!
    isActive: Boolean!
    createdAt: String!
    user: User!
  }

  type Query {
    getRecommendedQuestions(skipCount: Int): [Question!]!
  }
`;

export default questionTypeDefs;
