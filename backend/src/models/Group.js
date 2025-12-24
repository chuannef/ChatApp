import mongoose from "mongoose";

const groupSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
    },
    avatar: {
      type: String,
      default: "",
    },
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    pendingJoinRequests: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    isPublic: {
      type: Boolean,
      default: true, // Public groups can be joined by anyone
    },
  },
  { timestamps: true }
);

// Ensure minimum 3 members (including admin) when creating
groupSchema.pre("save", function (next) {
  if (this.isNew && this.members.length < 3) {
    next(new Error("A group must have at least 3 members"));
  }
  next();
});

const Group = mongoose.model("Group", groupSchema);

export default Group;
