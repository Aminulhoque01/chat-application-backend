"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const conversation_controller_1 = require("./conversation.controller");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const upload_middleware_1 = require("../../middleware/upload.middleware");
const conversationRouter = (0, express_1.Router)();
/**
 * Create / get existing direct conversation
 */
conversationRouter.post("/", auth_middleware_1.authMiddleware, conversation_controller_1.createConversation);
/**
 * Get current user's conversations
 */
conversationRouter.get("/", auth_middleware_1.authMiddleware, conversation_controller_1.getConversations);
conversationRouter.post("/group", auth_middleware_1.authMiddleware, conversation_controller_1.createGroup);
conversationRouter.post("/:id/participants", auth_middleware_1.authMiddleware, conversation_controller_1.addParticipants);
conversationRouter.delete("/:id/participants/:userId", auth_middleware_1.authMiddleware, conversation_controller_1.removeParticipant);
conversationRouter.post("/:id/admins", auth_middleware_1.authMiddleware, conversation_controller_1.promoteAdmin);
conversationRouter.patch("/:id", auth_middleware_1.authMiddleware, conversation_controller_1.renameGroup);
conversationRouter.patch("/:id/photo", auth_middleware_1.authMiddleware, upload_middleware_1.uploadAvatar.single("photo"), conversation_controller_1.updateGroupPhotoController);
/**
 * Delete group
 */
conversationRouter.delete("/:id", auth_middleware_1.authMiddleware, conversation_controller_1.deleteGroup);
exports.default = conversationRouter;
