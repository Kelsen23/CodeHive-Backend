import { mergeTypeDefs } from "@graphql-tools/merge";

import userTypeDefs from "./userTypeDefs.js";
import questionTypeDefs from "./questionTypeDefs.js";

const typeDefs = mergeTypeDefs([userTypeDefs, questionTypeDefs]);

export default typeDefs;
