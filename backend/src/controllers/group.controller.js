import Group from "../models/Group.js";
import User from "../models/User.js";

function stripBase64ProfilePic(doc) {
  if (!doc) return doc;

  const profilePic = doc.profilePic;
  if (typeof profilePic === "string" && profilePic.startsWith("data:image/")) {
    return { ...doc, profilePic: "" };
  }

  return doc;
}

function stripBase64InGroup(group) {
  if (!group) return group;

  return {
    ...group,
    admin: stripBase64ProfilePic(group.admin),
    members: Array.isArray(group.members)
      ? group.members.map(stripBase64ProfilePic)
      : group.members,
    pendingJoinRequests: Array.isArray(group.pendingJoinRequests)
      ? group.pendingJoinRequests.map(stripBase64ProfilePic)
      : group.pendingJoinRequests,
  };
}

function isAdmin(group, userId) {
  return group?.admin?.toString?.() === userId;
}

// Create a new group (requires at least 3 members including creator)
export async function createGroup(req, res) {
  try {
    const { name, description, memberIds } = req.body;
    const adminId = req.user.id;

    if (!name || !memberIds || !Array.isArray(memberIds)) {
      return res.status(400).json({ message: "Group name and member IDs are required" });
    }

    // Add admin to members if not already included
    const allMemberIds = [...new Set([adminId, ...memberIds])];

    // Check minimum 3 members
    if (allMemberIds.length < 3) {
      return res.status(400).json({ 
        message: "A group must have at least 3 members (including you)" 
      });
    }

    // Verify all members exist
    const membersExist = await User.countDocuments({
      _id: { $in: allMemberIds },
    });

    if (membersExist !== allMemberIds.length) {
      return res.status(400).json({ message: "One or more members not found" });
    }

    const group = await Group.create({
      name,
      description: description || "",
      admin: adminId,
      members: allMemberIds,
    });

    const populatedGroup = await Group.findById(group._id)
      .populate("admin", "fullName profilePic")
      .populate("members", "fullName profilePic");

    res.status(201).json(stripBase64InGroup(populatedGroup));
  } catch (error) {
    console.error("Error in createGroup controller:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

// Get all groups the current user is a member of
export async function getMyGroups(req, res) {
  try {
    const userId = req.user.id;

    const groups = await Group.find({ members: userId })
      .populate("admin", "fullName profilePic")
      .populate("members", "fullName profilePic")
      .sort({ updatedAt: -1 })
      .lean();

    res.status(200).json(groups.map(stripBase64InGroup));
  } catch (error) {
    console.error("Error in getMyGroups controller:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

// Get all public groups user can join
export async function getAvailableGroups(req, res) {
  try {
    const userId = req.user.id;

    const groups = await Group.find({
      isPublic: true,
      members: { $nin: [userId] }, // Not a member
    })
      .populate("admin", "fullName profilePic")
      .populate("members", "fullName profilePic")
      .sort({ createdAt: -1 })
      .lean();

    const result = groups.map((g) => {
      const hasPendingJoinRequest = Array.isArray(g.pendingJoinRequests)
        ? g.pendingJoinRequests.some((id) => id.toString() === userId)
        : false;

      const base = stripBase64InGroup(g);
      delete base.pendingJoinRequests;

      return {
        ...base,
        hasPendingJoinRequest,
      };
    });

    res.status(200).json(result);
  } catch (error) {
    console.error("Error in getAvailableGroups controller:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

// Request to join a group (requires admin approval)
export async function joinGroup(req, res) {
  try {
    const { id: groupId } = req.params;
    const userId = req.user.id;

    const group = await Group.findById(groupId);

    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    if (group.members.includes(userId)) {
      return res.status(400).json({ message: "You are already a member of this group" });
    }

    if (Array.isArray(group.pendingJoinRequests) && group.pendingJoinRequests.includes(userId)) {
      return res.status(400).json({ message: "Join request already sent" });
    }

    group.pendingJoinRequests = group.pendingJoinRequests || [];
    group.pendingJoinRequests.push(userId);
    await group.save();

    res.status(200).json({ message: "Join request sent. Waiting for admin approval." });
  } catch (error) {
    console.error("Error in joinGroup controller:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

// Leave a group
export async function leaveGroup(req, res) {
  try {
    const { id: groupId } = req.params;
    const userId = req.user.id;

    const group = await Group.findById(groupId);

    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    if (!group.members.includes(userId)) {
      return res.status(400).json({ message: "You are not a member of this group" });
    }

    // Admin cannot leave, must transfer ownership first or delete group
    if (group.admin.toString() === userId) {
      return res.status(400).json({ 
        message: "Admin cannot leave the group. Transfer ownership or delete the group." 
      });
    }

    group.members = group.members.filter(
      (memberId) => memberId.toString() !== userId
    );
    await group.save();

    res.status(200).json({ message: "Left group successfully" });
  } catch (error) {
    console.error("Error in leaveGroup controller:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

// Get group details
export async function getGroupById(req, res) {
  try {
    const { id: groupId } = req.params;

    const userId = req.user.id;

    const group = await Group.findById(groupId)
      .populate("admin", "fullName profilePic")
      .populate("members", "fullName profilePic nativeLanguage learningLanguage")
      .populate("pendingJoinRequests", "fullName profilePic")
      .lean();

    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    const requesterIsAdmin = group.admin?._id?.toString?.() === userId;
    if (!requesterIsAdmin) {
      delete group.pendingJoinRequests;
    }

    const sanitized = stripBase64InGroup(group);
    if (!requesterIsAdmin) {
      delete sanitized.pendingJoinRequests;
    }

    res.status(200).json(sanitized);
  } catch (error) {
    console.error("Error in getGroupById controller:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

// Delete a group (admin only)
export async function deleteGroup(req, res) {
  try {
    const { id: groupId } = req.params;
    const userId = req.user.id;

    const group = await Group.findById(groupId);

    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    if (group.admin.toString() !== userId) {
      return res.status(403).json({ message: "Only the admin can delete this group" });
    }

    await Group.findByIdAndDelete(groupId);

    res.status(200).json({ message: "Group deleted successfully" });
  } catch (error) {
    console.error("Error in deleteGroup controller:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

// Admin: list pending join requests
export async function listJoinRequests(req, res) {
  try {
    const { id: groupId } = req.params;
    const userId = req.user.id;

    const group = await Group.findById(groupId)
      .populate("pendingJoinRequests", "fullName profilePic")
      .select("admin pendingJoinRequests")
      .lean();

    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    if (!isAdmin(group, userId)) {
      return res.status(403).json({ message: "Only the admin can manage join requests" });
    }

    const users = Array.isArray(group.pendingJoinRequests)
      ? group.pendingJoinRequests.map(stripBase64ProfilePic)
      : [];

    res.status(200).json({ users });
  } catch (error) {
    console.error("Error in listJoinRequests controller:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

// Admin: approve a pending join request
export async function approveJoinRequest(req, res) {
  try {
    const { id: groupId, userId: requestUserId } = req.params;
    const adminId = req.user.id;

    const group = await Group.findById(groupId);

    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    if (!isAdmin(group, adminId)) {
      return res.status(403).json({ message: "Only the admin can manage join requests" });
    }

    const pending = (group.pendingJoinRequests || []).some((u) => u.toString() === requestUserId);
    if (!pending) {
      return res.status(400).json({ message: "No pending join request for this user" });
    }

    if (!group.members.some((m) => m.toString() === requestUserId)) {
      group.members.push(requestUserId);
    }

    group.pendingJoinRequests = (group.pendingJoinRequests || []).filter((u) => u.toString() !== requestUserId);
    await group.save();

    const populatedGroup = await Group.findById(groupId)
      .populate("admin", "fullName profilePic")
      .populate("members", "fullName profilePic")
      .lean();

    res.status(200).json(stripBase64InGroup(populatedGroup));
  } catch (error) {
    console.error("Error in approveJoinRequest controller:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

// Admin: reject a pending join request
export async function rejectJoinRequest(req, res) {
  try {
    const { id: groupId, userId: requestUserId } = req.params;
    const adminId = req.user.id;

    const group = await Group.findById(groupId);

    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    if (!isAdmin(group, adminId)) {
      return res.status(403).json({ message: "Only the admin can manage join requests" });
    }

    const pending = (group.pendingJoinRequests || []).some((u) => u.toString() === requestUserId);
    if (!pending) {
      return res.status(400).json({ message: "No pending join request for this user" });
    }

    group.pendingJoinRequests = (group.pendingJoinRequests || []).filter((u) => u.toString() !== requestUserId);
    await group.save();

    res.status(200).json({ message: "Join request rejected" });
  } catch (error) {
    console.error("Error in rejectJoinRequest controller:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

// Admin: remove a member from group
export async function removeMember(req, res) {
  try {
    const { id: groupId, memberId } = req.params;
    const adminId = req.user.id;

    const group = await Group.findById(groupId);

    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    if (!isAdmin(group, adminId)) {
      return res.status(403).json({ message: "Only the admin can remove members" });
    }

    if (group.admin.toString() === memberId) {
      return res.status(400).json({ message: "Cannot remove the admin" });
    }

    if (group.members.length <= 3) {
      return res.status(400).json({ message: "A group must have at least 3 members" });
    }

    const isMemberNow = group.members.some((m) => m.toString() === memberId);
    if (!isMemberNow) {
      return res.status(400).json({ message: "User is not a member of this group" });
    }

    group.members = group.members.filter((m) => m.toString() !== memberId);
    await group.save();

    const populatedGroup = await Group.findById(groupId)
      .populate("admin", "fullName profilePic")
      .populate("members", "fullName profilePic")
      .lean();

    res.status(200).json(stripBase64InGroup(populatedGroup));
  } catch (error) {
    console.error("Error in removeMember controller:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}
