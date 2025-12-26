import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import {
  acceptFriendRequest,
  declineFriendRequest,
  getFriendRequests,
  getMyFriends,
  getOutgoingFriendReqs,
  getRecommendedUsers,
  removeFriend,
  sendFriendRequest,
} from "../controllers/user.controller.js";
import {
  acceptGroupInvitation,
  declineGroupInvitation,
  getMyGroupInvitations,
} from "../controllers/groupInvitation.controller.js";

const router = express.Router();

// apply auth middleware to all routes
router.use(protectRoute);

router.get("/", getRecommendedUsers);
router.get("/friends", getMyFriends);
router.delete("/friends/:id", removeFriend);

router.post("/friend-request/:id", sendFriendRequest);
router.put("/friend-request/:id/accept", acceptFriendRequest);
router.put("/friend-request/:id/decline", declineFriendRequest);

router.get("/friend-requests", getFriendRequests);
router.get("/outgoing-friend-requests", getOutgoingFriendReqs);

// Group invitations (Notifications)
router.get("/group-invitations", getMyGroupInvitations);
router.put("/group-invitations/:id/accept", acceptGroupInvitation);
router.put("/group-invitations/:id/decline", declineGroupInvitation);

export default router;
