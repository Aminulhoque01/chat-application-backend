"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addReactionController = exports.deleteMessageController = exports.updateMessage = exports.markMessageAsReadController = exports.getMessages = exports.sendMessage = void 0;
const message_service_1 = require("./message.service");
const message_validation_1 = require("./message.validation");
const messageUpload_service_1 = require("./messageUpload.service");
const socket_instance_1 = require("../../socket/socket.instance");
const conversation_model_1 = require("../conversation/conversation.model");
const sendMessage = async (req, res) => {
    try {
        // ==========================================
        // Current User
        // ==========================================
        const currentUserId = req.user?.userId;
        if (!currentUserId) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized",
            });
        }
        // ==========================================
        // Validate Request Body
        // ==========================================
        const result = message_validation_1.sendMessageSchema.safeParse(req.body ?? {});
        if (!result.success) {
            return res.status(400).json({
                success: false,
                message: "Invalid message data",
                errors: result.error.flatten(),
            });
        }
        const { conversationId, text, replyTo, } = result.data;
        // ==========================================
        // Convert Files Safely
        // ==========================================
        const files = Array.isArray(req.files)
            ? req.files
            : [];
        // ==========================================
        // Upload Attachments
        // ==========================================
        const attachments = files.length > 0
            ? await (0, messageUpload_service_1.uploadMultipleMessageFiles)(files)
            : [];
        // ==========================================
        // Create Message
        // ==========================================
        const message = await (0, message_service_1.createMessage)(currentUserId, conversationId, text, replyTo, attachments);
        // ==========================================
        // Find Conversation Participants
        // ==========================================
        const conversation = await conversation_model_1.ConversationModel.findById(conversationId).select("participants");
        if (!conversation) {
            return res.status(404).json({
                success: false,
                message: "Conversation not found",
            });
        }
        // ==========================================
        // Realtime Socket Notification
        // ==========================================
        //
        // Do NOT send message:new only to
        // conversationId room.
        //
        // Every participant gets the message
        // through their own personal room.
        //
        // conversation.
        // ==========================================
        const io = (0, socket_instance_1.getSocketIO)();
        for (const participantId of conversation.participants) {
            const participantRoom = `user:${participantId.toString()}`;
            io.to(participantRoom).emit("message:new", message);
        }
        // ==========================================
        // Response
        // ==========================================
        return res.status(201).json({
            success: true,
            message: "Message sent successfully",
            data: message,
        });
    }
    catch (error) {
        const message = error instanceof Error
            ? error.message
            : "Failed to send message";
        return res.status(400).json({
            success: false,
            message,
        });
    }
};
exports.sendMessage = sendMessage;
const getMessages = async (req, res) => {
    try {
        const currentUserId = req.user?.userId;
        if (!currentUserId) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized",
            });
        }
        // Validate params + query
        const result = message_validation_1.getMessagesSchema.safeParse({
            params: req.params,
            query: req.query,
        });
        if (!result.success) {
            return res.status(400).json({
                success: false,
                message: "Invalid request data",
                errors: result.error.flatten(),
            });
        }
        const { id: conversationId } = result.data.params;
        const { page, limit } = result.data.query;
        const data = await (0, message_service_1.getConversationMessages)(currentUserId, conversationId, page, limit);
        return res.status(200).json({
            success: true,
            message: "Messages fetched successfully",
            data,
        });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Failed to fetch messages";
        return res.status(400).json({
            success: false,
            message,
        });
    }
};
exports.getMessages = getMessages;
const markMessageAsReadController = async (req, res) => {
    try {
        const currentUserId = req.user?.userId;
        if (!currentUserId) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized",
            });
        }
        const { id: messageId } = req.params;
        if (!messageId) {
            return res.status(400).json({
                success: false,
                message: "Message ID is required",
            });
        }
        const data = await (0, message_service_1.markMessageAsRead)(currentUserId, messageId);
        return res.status(200).json({
            success: true,
            message: "Message marked as read successfully",
            data,
        });
    }
    catch (error) {
        const message = error instanceof Error
            ? error.message
            : "Failed to mark message as read";
        return res.status(400).json({
            success: false,
            message,
        });
    }
};
exports.markMessageAsReadController = markMessageAsReadController;
const updateMessage = async (req, res) => {
    try {
        const currentUserId = req.user?.userId;
        if (!currentUserId) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized",
            });
        }
        const result = message_validation_1.editMessageSchema.safeParse({
            params: req.params,
            body: req.body,
        });
        if (!result.success) {
            return res.status(400).json({
                success: false,
                message: "Invalid message data",
                errors: result.error.flatten(),
            });
        }
        const { id: messageId } = result.data.params;
        const { text } = result.data.body;
        const message = await (0, message_service_1.editMessage)(currentUserId, messageId, text);
        return res.status(200).json({
            success: true,
            message: "Message updated successfully",
            data: message,
        });
    }
    catch (error) {
        return res.status(400).json({
            success: false,
            message: error instanceof Error ? error.message : "Failed to update message",
        });
    }
};
exports.updateMessage = updateMessage;
const deleteMessageController = async (req, res) => {
    try {
        const currentUserId = req.user?.userId;
        if (!currentUserId) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized",
            });
        }
        const { id: messageId } = req.params;
        if (!messageId) {
            return res.status(400).json({
                success: false,
                message: "Message ID is required",
            });
        }
        const data = await (0, message_service_1.deleteMessage)(currentUserId, messageId);
        return res.status(200).json({
            success: true,
            message: "Message deleted successfully",
            data,
        });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Failed to delete message";
        return res.status(400).json({
            success: false,
            message,
        });
    }
};
exports.deleteMessageController = deleteMessageController;
const addReactionController = async (req, res) => {
    try {
        const { messageId } = req.params;
        const { emoji } = req.body;
        const userId = req.user?.userId;
        const result = await (0, message_service_1.addReaction)(userId, messageId, emoji);
        return res.status(200).json({
            success: true,
            message: result.action === "added"
                ? "Reaction added successfully"
                : "Reaction removed successfully",
            data: {
                message: result.message,
                reactionSummary: result.reactionSummary,
            },
        });
    }
    catch (error) {
        return res.status(400).json({
            success: false,
            message: error instanceof Error ? error.message : "Failed to add reaction",
        });
    }
};
exports.addReactionController = addReactionController;
