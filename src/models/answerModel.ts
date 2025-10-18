import mongoose, { Schema } from "mongoose";

const AnswerSchema: Schema = new Schema(
  {
    questionId: {
      type: Schema.Types.ObjectId,
      ref: "Question",
      required: true,
    },
    userId: { type: String, required: true },
    body: { type: String, required: true, maxlength: 5000 },
    isBestAnswerByAsker: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export default mongoose.model("Answer", AnswerSchema);
