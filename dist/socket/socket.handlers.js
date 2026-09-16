"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerSocketHandlers = void 0;
const user_service_1 = require("../module/user/user.service");
const message_service_1 = require("../module/message/message.service");
const conversation_service_1 = require("../module/conversation/conversation.service");
const conversation_model_1 = require("../module/conversation/conversation.model");
const registerSocketHandlers = (io, socket) => {
    const userId = socket.data.userId;
    // ==========================================
    // User Online
    // ==========================================
    (0, user_service_1.setUserOnline)(userId)
        .then(() => {
        console.log(`User ${userId} is online`);
    })
        .catch((error) => {
        console.error("Failed to set user online:", error);
    });
    // ==========================================
    // Send Message
    // ==========================================
    // socket.on(
    //   "message:send",
    //   async (payload: {
    //     conversationId: string;
    //     text?: string;
    //     replyTo?: string;
    //   }) => {
    //     try {
    //       const { conversationId, text = "", replyTo } = payload;
    //       if (!conversationId) {
    //         socket.emit("message:error", {
    //           message: "Conversation ID is required",
    //         });
    //         return;
    //       }
    //       // --------------------------------------
    //       // Check conversation membership
    //       // --------------------------------------
    //       const isMember = await isConversationMember(conversationId, userId);
    //       if (!isMember) {
    //         socket.emit("message:error", {
    //           message: "You are not a member of this conversation",
    //         });
    //         return;
    //       }
    //       // --------------------------------------
    //       // Create message
    //       // --------------------------------------
    //       const message = await createMessage(
    //         userId,
    //         conversationId,
    //         text,
    //         replyTo,
    //         [],
    //       );
    //       // --------------------------------------
    //       // Get conversation participants
    //       //
    //       // We need participant IDs so that the
    //       // message can be delivered to every
    //       // connected user's personal room.
    //       // --------------------------------------
    //       const participants =
    //         message.conversationId &&
    //         typeof message.conversationId === "object" &&
    //         "participants" in message.conversationId
    //           ? (message.conversationId as any).participants
    //           : null;
    //       if (participants) {
    //         for (const participant of participants) {
    //           const participantId =
    //             typeof participant === "string"
    //               ? participant
    //               : participant._id?.toString();
    //           if (!participantId) continue;
    //           io.to(`user:${participantId}`).emit("message:new", message);
    //         }
    //       } else {
    //         /**
    //          * Fallback:
    //          *
    //          * If createMessage() does not return
    //          * populated conversation participants,
    //          * at least send the message to the
    //          * current conversation room.
    //          *
    //          * We can remove this fallback later
    //          * if createMessage always returns
    //          * populated participants.
    //          */
    //         io.to(conversationId).emit("message:new", message);
    //       }
    //       console.log(
    //         `Message ${message._id} created in conversation ${conversationId}`,
    //       );
    //     } catch (error) {
    //       console.error("message:send error:", error);
    //       socket.emit("message:error", {
    //         message:
    //           error instanceof Error ? error.message : "Failed to send message",
    //       });
    //     }
    //   },
    // );
    socket.on("message:send", async (payload) => {
        try {
            const { conversationId, text = "", replyTo } = payload;
            if (!conversationId) {
                socket.emit("message:error", {
                    message: "Conversation ID is required",
                });
                return;
            }
            // --------------------------------------
            // Verify membership
            // --------------------------------------
            const isMember = await (0, conversation_service_1.isConversationMember)(conversationId, userId);
            if (!isMember) {
                socket.emit("message:error", {
                    message: "You are not a member of this conversation",
                });
                return;
            }
            // --------------------------------------
            // Create message
            // --------------------------------------
            const message = await (0, message_service_1.createMessage)(userId, conversationId, text, replyTo, []);
            // --------------------------------------
            // Get conversation participants
            // --------------------------------------
            const conversation = await conversation_model_1.ConversationModel.findById(conversationId).select("participants");
            if (!conversation) {
                throw new Error("Conversation not found");
            }
            // --------------------------------------
            // Send message to every participant's
            // personal socket room
            // --------------------------------------
            for (const participantId of conversation.participants) {
                const participantRoom = `user:${participantId.toString()}`;
                io.to(participantRoom).emit("message:new", message);
            }
            console.log(`Message ${message._id} delivered to participant rooms`);
        }
        catch (error) {
            console.error("message:send error:", error);
            socket.emit("message:error", {
                message: error instanceof Error ? error.message : "Failed to send message",
            });
        }
    });
    // ==========================================
    // Message Reaction
    // ==========================================
    socket.on("message:reaction", async (payload) => {
        try {
            const { messageId, emoji } = payload;
            if (!messageId || !emoji) {
                socket.emit("message:error", {
                    message: "Message ID and emoji are required",
                });
                return;
            }
            const result = await (0, message_service_1.addReaction)(userId, messageId, emoji);
            const conversationId = result.message.conversationId.toString();
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
                message: error instanceof Error ? error.message : "Failed to update reaction",
            });
        }
    });
    // ==========================================
    // Message Delete
    // ==========================================
    socket.on("message:delete", async (payload) => {
        try {
            const { messageId } = payload;
            if (!messageId) {
                socket.emit("message:error", {
                    message: "Message ID is required",
                });
                return;
            }
            const deletedMessage = await (0, message_service_1.deleteMessage)(userId, messageId);
            const conversationId = deletedMessage.conversationId.toString();
            io.to(conversationId).emit("message:deleted", deletedMessage);
            console.log(`Message ${messageId} deleted`);
        }
        catch (error) {
            console.error("message:delete error:", error);
            socket.emit("message:error", {
                message: error instanceof Error ? error.message : "Failed to delete message",
            });
        }
    });
    // ==========================================
    // Message Edit
    // ==========================================
    socket.on("message:edit", async (payload) => {
        try {
            const { messageId, text } = payload;
            if (!messageId) {
                socket.emit("message:error", {
                    message: "Message ID is required",
                });
                return;
            }
            if (!text || !text.trim()) {
                socket.emit("message:error", {
                    message: "Message text is required",
                });
                return;
            }
            const message = await (0, message_service_1.editMessage)(userId, messageId, text);
            const conversationId = message.conversationId.toString();
            // Send edited message to everyone
            // inside the conversation room
            io.to(conversationId).emit("message:edited", message);
            console.log(`Message ${message._id} edited`);
        }
        catch (error) {
            console.error("message:edit error:", error);
            socket.emit("message:error", {
                message: error instanceof Error ? error.message : "Failed to edit message",
            });
        }
    });
    // ==========================================
    // Message Delivered
    // ==========================================
    socket.on("message:delivered", async ({ messageId }) => {
        try {
            if (!messageId) {
                socket.emit("message:error", {
                    message: "Message ID is required",
                });
                return;
            }
            const result = await (0, message_service_1.markMessageAsDelivered)(userId, messageId);
            // Send delivery update to
            // message sender's personal room
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
    // ==========================================
    // Message Read
    // ==========================================
    socket.on("message:read", async (payload) => {
        try {
            const { messageId } = payload;
            if (!messageId) {
                socket.emit("message:error", {
                    message: "Message ID is required",
                });
                return;
            }
            const message = await (0, message_service_1.markMessageAsRead)(userId, messageId);
            const conversationId = message.conversationId.toString();
            /**
             * Read update should go to the
             * message sender's personal room.
             */
            const senderId = typeof message.senderId === "string"
                ? message.senderId
                : message.senderId._id.toString();
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
    // ==========================================
    // Typing Start
    // ==========================================
    socket.on("typing:start", async ({ conversationId }) => {
        try {
            if (!conversationId) {
                socket.emit("message:error", {
                    message: "Conversation ID is required",
                });
                return;
            }
            const isMember = await (0, conversation_service_1.isConversationMember)(conversationId, userId);
            if (!isMember) {
                socket.emit("message:error", {
                    message: "You are not a member of this conversation",
                });
                return;
            }
            socket.to(conversationId).emit("typing:start", {
                conversationId,
                userId,
            });
            console.log(`User ${userId} started typing in ${conversationId}`);
        }
        catch (error) {
            console.error("typing:start error:", error);
        }
    });
    // ==========================================
    // Typing Stop
    // ==========================================
    socket.on("typing:stop", async ({ conversationId }) => {
        try {
            if (!conversationId) {
                socket.emit("message:error", {
                    message: "Conversation ID is required",
                });
                return;
            }
            const isMember = await (0, conversation_service_1.isConversationMember)(conversationId, userId);
            if (!isMember) {
                socket.emit("message:error", {
                    message: "You are not a member of this conversation",
                });
                return;
            }
            socket.to(conversationId).emit("typing:stop", {
                conversationId,
                userId,
            });
            console.log(`User ${userId} stopped typing in ${conversationId}`);
        }
        catch (error) {
            console.error("typing:stop error:", error);
        }
    });
    // ==========================================
    // Disconnect
    // ==========================================
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
