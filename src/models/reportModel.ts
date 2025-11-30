import mongoose from "mongoose";

const ReportSchema = new mongoose.Schema(
  {
    reportedBy: { type: String, required: true },
    targetId: { type: String, required: true },
    targetType: {
      type: String,
      required: true,
      enum: ["User", "Question", "Answer", "Reply"],
    },
    targetUserId: { type: String, required: true },

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
    aiConfidence: { type: Number, min: 0, max: 1, default: null },
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
    actionTaken: {
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
    adminReason: { type: String, maxlength: 150, minlength: 3, default: null },
  },
  { timestamps: true },
);

export default mongoose.model("Report", ReportSchema);
