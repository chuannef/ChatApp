import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    kind: {
      type: String,
      enum: ["dm", "group"],
      required: true,
    },
    roomId: {
      type: String,
      required: true,
      index: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      default: null,
    },
    text: {
      type: String,
      required: false,
      trim: true,
      maxlength: 2000,
      default: "",
    },
    image: {
      // Data URL (e.g. data:image/png;base64,...) for MVP.
      type: String,
      default: "",
      maxlength: 1_000_000,
    },
  },
  { timestamps: true }
);

messageSchema.index({ roomId: 1, createdAt: 1 });

const Message = mongoose.model("Message", messageSchema);

export default Message;
