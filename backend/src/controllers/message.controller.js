import mongoose from "mongoose";

import Group from "../models/Group.js";
import Message from "../models/Message.js";
import User from "../models/User.js";

function dmRoomId(userIdA, userIdB) {
  const [a, b] = [userIdA, userIdB].map(String).sort();
  return `dm-${a}-${b}`;
}

function assertObjectId(id) {
  return mongoose.Types.ObjectId.isValid(String(id));
}

function stripBase64ProfilePic(doc) {
  if (!doc) return doc;
  const profilePic = doc.profilePic;
  if (typeof profilePic === "string" && profilePic.startsWith("data:image/")) {
    return { ...doc, profilePic: "" };
  }
  return doc;
}

export async function getDmMessages(req, res) {
  try {
    const myId = req.user.id;
    const { userId: otherUserId } = req.params;

    if (!assertObjectId(otherUserId)) {
      return res.status(400).json({ message: "Invalid user id" });
    }

    const otherUser = await User.findById(otherUserId).select("_id");
    if (!otherUser) {
      return res.status(404).json({ message: "User not found" });
    }

    const me = await User.findById(myId).select("friends");
    const isFriend = Array.isArray(me?.friends) && me.friends.some((id) => id.toString() === otherUserId);
    if (!isFriend) {
      return res.status(403).json({ message: "You can only chat with friends" });
    }

    const roomId = dmRoomId(myId, otherUserId);

    const messages = await Message.find({ kind: "dm", roomId })
      .sort({ createdAt: 1 })
      .populate("sender", "fullName profilePic")
      .lean();

    res.status(200).json({
      roomId,
      messages: messages.map((m) => ({ ...m, sender: stripBase64ProfilePic(m.sender) })),
    });
  } catch (error) {
    console.error("Error in getDmMessages controller:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function getGroupMessages(req, res) {
  try {
    const myId = req.user.id;
    const { groupId } = req.params;

    if (!assertObjectId(groupId)) {
      return res.status(400).json({ message: "Invalid group id" });
    }

    const group = await Group.findById(groupId).select("members").lean();
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    const isMember = Array.isArray(group.members) && group.members.some((id) => id.toString() === myId);
    if (!isMember) {
      return res.status(403).json({ message: "You are not a member of this group" });
    }

    const roomId = `group-${groupId}`;

    const messages = await Message.find({ kind: "group", roomId })
      .sort({ createdAt: 1 })
      .populate("sender", "fullName profilePic")
      .lean();

    res.status(200).json({
      roomId,
      messages: messages.map((m) => ({ ...m, sender: stripBase64ProfilePic(m.sender) })),
    });
  } catch (error) {
    console.error("Error in getGroupMessages controller:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}
