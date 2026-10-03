"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerSocketHandlers = void 0;
const mongoose_1 = require("mongoose");
const user_service_1 = require("../module/user/user.service");
const message_service_1 = require("../module/message/message.service");
const conversation_service_1 = require("../module/conversation/conversation.service");
const conversation_model_1 = require("../module/conversation/conversation.model");
const message_model_1 = require("../module/message/message.model");
const block_model_1 = require("../module/block/block.model");
const cache_service_1 = require("../cache/cache.service");
/**
 * ============================================================
 * Check whether current user is blocked with another user
 * inside a direct conversation.
 *
 * Group conversations are NOT affected by block.
 * ============================================================
 */
const isDirectConversationBlocked = async (conversationId, currentUserId) => {
    // ==========================================================
    // Validate conversation ID
    // ==========================================================
    if (!mongoose_1.Types.ObjectId.isValid(conversationId)) {
        throw new Error("Invalid conversation ID");
    }
    // ==========================================================
    // Validate current user ID
    // ==========================================================
    if (!mongoose_1.Types.ObjectId.isValid(currentUserId)) {
        throw new Error("Invalid current user ID");
    }
    // ==========================================================
    // Find conversation
    // ==========================================================
    const conversation = await conversation_model_1.ConversationModel.findOne({
        _id: new mongoose_1.Types.ObjectId(conversationId),
        participants: new mongoose_1.Types.ObjectId(currentUserId),
    }).select("type participants");
    if (!conversation) {
        throw new Error("Conversation not found or you are not a member");
    }
    // ==========================================================
    // Group conversation
    //
    // Block does not affect group chat.
    // ==========================================================
    if (conversation.type !== "direct") {
        return false;
    }
    // ==========================================================
    // Find other participant
    // ==========================================================
    const otherParticipantId = conversation.participants.find((participantId) => participantId.toString() !==
        currentUserId);
    if (!otherParticipantId) {
        throw new Error("Direct conversation participant not found");
    }
    // ==========================================================
    // Check both block directions
    // ==========================================================
    const blockExists = await block_model_1.BlockModel.exists({
        $or: [
            {
                blockerId: new mongoose_1.Types.ObjectId(currentUserId),
                blockedId: new mongoose_1.Types.ObjectId(otherParticipantId.toString()),
            },
            {
                blockerId: new mongoose_1.Types.ObjectId(otherParticipantId.toString()),
                blockedId: new mongoose_1.Types.ObjectId(currentUserId),
            },
        ],
    });
    return Boolean(blockExists);
};
/**
 * ============================================================
 * Register Socket Handlers
 * ============================================================
 */
