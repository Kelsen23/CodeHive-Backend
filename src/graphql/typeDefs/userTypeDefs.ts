import { gql } from "graphql-tag";

const userTypeDefs = gql`
  enum Role {
    ADMIN
    MOD
    USER
  }
  
  type Achievment {
    id: ID!
    userId: String!
    name: String!
    description: String!
    createdAt: String!
  }

  type User {
    id: ID!
    username: String!
    email: String!
    profilePictureUrl: String
    bio: String
    reputationPoints: Int!
    role: Role!
    questionsAsked: Int!
    answersGiven: Int!
    bestAnswers: Int!
    achievments: [Achievment!]!
    status: String!
    isVerified: Boolean!
    createdAt: String!
  }

  type Query {
    getUserById(id: ID!): User
  }
`;

export default userTypeDefs;
