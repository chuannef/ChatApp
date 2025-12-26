import Group from "../models/Group.js";
import User from "../models/User.js";
import GroupInvitation from "../models/GroupInvitation.js";

function stripBase64ProfilePic(doc) {
  if (!doc) return doc;

  const profilePic = doc.profilePic;
  if (typeof profilePic === "string" && profilePic.startsWith("data:image/")) {
    return { ...doc, profilePic: "" };
  }

  return doc;
}

function isAdmin(group, userId) {
  return group?.admin?.toString?.() === userId;
}

// Admin: invite a user to a group
export async function sendGroupInvitation(req, res) {
  try {
    const { id: groupId, userId: recipientId } = req.params;
    const senderId = req.user.id;

    if (!groupId || !recipientId) {
      return res.status(400).json({ message: "Group id and user id are required" });
    }

    if (String(senderId) === String(recipientId)) {
      return res.status(400).json({ message: "You can't invite yourself" });
    }

    const [group, recipient] = await Promise.all([
      Group.findById(groupId).select("admin members pendingJoinRequests"),
      User.findById(recipientId).select("_id"),
    ]);

    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    if (!isAdmin(group, senderId)) {
      return res.status(403).json({ message: "Only the admin can invite users" });
    }

    if (!recipient) {
      return res.status(404).json({ message: "Recipient not found" });
    }

    const isAlreadyMember = (group.members || []).some((m) => String(m) === String(recipientId));
    if (isAlreadyMember) {
      return res.status(400).json({ message: "User is already a member of this group" });
    }

    const existing = await GroupInvitation.findOne({
      group: groupId,
      recipient: recipientId,
      status: "pending",
    }).select("_id");

    if (existing) {
      return res.status(400).json({ message: "Invitation already sent" });
    }

    const invitation = await GroupInvitation.create({
      group: groupId,
      sender: senderId,
      recipient: recipientId,
    });

    res.status(201).json({ invitation });
  } catch (error) {
    // Duplicate key error due to unique pending index
    if (error?.code === 11000) {
      return res.status(400).json({ message: "Invitation already sent" });
    }

    console.error("Error in sendGroupInvitation controller:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

// Recipient: list my pending invitations (for Notifications)
export async function getMyGroupInvitations(req, res) {
  try {
    const userId = req.user.id;

    const invitations = await GroupInvitation.find({
      recipient: userId,
      status: "pending",
    })
      .populate("sender", "fullName profilePic")
      .populate("group", "name avatar")
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      invitations: invitations.map((inv) => ({
        ...inv,
        sender: stripBase64ProfilePic(inv.sender),
      })),
    });
  } catch (error) {
    console.error("Error in getMyGroupInvitations controller:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

// Recipient: accept invitation (join group)
export async function acceptGroupInvitation(req, res) {
  try {
    const { id: invitationId } = req.params;
    const userId = req.user.id;

    const invitation = await GroupInvitation.findById(invitationId);

    if (!invitation) {
      return res.status(404).json({ message: "Invitation not found" });
    }

    if (String(invitation.recipient) !== String(userId)) {
      return res.status(403).json({ message: "You are not authorized to accept this invitation" });
    }

    if (invitation.status !== "pending") {
      return res.status(400).json({ message: "Invitation is no longer pending" });
    }

    const group = await Group.findById(invitation.group);
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    const alreadyMember = (group.members || []).some((m) => String(m) === String(userId));
    if (!alreadyMember) {
      group.members = group.members || [];
      group.members.push(userId);
    }

    // If user previously requested to join, clear that request.
    if (Array.isArray(group.pendingJoinRequests)) {
      group.pendingJoinRequests = group.pendingJoinRequests.filter((u) => String(u) !== String(userId));
    }

    await Promise.all([
      group.save(),
      GroupInvitation.findByIdAndUpdate(invitationId, { status: "accepted" }),
    ]);

    res.status(200).json({ message: "Joined group" });
  } catch (error) {
    console.error("Error in acceptGroupInvitation controller:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

// Recipient: decline invitation
export async function declineGroupInvitation(req, res) {
  try {
    const { id: invitationId } = req.params;
    const userId = req.user.id;

    const invitation = await GroupInvitation.findById(invitationId);

    if (!invitation) {
      return res.status(404).json({ message: "Invitation not found" });
    }

    if (String(invitation.recipient) !== String(userId)) {
      return res.status(403).json({ message: "You are not authorized to decline this invitation" });
    }

    if (invitation.status !== "pending") {
      return res.status(400).json({ message: "Invitation is no longer pending" });
    }

    invitation.status = "declined";
    await invitation.save();

    res.status(200).json({ message: "Invitation declined" });
  } catch (error) {
    console.error("Error in declineGroupInvitation controller:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}
