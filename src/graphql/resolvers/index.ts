import { mergeResolvers } from "@graphql-tools/merge";

import userResolvers from "./userResolvers.js";
import questionResolvers from "./questionResolvers.js";

const resolvers = mergeResolvers([userResolvers, questionResolvers]);

export default resolvers;
