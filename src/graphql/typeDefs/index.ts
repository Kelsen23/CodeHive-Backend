import { mergeTypeDefs } from "@graphql-tools/merge";
import userTypeDefs from "./userTypedefs.js";

const typeDefs = mergeTypeDefs([userTypeDefs]);

export default typeDefs;
