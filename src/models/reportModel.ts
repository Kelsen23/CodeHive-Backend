import mongoose from "mongoose";

const ReportSchema = new mongoose.Schema(
  {
    reportedBy: { type: String, required: true },
    targetId: { type: String, required: true },
    targetUserId: { type: String, required: true },
    targetType: {
      type: String,
      required: true,
      enum: ["Question", "Answer", "Reply"],
    },

    reportReason: {
      type: String,
      required: true,
      enum: [
        "SPAM",
        "HARASSMENT",
        "HATE_SPEECH",
        "INAPPROPRIATE_CONTENT",
        "MISINFORMATION",
        "OTHER",
      ],
    },
    reportComment: {
      type: String,
      maxlength: 150,
      minlength: 3,
      default: null,
    },

    severity: { type: Number, min: 1, max: 100, default: 0 },
    aiDecisions: {
      type: [String],
      enum: [
        "REMOVE_CONTENT",
        "BAN_USER_TEMP",
        "BAN_USER_PERM",
        "IGNORE",
        "UNCERTAIN",
      ],
      default: ["UNCERTAIN"],
    },
    aiConfidence: { type: Number, min: 0, max: 1, default: 0 },
    aiReasons: {
      type: [String],
      minlength: 3,
      maxlength: 150,
      default: [],
    },

    status: {
      type: String,
      enum: ["PENDING", "REVIEWING", "RESOLVED", "DISMISSED"],
      default: "PENDING",
    },

    actionsTaken: {
      type: [String],
      enum: [
        "REMOVE_CONTENT",
        "BAN_USER_TEMP",
        "BAN_USER_PERM",
        "WARN_USER",
        "NO_ACTION",
      ],
      default: [],
    },
    adminReasons: [{ type: String, maxlength: 150, minlength: 3 }],
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

export default mongoose.model("Report", ReportSchema);
