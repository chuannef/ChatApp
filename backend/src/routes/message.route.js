import express from "express";

import { protectRoute } from "../middleware/auth.middleware.js";
import { getDmMessages, getGroupMessages } from "../controllers/message.controller.js";

const router = express.Router();

router.use(protectRoute);

router.get("/dm/:userId", getDmMessages);
router.get("/group/:groupId", getGroupMessages);

export default router;
