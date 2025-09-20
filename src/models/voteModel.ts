import mongoose, { Schema } from "mongoose";

const VoteSchema = new Schema(
  {
    userId: { type: String, required: true },
    targetType: { type: String, enum: ["Question", "Answer", "Reply"], required: true },
    targetId: { type: Schema.Types.ObjectId, required: true },
    voteType: { type: String, enum: ["upvote", "downvote"], required: true },
  },
  { timestamps: true },
);

export default mongoose.model("Vote", VoteSchema);
