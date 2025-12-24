import Assignment from "../models/Assignment.js";
import Group from "../models/Group.js";

function isMember(group, userId) {
  return group.members.some((m) => m.toString() === userId);
}

function isAdmin(group, userId) {
  return group.admin.toString() === userId;
}

async function requireGroup(req, res) {
  const { id: groupId } = req.params;
  const group = await Group.findById(groupId).select("admin members");
  if (!group) {
    res.status(404).json({ message: "Group not found" });
    return null;
  }
  if (!isMember(group, req.user.id)) {
    res.status(403).json({ message: "You are not a member of this group" });
    return null;
  }
  return group;
}

export async function listAssignments(req, res) {
  try {
    const group = await requireGroup(req, res);
    if (!group) return;

    const assignments = await Assignment.find({ group: req.params.id })
      .populate("createdBy", "fullName profilePic")
      .populate("completedBy", "fullName profilePic")
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json(assignments);
  } catch (error) {
    console.error("Error in listAssignments controller:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function createAssignment(req, res) {
  try {
    const group = await requireGroup(req, res);
    if (!group) return;

    if (!isAdmin(group, req.user.id)) {
      return res.status(403).json({ message: "Only the admin can create assignments" });
    }

    const { title, description, dueDate } = req.body;
    if (!title || typeof title !== "string" || !title.trim()) {
      return res.status(400).json({ message: "Title is required" });
    }

    const assignment = await Assignment.create({
      group: req.params.id,
      title: title.trim(),
      description: typeof description === "string" ? description : "",
      dueDate: dueDate ? new Date(dueDate) : null,
      createdBy: req.user.id,
      completedBy: [],
    });

    const populated = await Assignment.findById(assignment._id)
      .populate("createdBy", "fullName profilePic")
      .lean();

    res.status(201).json(populated);
  } catch (error) {
    console.error("Error in createAssignment controller:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function updateAssignment(req, res) {
  try {
    const group = await requireGroup(req, res);
    if (!group) return;

    if (!isAdmin(group, req.user.id)) {
      return res.status(403).json({ message: "Only the admin can update assignments" });
    }

    const { assignmentId } = req.params;
    const { title, description, dueDate } = req.body;

    const update = {};
    if (typeof title === "string") update.title = title.trim();
    if (typeof description === "string") update.description = description;
    if (typeof dueDate !== "undefined") update.dueDate = dueDate ? new Date(dueDate) : null;

    const updated = await Assignment.findOneAndUpdate(
      { _id: assignmentId, group: req.params.id },
      { $set: update },
      { new: true }
    )
      .populate("createdBy", "fullName profilePic")
      .lean();

    if (!updated) {
      return res.status(404).json({ message: "Assignment not found" });
    }

    res.status(200).json(updated);
  } catch (error) {
    console.error("Error in updateAssignment controller:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function deleteAssignment(req, res) {
  try {
    const group = await requireGroup(req, res);
    if (!group) return;

    if (!isAdmin(group, req.user.id)) {
      return res.status(403).json({ message: "Only the admin can delete assignments" });
    }

    const { assignmentId } = req.params;

    const deleted = await Assignment.findOneAndDelete({
      _id: assignmentId,
      group: req.params.id,
    }).lean();

    if (!deleted) {
      return res.status(404).json({ message: "Assignment not found" });
    }

    res.status(200).json({ message: "Assignment deleted" });
  } catch (error) {
    console.error("Error in deleteAssignment controller:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function setAssignmentCompletion(req, res) {
  try {
    const group = await requireGroup(req, res);
    if (!group) return;

    const { assignmentId } = req.params;
    const completed = req.body?.completed;

    const filter = { _id: assignmentId, group: req.params.id };

    const update =
      typeof completed === "boolean"
        ? completed
          ? { $addToSet: { completedBy: req.user.id } }
          : { $pull: { completedBy: req.user.id } }
        : {
            // toggle
            $set: {},
          };

    if (typeof completed !== "boolean") {
      const existing = await Assignment.findOne(filter).select("completedBy").lean();
      if (!existing) return res.status(404).json({ message: "Assignment not found" });

      const isDone = (existing.completedBy || []).some((u) => u.toString() === req.user.id);
      const toggledUpdate = isDone
        ? { $pull: { completedBy: req.user.id } }
        : { $addToSet: { completedBy: req.user.id } };

      const updated = await Assignment.findOneAndUpdate(filter, toggledUpdate, { new: true })
        .populate("createdBy", "fullName profilePic")
        .populate("completedBy", "fullName profilePic")
        .lean();

      return res.status(200).json(updated);
    }

    const updated = await Assignment.findOneAndUpdate(filter, update, { new: true })
      .populate("createdBy", "fullName profilePic")
      .populate("completedBy", "fullName profilePic")
      .lean();

    if (!updated) {
      return res.status(404).json({ message: "Assignment not found" });
    }

    res.status(200).json(updated);
  } catch (error) {
    console.error("Error in setAssignmentCompletion controller:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}