const registerSocketHandlers = (io, socket) => {
    const userId = socket.data.userId;
    // ==========================================================
    // User Online
    // ==========================================================
    (0, user_service_1.setUserOnline)(userId)
        .then(() => {
        console.log(`User ${userId} is online`);
    })
        .catch((error) => {
        console.error("Failed to set user online:", error);
    });
    // ==========================================================
    // Send Message
    // ==========================================================
    socket.on("message:send", async (payload) => {
        try {
            const { conversationId, text = "", replyTo, } = payload;
            // ====================================================
            // Validate conversation ID
            // ====================================================
            if (!conversationId) {
                socket.emit("message:error", {
                    message: "Conversation ID is required",
                });
                return;
            }
            if (!mongoose_1.Types.ObjectId.isValid(conversationId)) {
                socket.emit("message:error", {
                    message: "Invalid conversation ID",
                });
                return;
            }
            // ====================================================
            // Check membership
            // ====================================================
            const isMember = await (0, conversation_service_1.isConversationMember)(conversationId, userId);
            if (!isMember) {
                socket.emit("message:error", {
                    message: "You are not a member of this conversation",
                });
                return;
            }
            // ====================================================
            // Check block relationship
            //
            // Group conversations are unaffected.
            // ====================================================
            const blocked = await isDirectConversationBlocked(conversationId, userId);
            if (blocked) {
                socket.emit("message:error", {
                    message: "You cannot send messages in this conversation",
                });
                return;
            }
            // ====================================================
            // Create message
            // ====================================================
            const message = await (0, message_service_1.createMessage)(userId, conversationId, text, replyTo, []);
            // ====================================================
            // Get conversation participants
            // ====================================================
            const conversation = await conversation_model_1.ConversationModel.findById(conversationId).select("participants");
            if (!conversation) {
                throw new Error("Conversation not found");
            }
            // ====================================================
            // Get populated sender
            // ====================================================
            const sender = message.senderId;
            // ====================================================
            // Convert message to plain object
            // ====================================================
            const socketMessage = message.toObject();
            // ====================================================
            // Prepare sender payload
            // ====================================================
            const populatedSender = {
                _id: sender._id,
                phone: sender.phone,
                name: sender.name,
                avatar: sender.avatar ?? null,
                bio: sender.bio ?? null,
                isOnline: sender.isOnline ?? false,
                lastSeen: sender.lastSeen ?? null,
            };
            // ====================================================
            // Invalidate conversation caches
            //
            // New message changes:
            // - lastMessage
            // - updatedAt
            // - unreadCount
            //
            // So every participant's conversation cache
            // must be invalidated.
            // ====================================================
            const participantIds = conversation.participants.map((participantId) => participantId.toString());
            await (0, cache_service_1.invalidateUserConversationsCache)(participantIds);
            // ====================================================
            // Emit message to every participant
            // ====================================================
            for (const participantId of conversation.participants) {
                const participantRoom = `user:${participantId.toString()}`;
                io.to(participantRoom).emit("message:new", {
                    ...socketMessage,
                    senderId: populatedSender,
                });
            }
            console.log(`Message ${message._id} delivered to participant rooms`);
        }
        catch (error) {
            console.error("message:send error:", error);
            socket.emit("message:error", {
                message: error instanceof Error
                    ? error.message
                    : "Failed to send message",
            });
        }
    });
    // ==========================================================
    // Message Reaction
    // ==========================================================
    socket.on("message:reaction", async (payload) => {
        try {
            const { messageId, emoji, } = payload;
            // ====================================================
            // Validate payload
            // ====================================================
            if (!messageId ||
                !emoji) {
                socket.emit("message:error", {
                    message: "Message ID and emoji are required",
                });
                return;
            }
            // ====================================================
            // Add / remove reaction
            // ====================================================
            const result = await (0, message_service_1.addReaction)(userId, messageId, emoji);
            const conversationId = result.message.conversationId.toString();
            // ====================================================
            // Broadcast reaction update
            // ====================================================
            io.to(conversationId).emit("message:reaction:update", {
                messageId: result.message._id.toString(),
                conversationId,
                action: result.action,
                reactionSummary: result.reactionSummary,
            });
            console.log(`Reaction ${result.action}:`, emoji, `on message ${messageId}`);
        }
        catch (error) {
            console.error("message:reaction error:", error);
            socket.emit("message:error", {
                message: error instanceof Error
                    ? error.message
                    : "Failed to update reaction",
            });
        }
    });
    // ==========================================================
    // Message Delete
    // ==========================================================
    socket.on("message:delete", async (payload) => {
        try {
            const { messageId, } = payload;
            // ====================================================
            // Validate message ID
            // ====================================================
            if (!messageId) {
                socket.emit("message:error", {
                    message: "Message ID is required",
                });
                return;
            }
            // ====================================================
            // Delete message
            // ====================================================
            const deletedMessage = await (0, message_service_1.deleteMessage)(userId, messageId);
            const conversationId = deletedMessage.conversationId.toString();
            // ====================================================
            // Get participants
            // ====================================================
            const conversation = await conversation_model_1.ConversationModel.findById(conversationId).select("participants");
            // ====================================================
            // Invalidate conversation caches
            // ====================================================
            if (conversation) {
                await (0, cache_service_1.invalidateUserConversationsCache)(conversation.participants.map((participantId) => participantId.toString()));
            }
            // ====================================================
            // Broadcast deletion
            // ====================================================
            io.to(conversationId).emit("message:deleted", deletedMessage);
            console.log(`Message ${messageId} deleted`);
        }
        catch (error) {
            console.error("message:delete error:", error);
            socket.emit("message:error", {
                message: error instanceof Error
                    ? error.message
                    : "Failed to delete message",
            });
        }
    });
    // ==========================================================
    // Message Edit
    // ==========================================================
    socket.on("message:edit", async (payload) => {
        try {
            const { messageId, text, } = payload;
            // ====================================================
            // Validate message ID
            // ====================================================
            if (!messageId) {
                socket.emit("message:error", {
                    message: "Message ID is required",
                });
                return;
            }
            // ====================================================
            // Validate text
            // ====================================================
            if (!text ||
                !text.trim()) {
                socket.emit("message:error", {
                    message: "Message text is required",
                });
                return;
            }
            // ====================================================
            // Edit message
            // ====================================================
            const message = await (0, message_service_1.editMessage)(userId, messageId, text);
            const conversationId = message.conversationId.toString();
            // ====================================================
            // Get participants
            // ====================================================
            const conversation = await conversation_model_1.ConversationModel.findById(conversationId).select("participants");
            // ====================================================
            // Invalidate conversation caches
            // ====================================================
            if (conversation) {
                await (0, cache_service_1.invalidateUserConversationsCache)(conversation.participants.map((participantId) => participantId.toString()));
            }
            // ====================================================
            // Broadcast edited message
            // ====================================================
            io.to(conversationId).emit("message:edited", message);
            console.log(`Message ${message._id} edited`);
        }
        catch (error) {
            console.error("message:edit error:", error);
            socket.emit("message:error", {
                message: error instanceof Error
                    ? error.message
                    : "Failed to edit message",
            });
        }
    });
    // ==========================================================
    // Message Delivered
    // ==========================================================
    socket.on("message:delivered", async ({ messageId, }) => {
        try {
            // ====================================================
            // Validate message ID
            // ====================================================
            if (!messageId) {
                socket.emit("message:error", {
                    message: "Message ID is required",
                });
                return;
            }
            // ====================================================
            // Mark message as delivered
            // ====================================================
            const result = await (0, message_service_1.markMessageAsDelivered)(userId, messageId);
            // ====================================================
            // Notify original sender
            // ====================================================
            io.to(`user:${result.senderId}`).emit("message:delivery:update", {
                messageId: result.messageId,
                conversationId: result.conversationId,
                userId: result.userId,
            });
            console.log(`Message ${result.messageId} delivered to user ${result.userId}`);
        }
        catch (error) {
            console.error("message:delivered error:", error);
            socket.emit("message:error", {
                message: error instanceof Error
                    ? error.message
                    : "Failed to mark message as delivered",
            });
        }
    });
    // ==========================================================
    // Message Read - Single Message
    // ==========================================================
    socket.on("message:read", async ({ messageId, }) => {
        try {
            // ====================================================
            // Validate message ID
            // ====================================================
            if (!messageId) {
                socket.emit("message:error", {
                    message: "Message ID is required",
                });
                return;
            }
            // ====================================================
            // Mark message as read
            // ====================================================
            const message = await (0, message_service_1.markMessageAsRead)(userId, messageId);
            const conversationId = message.conversationId.toString();
            // ====================================================
            // Invalidate current user's conversation cache
            // ====================================================
            await (0, cache_service_1.invalidateUserConversationsCache)([
                userId,
            ]);
            // ====================================================
            // Find sender ID
            // ====================================================
            const senderId = typeof message.senderId ===
                "string"
                ? message.senderId
                : message.senderId._id.toString();
            // ====================================================
            // Notify sender
            // ====================================================
            io.to(`user:${senderId}`).emit("message:read:update", {
                messageId: message._id.toString(),
                conversationId,
                userId,
            });
            console.log(`User ${userId} read message ${messageId}`);
        }
        catch (error) {
            console.error("message:read error:", error);
            socket.emit("message:error", {
                message: error instanceof Error
                    ? error.message
                    : "Failed to mark message as read",
            });
        }
    });
    // ==========================================================
    // Conversation Read
    //
    // Mark ALL unread messages in current conversation as read.
    //
    // This is responsible for sidebar unread count persistence.
    // ==========================================================
    socket.on("conversation:read", async ({ conversationId, }) => {
        try {
            console.log("conversation:read RECEIVED:", {
                conversationId,
                userId,
            });
            // ====================================================
            // Validate conversation ID
            // ====================================================
            if (!conversationId) {
                socket.emit("conversation:error", {
                    message: "Conversation ID is required",
                    conversationId,
                });
                return;
            }
            // ====================================================
            // Validate ObjectId
            // ====================================================
            if (!mongoose_1.Types.ObjectId.isValid(conversationId)) {
                socket.emit("conversation:error", {
                    message: "Invalid conversation ID",
                    conversationId,
                });
                return;
            }
            // ====================================================
            // Validate user ID
            // ====================================================
            if (!mongoose_1.Types.ObjectId.isValid(userId)) {
                socket.emit("conversation:error", {
                    message: "Invalid user ID",
                    conversationId,
                });
                return;
            }
            // ====================================================
            // Check membership
            // ====================================================
            const isMember = await (0, conversation_service_1.isConversationMember)(conversationId, userId);
            if (!isMember) {
                socket.emit("conversation:error", {
                    message: "You are not a member of this conversation",
                    conversationId,
                });
                return;
            }
            // ====================================================
            // Convert IDs
            // ====================================================
            const conversationObjectId = new mongoose_1.Types.ObjectId(conversationId);
            const userObjectId = new mongoose_1.Types.ObjectId(userId);
            // ====================================================
            // Find unread normal messages
            // ====================================================
            const unreadMessages = await message_model_1.MessageModel.find({
                conversationId: conversationObjectId,
                senderId: {
                    $ne: userObjectId,
                },
                type: {
                    $ne: "system",
                },
                isDeleted: false,
                readBy: {
                    $nin: [
                        userObjectId,
                    ],
                },
            })
                .select("_id senderId")
                .lean();
            // ====================================================
            // Nothing unread
            // ====================================================
            if (unreadMessages.length ===
                0) {
                // Still invalidate cache.
                //
                // This protects us from stale Redis data.
                await (0, cache_service_1.invalidateUserConversationsCache)([
                    userId,
                ]);
                socket.emit("conversation:read:update", {
                    conversationId,
                    userId,
                    messageIds: [],
                });
                return;
            }
            // ====================================================
            // Message IDs
            // ====================================================
            const messageIds = unreadMessages.map((message) => message._id.toString());
            // ====================================================
            // Mark all unread messages as read
            // ====================================================
            const updateResult = await message_model_1.MessageModel.updateMany({
                _id: {
                    $in: unreadMessages.map((message) => message._id),
                },
                readBy: {
                    $nin: [
                        userObjectId,
                    ],
                },
            }, {
                $addToSet: {
                    readBy: userObjectId,
                },
            });
            // ====================================================
            // Debug information
            // ====================================================
            console.log("READ UPDATE RESULT:", {
                conversationId,
                userId,
                matchedCount: updateResult.matchedCount,
                modifiedCount: updateResult.modifiedCount,
                messageCount: messageIds.length,
            });
            // ====================================================
            // 🔥 IMPORTANT
            //
            // Remove stale conversation cache.
            //
            // Otherwise refresh may return old unreadCount.
            // ====================================================
            await (0, cache_service_1.invalidateUserConversationsCache)([
                userId,
            ]);
            console.log(`Conversation cache invalidated for user: ${userId}`);
            // ====================================================
            // Notify current user
            // ====================================================
            socket.emit("conversation:read:update", {
                conversationId,
                userId,
                messageIds,
            });
            // ====================================================
            // Find original senders
            // ====================================================
            const senderIds = [
                ...new Set(unreadMessages
                    .map((message) => message.senderId?.toString())
                    .filter((senderId) => Boolean(senderId) &&
                    senderId !== userId)),
            ];
            // ====================================================
            // Notify senders
            // ====================================================
            for (const senderId of senderIds) {
                io.to(`user:${senderId}`).emit("conversation:read:update", {
                    conversationId,
                    userId,
                    messageIds,
                });
            }
            console.log(`Conversation ${conversationId}: ${messageIds.length} message(s) marked as read by user ${userId}`);
        }
        catch (error) {
            console.error("conversation:read error:", error);
            socket.emit("conversation:error", {
                message: error instanceof Error
                    ? error.message
                    : "Failed to mark conversation as read",
                conversationId,
            });
        }
    });
    // ==========================================================
    // Typing Start
    // ==========================================================
    socket.on("typing:start", async ({ conversationId, }) => {
        try {
            // ====================================================
            // Validate conversation ID
            // ====================================================
            if (!conversationId) {
                socket.emit("message:error", {
                    message: "Conversation ID is required",
                });
                return;
            }
            // ====================================================
            // Check membership
            // ====================================================
            const isMember = await (0, conversation_service_1.isConversationMember)(conversationId, userId);
            if (!isMember) {
                socket.emit("message:error", {
                    message: "You are not a member of this conversation",
                });
                return;
            }
            // ====================================================
            // Check block relationship
            // ====================================================
            const blocked = await isDirectConversationBlocked(conversationId, userId);
            if (blocked) {
                return;
            }
            // ====================================================
            // Emit typing start
            // ====================================================
            socket
                .to(conversationId)
                .emit("typing:start", {
                conversationId,
                userId,
            });
            console.log(`User ${userId} started typing in ${conversationId}`);
        }
        catch (error) {
            console.error("typing:start error:", error);
        }
    });
    // ==========================================================
    // Typing Stop
    // ==========================================================
    socket.on("typing:stop", async ({ conversationId, }) => {
        try {
            // ====================================================
            // Validate conversation ID
            // ====================================================
            if (!conversationId) {
                socket.emit("message:error", {
                    message: "Conversation ID is required",
                });
                return;
            }
            // ====================================================
            // Check membership
            // ====================================================
            const isMember = await (0, conversation_service_1.isConversationMember)(conversationId, userId);
            if (!isMember) {
                socket.emit("message:error", {
                    message: "You are not a member of this conversation",
                });
                return;
            }
            // ====================================================
            // Check block relationship
            // ====================================================
            const blocked = await isDirectConversationBlocked(conversationId, userId);
            if (blocked) {
                return;
            }
            // ====================================================
            // Emit typing stop
            // ====================================================
            socket
                .to(conversationId)
                .emit("typing:stop", {
                conversationId,
                userId,
            });
            console.log(`User ${userId} stopped typing in ${conversationId}`);
        }
        catch (error) {
            console.error("typing:stop error:", error);
        }
    });
    // ==========================================================
    // Disconnect
    // ==========================================================
    socket.on("disconnect", (reason) => {
        console.log(`Socket disconnected: ${socket.id}`, `userId: ${userId}`, `reason: ${reason}`);
        (0, user_service_1.setUserOffline)(userId)
            .then(() => {
            console.log(`User ${userId} is offline`);
        })
            .catch((error) => {
            console.error("Failed to set user offline:", error);
        });
    });
};
exports.registerSocketHandlers = registerSocketHandlers;
