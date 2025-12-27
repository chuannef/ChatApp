import { Server } from "socket.io";
import cookie from "cookie";
import jwt from "jsonwebtoken";

import Group from "./models/Group.js";
import Message from "./models/Message.js";
import User from "./models/User.js";
import mongoose from "mongoose";

function dmRoomId(userIdA, userIdB) {
  const [a, b] = [userIdA, userIdB].map(String).sort();
  return `dm-${a}-${b}`;
}

function isDev() {
  return process.env.NODE_ENV !== "production";
}

function stripBase64SenderAvatar(messageDoc) {
  try {
    const sender = messageDoc?.sender;
    const profilePic = sender?.profilePic;
    if (typeof profilePic === "string" && profilePic.startsWith("data:image/")) {
      sender.profilePic = "";
    }
  } catch {
    // ignore
  }
}

const MAX_ATTACHMENT_BYTES = 100 * 1024 * 1024; // 100MB

function normalizeAttachment(raw) {
  if (!raw || typeof raw !== "object") return null;

  const url = typeof raw.url === "string" ? raw.url.trim() : "";
  const path = typeof raw.path === "string" ? raw.path.trim() : "";
  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  const type = typeof raw.type === "string" ? raw.type.trim() : "";
  const size = typeof raw.size === "number" ? raw.size : Number(raw.size);
  const kind = typeof raw.kind === "string" ? raw.kind : "file";

  const normalizedKind = ["file", "folder", "image"].includes(kind) ? kind : "file";
  const normalizedSize = Number.isFinite(size) ? size : 0;

  if (!url) return null;
  if (normalizedSize <= 0 || normalizedSize > MAX_ATTACHMENT_BYTES) return null;

  // Only allow our own uploads path or absolute URLs.
  // (We store what the upload endpoint returns; it uses /uploads/chat/*)
  const allowed = url.startsWith("/uploads/chat/") || /^https?:\/\//i.test(url);
  if (!allowed) return null;

  return {
    url,
    path: path || "",
    name: name || "",
    size: normalizedSize,
    type: type || "",
    kind: normalizedKind,
  };
}

