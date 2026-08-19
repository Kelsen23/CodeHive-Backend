import mongoose, { Schema } from "mongoose";

const QuestionSparseEmbeddingSchema = new Schema(
  {
    questionId: {
      type: Schema.Types.ObjectId,
      ref: "Question",
      required: true,
    },
    version: { type: Number, required: true, min: 1 },

    indices: { type: [Number], required: true },
    values: { type: [Number], required: true },

    model: { type: String, required: true },
    representationVersion: { type: String, required: true },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      versionKey: false,
      transform: (_, ret: any) => {
        ret.id = ret._id;

        delete ret._id;

        return ret;
      },
    },
  },
);

QuestionSparseEmbeddingSchema.index(
  { questionId: 1, version: 1, model: 1, representationVersion: 1 },
  { unique: true },
);

export default mongoose.model(
  "QuestionSparseEmbedding",
  QuestionSparseEmbeddingSchema,
  "question_sparse_embeddings",
);
