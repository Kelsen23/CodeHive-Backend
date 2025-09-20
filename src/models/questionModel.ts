import mongoose, { Schema } from "mongoose";

const QuestionSchema: Schema = new Schema(
  {
    userId: { type: String, required: true },
    title: { type: String, required: true, maxlength: 200 },
    body: { type: String, required: true, maxlength: 5000 },
    tags: { type: [String], default: [] },
    isDeleted: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export default mongoose.model("Question", QuestionSchema);