export function initSocket(httpServer, allowedOrigins = []) {
  const io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);

        if (isDev()) {
          if (origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:")) {
            return callback(null, true);
          }
        }

        if (allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        return callback(new Error("Not allowed by CORS"));
      },
      credentials: true,
    },
  });

  io.use(async (socket, next) => {
    try {
      const cookieHeader = socket.handshake.headers?.cookie;
      if (!cookieHeader) return next(new Error("Unauthorized"));

      const parsed = cookie.parse(cookieHeader);
      const token = parsed.jwt;
      if (!token) return next(new Error("Unauthorized"));

      const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
      if (!decoded?.userId) return next(new Error("Unauthorized"));

      const user = await User.findById(decoded.userId).select("-password");
      if (!user) return next(new Error("Unauthorized"));

      socket.user = user;
      next();
    } catch (err) {
      next(new Error("Unauthorized"));
    }
  });

  // Presence tracking: userId -> Set(socketId)
  const userSockets = new Map();

  function computeOnlineUserIds() {
    return Array.from(userSockets.entries())
      .filter(([, sockets]) => sockets && sockets.size > 0)
      .map(([userId]) => String(userId));
  }

  function broadcastPresence() {
    io.emit("presence:onlineUsers", { userIds: computeOnlineUserIds() });
  }

  io.on("connection", (socket) => {
    // Mark user as online
    try {
      const userId = String(socket.user?.id || "");
      if (userId) {
        const existing = userSockets.get(userId) || new Set();
        existing.add(socket.id);
        userSockets.set(userId, existing);
        broadcastPresence();
      }
    } catch {
      // ignore
    }

    // Send initial presence snapshot to the connecting client
    socket.emit("presence:onlineUsers", { userIds: computeOnlineUserIds() });

    socket.on("disconnect", () => {
      try {
        const userId = String(socket.user?.id || "");
        if (!userId) return;

        const sockets = userSockets.get(userId);
        if (!sockets) return;

        sockets.delete(socket.id);
        if (sockets.size === 0) {
          userSockets.delete(userId);
        } else {
          userSockets.set(userId, sockets);
        }

        broadcastPresence();
      } catch {
        // ignore
      }
    });

    socket.on("dm:join", async ({ otherUserId } = {}, ack) => {
      try {
        const myId = socket.user.id;

        const otherUser = await User.findById(otherUserId).select("_id");
        if (!otherUser) {
          return typeof ack === "function" ? ack({ ok: false, message: "User not found" }) : undefined;
        }

        const me = await User.findById(myId).select("friends");
        const isFriend = Array.isArray(me?.friends) && me.friends.some((id) => id.toString() === String(otherUserId));
        if (!isFriend) {
          return typeof ack === "function" ? ack({ ok: false, message: "You can only chat with friends" }) : undefined;
        }

        const roomId = dmRoomId(myId, otherUserId);
        socket.join(roomId);

        return typeof ack === "function" ? ack({ ok: true, roomId }) : undefined;
      } catch (e) {
        return typeof ack === "function" ? ack({ ok: false, message: "Failed to join chat" }) : undefined;
      }
    });

    socket.on("group:join", async ({ groupId } = {}, ack) => {
      try {
        const myId = socket.user.id;

        const group = await Group.findById(groupId).select("members");
        if (!group) {
          return typeof ack === "function" ? ack({ ok: false, message: "Group not found" }) : undefined;
        }

        const isMember = Array.isArray(group.members) && group.members.some((id) => id.toString() === myId);
        if (!isMember) {
          return typeof ack === "function" ? ack({ ok: false, message: "You are not a member of this group" }) : undefined;
        }

        const roomId = `group-${groupId}`;
        socket.join(roomId);

        return typeof ack === "function" ? ack({ ok: true, roomId }) : undefined;
      } catch (e) {
        return typeof ack === "function" ? ack({ ok: false, message: "Failed to join group" }) : undefined;
      }
    });

    socket.on("message:send", async ({ kind, otherUserId, groupId, text, image, attachment } = {}, ack) => {
      try {
        const myId = socket.user.id;
        const trimmed = String(text || "").trim();
        const imageStr = typeof image === "string" ? image : "";

        const normalizedAttachment = normalizeAttachment(attachment);

        const hasText = Boolean(trimmed);
        const hasImage = Boolean(imageStr);
        const hasAttachment = Boolean(normalizedAttachment);

        if (!hasText && !hasImage && !hasAttachment) {
          return typeof ack === "function" ? ack({ ok: false, message: "Message is empty" }) : undefined;
        }

        if (hasImage) {
          if (!imageStr.startsWith("data:image/")) {
            return typeof ack === "function" ? ack({ ok: false, message: "Invalid image format" }) : undefined;
          }

          // Very basic size check. This is a data URL, so length ~= bytes * 1.37.
          if (imageStr.length > 1_000_000) {
            return typeof ack === "function" ? ack({ ok: false, message: "Image is too large" }) : undefined;
          }
        }

        if (attachment && !hasAttachment) {
          return typeof ack === "function" ? ack({ ok: false, message: "File is too large (max 100MB)" }) : undefined;
        }

        if (kind === "dm") {
          const otherUser = await User.findById(otherUserId).select("_id");
          if (!otherUser) {
            return typeof ack === "function" ? ack({ ok: false, message: "User not found" }) : undefined;
          }

          const me = await User.findById(myId).select("friends");
          const isFriend = Array.isArray(me?.friends) && me.friends.some((id) => id.toString() === String(otherUserId));
          if (!isFriend) {
            return typeof ack === "function" ? ack({ ok: false, message: "You can only chat with friends" }) : undefined;
          }

          const roomId = dmRoomId(myId, otherUserId);

          const message = await Message.create({
            kind: "dm",
            roomId,
            sender: myId,
            recipient: otherUserId,
            text: trimmed,
            image: imageStr,
            attachment: normalizedAttachment || undefined,
          });

          const populated = await message.populate("sender", "fullName profilePic");
          stripBase64SenderAvatar(populated);

          io.to(roomId).emit("message:new", { roomId, message: populated });
          return typeof ack === "function" ? ack({ ok: true, roomId }) : undefined;
        }

        if (kind === "group") {
          const group = await Group.findById(groupId).select("members");
          if (!group) {
            return typeof ack === "function" ? ack({ ok: false, message: "Group not found" }) : undefined;
          }

          const isMember = Array.isArray(group.members) && group.members.some((id) => id.toString() === myId);
          if (!isMember) {
            return typeof ack === "function" ? ack({ ok: false, message: "You are not a member of this group" }) : undefined;
          }

          const roomId = `group-${groupId}`;

          const message = await Message.create({
            kind: "group",
            roomId,
            sender: myId,
            group: groupId,
            text: trimmed,
            image: imageStr,
            attachment: normalizedAttachment || undefined,
          });

          const populated = await message.populate("sender", "fullName profilePic");
          stripBase64SenderAvatar(populated);

          io.to(roomId).emit("message:new", { roomId, message: populated });
          return typeof ack === "function" ? ack({ ok: true, roomId }) : undefined;
        }

        return typeof ack === "function" ? ack({ ok: false, message: "Invalid message kind" }) : undefined;
      } catch (e) {
        return typeof ack === "function" ? ack({ ok: false, message: "Failed to send message" }) : undefined;
      }
    });

    socket.on("message:delete", async ({ messageId } = {}, ack) => {
      try {
        const myId = socket.user.id;

        if (!mongoose.Types.ObjectId.isValid(String(messageId))) {
          return typeof ack === "function" ? ack({ ok: false, message: "Invalid message id" }) : undefined;
        }

        const message = await Message.findById(messageId).select("kind roomId sender group").lean();
        if (!message) {
          return typeof ack === "function" ? ack({ ok: false, message: "Message not found" }) : undefined;
        }

        const isSender = String(message.sender) === String(myId);

        if (message.kind === "group") {
          if (!isSender) {
            const group = await Group.findById(message.group).select("admin").lean();
            const isGroupAdmin = String(group?.admin || "") === String(myId);
            if (!isGroupAdmin) {
              return typeof ack === "function" ? ack({ ok: false, message: "Not allowed" }) : undefined;
            }
          }
        } else {
          // dm: only sender can delete
          if (!isSender) {
            return typeof ack === "function" ? ack({ ok: false, message: "Not allowed" }) : undefined;
          }
        }

        await Message.deleteOne({ _id: messageId });

        io.to(message.roomId).emit("message:deleted", { roomId: message.roomId, messageId: String(messageId) });
        return typeof ack === "function" ? ack({ ok: true }) : undefined;
      } catch (e) {
        return typeof ack === "function" ? ack({ ok: false, message: "Failed to delete message" }) : undefined;
      }
    });

    socket.on("message:edit", async ({ messageId, text } = {}, ack) => {
      try {
        const myId = socket.user.id;

        if (!mongoose.Types.ObjectId.isValid(String(messageId))) {
          return typeof ack === "function" ? ack({ ok: false, message: "Invalid message id" }) : undefined;
        }

        const trimmed = String(text || "").trim();
        if (!trimmed) {
          return typeof ack === "function" ? ack({ ok: false, message: "Message is empty" }) : undefined;
        }
        if (trimmed.length > 2000) {
          return typeof ack === "function" ? ack({ ok: false, message: "Message is too long" }) : undefined;
        }

        const existing = await Message.findById(messageId).select("kind roomId sender group").lean();
        if (!existing) {
          return typeof ack === "function" ? ack({ ok: false, message: "Message not found" }) : undefined;
        }

        // Only the sender can edit their message (MVP).
        const isSender = String(existing.sender) === String(myId);
        if (!isSender) {
          return typeof ack === "function" ? ack({ ok: false, message: "Not allowed" }) : undefined;
        }

        if (existing.kind === "group") {
          const group = await Group.findById(existing.group).select("members admin").lean();
          const isMember = Array.isArray(group?.members) && group.members.some((id) => id.toString() === String(myId));
          const isGroupAdmin = String(group?.admin || "") === String(myId);
          if (!isMember && !isGroupAdmin) {
            return typeof ack === "function" ? ack({ ok: false, message: "Not allowed" }) : undefined;
          }
        }

        const updated = await Message.findByIdAndUpdate(
          messageId,
          { text: trimmed },
          { new: true, runValidators: true }
        ).populate("sender", "fullName profilePic");

        if (!updated) {
          return typeof ack === "function" ? ack({ ok: false, message: "Message not found" }) : undefined;
        }

        stripBase64SenderAvatar(updated);

        io.to(existing.roomId).emit("message:updated", { roomId: existing.roomId, message: updated });
        return typeof ack === "function" ? ack({ ok: true }) : undefined;
      } catch (e) {
        return typeof ack === "function" ? ack({ ok: false, message: "Failed to edit message" }) : undefined;
      }
    });
  });

  return io;
}
