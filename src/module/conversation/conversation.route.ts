import { Router } from "express";

import {
  addParticipants,
  createConversation,
  createGroup,
  deleteGroup,
  getConversations,
  promoteAdmin,
  removeParticipant,
  renameGroup,
  updateGroupPhotoController,
} from "./conversation.controller";
import { authMiddleware } from "../../middleware/auth.middleware";
import { uploadAvatar } from "../../middleware/upload.middleware";

 

const conversationRouter = Router();

/**
 * Create / get existing direct conversation
 */
conversationRouter.post(
  "/",
  authMiddleware,
  createConversation,
);

/**
 * Get current user's conversations
 */
conversationRouter.get(
  "/",
  authMiddleware,
  getConversations,
);


conversationRouter.post(
  "/group",
  authMiddleware,
  createGroup,
);

conversationRouter.post(
  "/:id/participants",
  authMiddleware,
  addParticipants,
);

conversationRouter.delete(
  "/:id/participants/:userId",
  authMiddleware,
  removeParticipant,
);

conversationRouter.post(
  "/:id/admins",
  authMiddleware,
  promoteAdmin,
);

conversationRouter.patch(
  "/:id",
  authMiddleware,
  renameGroup,
);


conversationRouter.patch(
  "/:id/photo",
  authMiddleware,
  uploadAvatar.single(
    "photo",
  ),
  updateGroupPhotoController,
);

/**
 * Delete group
 */
conversationRouter.delete(
  "/:id",
  authMiddleware,
  deleteGroup,
);

export default conversationRouter;