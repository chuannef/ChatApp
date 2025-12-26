import mongoose from "mongoose";

const groupInvitationSchema = new mongoose.Schema(
  {
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      required: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "declined"],
      default: "pending",
      index: true,
    },
  },
  { timestamps: true }
);

// Only one pending invitation per (group, recipient)
groupInvitationSchema.index(
  { group: 1, recipient: 1 },
  {
    unique: true,
    partialFilterExpression: { status: "pending" },
  }
);

groupInvitationSchema.index({ recipient: 1, status: 1, createdAt: -1 });

groupInvitationSchema.set("toJSON", { virtuals: true });
groupInvitationSchema.set("toObject", { virtuals: true });

const GroupInvitation = mongoose.model("GroupInvitation", groupInvitationSchema);

export default GroupInvitation;
