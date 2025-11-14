import mongoose, { Schema } from "mongoose";

const ReplySchema: Schema = new Schema(
  {
    answerId: { type: Schema.Types.ObjectId, ref: "Answer", required: true },
    userId: { type: String, required: true },
    body: { type: String, required: true, maxLength: 2000 },
    isDeleted: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      versionKeys: false,
      transform: (_, ret: any) => {
        ret.id = ret._id;
        delete ret._id;
        return ret;
      },
    },
  },
);

export default mongoose.model("Reply", ReplySchema);
