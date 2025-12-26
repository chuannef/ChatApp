import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import {
  createGroup,
  getMyGroups,
  getAvailableGroups,
  joinGroup,
  leaveGroup,
  getGroupById,
  deleteGroup,
  listJoinRequests,
  approveJoinRequest,
  rejectJoinRequest,
  removeMember,
} from "../controllers/group.controller.js";
import { sendGroupInvitation } from "../controllers/groupInvitation.controller.js";
import {
  listAssignments,
  createAssignment,
  updateAssignment,
  deleteAssignment,
  setAssignmentCompletion,
} from "../controllers/assignment.controller.js";

const router = express.Router();

// Apply auth middleware to all routes
router.use(protectRoute);

// Get groups
router.get("/my-groups", getMyGroups);
router.get("/available", getAvailableGroups);
router.get("/:id", getGroupById);

// Group assignments
router.get("/:id/assignments", listAssignments);
router.post("/:id/assignments", createAssignment);
router.patch("/:id/assignments/:assignmentId", updateAssignment);
router.delete("/:id/assignments/:assignmentId", deleteAssignment);
router.post("/:id/assignments/:assignmentId/complete", setAssignmentCompletion);

// Create group
router.post("/", createGroup);

// Admin: send invitations
router.post("/:id/invitations/:userId", sendGroupInvitation);

// Join/Leave group
router.post("/:id/join", joinGroup);
router.post("/:id/leave", leaveGroup);

// Admin: join requests + members
router.get("/:id/join-requests", listJoinRequests);
router.post("/:id/join-requests/:userId/approve", approveJoinRequest);
router.post("/:id/join-requests/:userId/reject", rejectJoinRequest);
router.delete("/:id/members/:memberId", removeMember);

// Delete group (admin only)
router.delete("/:id", deleteGroup);

export default router;
