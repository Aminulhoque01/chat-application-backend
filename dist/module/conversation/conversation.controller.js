"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renameGroup = exports.promoteAdmin = exports.removeParticipant = exports.addParticipants = exports.createGroup = exports.getConversations = exports.createConversation = void 0;
const conversation_validation_1 = require("./conversation.validation");
const conversation_service_1 = require("./conversation.service");
const createConversation = async (req, res) => {
    try {
        const currentUserId = req.user?.userId;
        if (!currentUserId) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized",
            });
        }
        const result = conversation_validation_1.createDirectConversationSchema.safeParse(req.body);
        if (!result.success) {
            return res.status(400).json({
                success: false,
                message: "Invalid request data",
                errors: result.error.flatten(),
            });
        }
        const conversation = await (0, conversation_service_1.createDirectConversation)(currentUserId, result.data.participantId);
        return res.status(200).json({
            success: true,
            message: "Direct conversation created successfully",
            data: conversation,
        });
    }
    catch (error) {
        console.error("Create conversation error:", error);
        const message = error instanceof Error
            ? error.message
            : "Failed to create conversation";
        return res.status(400).json({
            success: false,
            message,
        });
    }
};
exports.createConversation = createConversation;
const getConversations = async (req, res) => {
    try {
        const currentUserId = req.user?.userId;
        if (!currentUserId) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized",
            });
        }
        const conversations = await (0, conversation_service_1.getMyConversations)(currentUserId);
        return res.status(200).json({
            success: true,
            message: "Conversations fetched successfully",
            data: conversations,
        });
    }
    catch (error) {
        console.error("Get conversations error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch conversations",
        });
    }
};
exports.getConversations = getConversations;
const createGroup = async (req, res) => {
    try {
        // Current logged-in user
        const currentUserId = req.user?.userId;
        if (!currentUserId) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized",
            });
        }
        // Validate request body
        const result = conversation_validation_1.createGroupSchema.safeParse(req.body);
        if (!result.success) {
            return res.status(400).json({
                success: false,
                message: "Invalid request data",
                errors: result.error.flatten(),
            });
        }
        const { name, participantIds, } = result.data;
        // Create group
        const conversation = await (0, conversation_service_1.createGroupConversation)(currentUserId, name, participantIds);
        return res.status(201).json({
            success: true,
            message: "Group created successfully",
            data: conversation,
        });
    }
    catch (error) {
        console.error("Create group error:", error);
        const message = error instanceof Error
            ? error.message
            : "Failed to create group";
        return res.status(400).json({
            success: false,
            message,
        });
    }
};
exports.createGroup = createGroup;
const addParticipants = async (req, res) => {
    try {
        const currentUserId = req.user?.userId;
        if (!currentUserId) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized",
            });
        }
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({
                success: false,
                message: "Conversation ID is required",
            });
        }
        // Validate body
        const result = conversation_validation_1.addParticipantsSchema.safeParse(req.body);
        if (!result.success) {
            return res.status(400).json({
                success: false,
                message: "Invalid request data",
                errors: result.error.flatten(),
            });
        }
        const conversation = await (0, conversation_service_1.addParticipantsToGroup)(currentUserId, id, result.data.participantIds);
        return res.status(200).json({
            success: true,
            message: "Participants added successfully",
            data: conversation,
        });
    }
    catch (error) {
        console.error("Add participants error:", error);
        const message = error instanceof Error
            ? error.message
            : "Failed to add participants";
        return res.status(400).json({
            success: false,
            message,
        });
    }
};
exports.addParticipants = addParticipants;
const removeParticipant = async (req, res) => {
    try {
        const currentUserId = req.user?.userId;
        if (!currentUserId) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized",
            });
        }
        const { id, userId } = req.params;
        if (!id) {
            return res.status(400).json({
                success: false,
                message: "Conversation ID is required",
            });
        }
        if (!userId) {
            return res.status(400).json({
                success: false,
                message: "User ID is required",
            });
        }
        const conversation = await (0, conversation_service_1.removeParticipantFromGroup)(currentUserId, id, userId);
        return res.status(200).json({
            success: true,
            message: currentUserId === userId
                ? "You left the group successfully"
                : "Participant removed successfully",
            data: conversation,
        });
    }
    catch (error) {
        console.error("Remove participant error:", error);
        const message = error instanceof Error
            ? error.message
            : "Failed to remove participant";
        return res.status(400).json({
            success: false,
            message,
        });
    }
};
exports.removeParticipant = removeParticipant;
const promoteAdmin = async (req, res) => {
    try {
        const currentUserId = req.user?.userId;
        if (!currentUserId) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized",
            });
        }
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({
                success: false,
                message: "Conversation ID is required",
            });
        }
        const result = conversation_validation_1.promoteAdminSchema.safeParse(req.body);
        if (!result.success) {
            return res.status(400).json({
                success: false,
                message: "Invalid request data",
                errors: result.error.flatten(),
            });
        }
        const conversation = await (0, conversation_service_1.promoteMemberToAdmin)(currentUserId, id, result.data.userId);
        return res.status(200).json({
            success: true,
            message: "User promoted to admin successfully",
            data: conversation,
        });
    }
    catch (error) {
        console.error("Promote admin error:", error);
        const message = error instanceof Error
            ? error.message
            : "Failed to promote admin";
        return res.status(400).json({
            success: false,
            message,
        });
    }
};
exports.promoteAdmin = promoteAdmin;
const renameGroup = async (req, res) => {
    try {
        const currentUserId = req.user?.userId;
        if (!currentUserId) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized",
            });
        }
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({
                success: false,
                message: "Conversation ID is required",
            });
        }
        const result = conversation_validation_1.renameGroupSchema.safeParse(req.body);
        if (!result.success) {
            return res.status(400).json({
                success: false,
                message: "Invalid request data",
                errors: result.error.flatten(),
            });
        }
        const conversation = await (0, conversation_service_1.renameGroupConversation)(currentUserId, id, result.data.name);
        return res.status(200).json({
            success: true,
            message: "Group renamed successfully",
            data: conversation,
        });
    }
    catch (error) {
        console.error("Rename group error:", error);
        const message = error instanceof Error
            ? error.message
            : "Failed to rename group";
        return res.status(400).json({
            success: false,
            message,
        });
    }
};
exports.renameGroup = renameGroup;
