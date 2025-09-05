import { mergeTypeDefs } from "@graphql-tools/merge";
import userTypeDefs from "./userTypeDefs.js";

const typeDefs = mergeTypeDefs([userTypeDefs]);

export default typeDefs;
