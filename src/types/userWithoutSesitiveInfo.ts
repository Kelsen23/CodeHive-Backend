import { Role, Status, Interest } from "../generated/prisma/index.js";

interface Achievment {
  id: string;
  userId: string;
  name: string;
  description: string;
  createdAt: string;
}

interface UserWithoutSensitiveInfo {
  id: string;
  username: string;
  email: string;
  profilePictureUrl?: string;
  bio?: string;
  interests: Interest[];
  reputationPoints: number;
  role: Role;
  questionsAsked: number;
  answersGiven: number;
  bestAnswers: number;
  achievments: Achievment[];
  status: Status;
  createdAt: string;
}

export default UserWithoutSensitiveInfo;
