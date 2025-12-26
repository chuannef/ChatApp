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

// Ensure the group always has an admin as a member.
groupSchema.pre("save", function (next) {
  if (this.admin && Array.isArray(this.members)) {
    const adminId = this.admin.toString();
    const hasAdmin = this.members.some((m) => m?.toString?.() === adminId);
    if (!hasAdmin) {
      this.members.unshift(this.admin);
    }
  }
  next();
});

const Group = mongoose.model("Group", groupSchema);

export default Group;
