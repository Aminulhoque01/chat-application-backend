"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.addReaction = exports.deleteMessage = exports.editMessage = exports.markMessageAsRead = exports.markMessageAsDelivered = exports.getConversationMessages = exports.createMessage = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const message_model_1 = require("./message.model");
const conversation_model_1 = require("../conversation/conversation.model");
const conversation_service_1 = require("../conversation/conversation.service");
const messageUpload_service_1 = require("./messageUpload.service");
const cache_service_1 = require("../../cache/cache.service");
const user_model_1 = require("../user/user.model");
const notification_service_1 = require("../notification/notification.service");
// export const createMessage = async (
//   currentUserId: string,
//   conversationId: string,
//   text = "",
//   replyTo?: string,
//   attachments: IAttachment[] = [],
// ) => {
//   // 1. Validate current user ID
//   if (!mongoose.Types.ObjectId.isValid(currentUserId)) {
//     throw new Error("Invalid current user ID");
//   }
//   // 2. Validate conversation ID
//   if (!mongoose.Types.ObjectId.isValid(conversationId)) {
//     throw new Error("Invalid conversation ID");
//   }
//   // 3. Validate message content
//   const trimmedText = text.trim();
//   if (!trimmedText && attachments.length === 0) {
//     throw new Error("Message must contain text or attachment");
//   }
//   // 4. Find conversation and make sure
//   // current user is a participant
//   const conversation = await ConversationModel.findOne({
//     _id: new mongoose.Types.ObjectId(conversationId),
//     participants: new mongoose.Types.ObjectId(currentUserId),
//   });
//   if (!conversation) {
//     throw new Error("Conversation not found or you are not a member");
//   }
//   // 5. Validate reply message
//   if (replyTo) {
//     if (!mongoose.Types.ObjectId.isValid(replyTo)) {
//       throw new Error("Invalid reply message ID");
//     }
//     const replyMessage = await MessageModel.findById(replyTo);
//     if (!replyMessage) {
//       throw new Error("Reply message not found");
//     }
//     if (replyMessage.conversationId.toString() !== conversationId) {
//       throw new Error("Reply message belongs to another conversation");
//     }
//   }
//   // 6. Create message
//   const message = await MessageModel.create({
//     conversationId: new mongoose.Types.ObjectId(conversationId),
//     senderId: new mongoose.Types.ObjectId(currentUserId),
//     // Can be empty for file/media-only messages
//     text: trimmedText,
//     // Attachment support
//     attachments,
//     // Reply support
//     replyTo: replyTo ? new mongoose.Types.ObjectId(replyTo) : null,
//   });
//   // 7. Update conversation lastMessage
//   conversation.lastMessage = message._id;
//   await conversation.save();
//   // ==========================================
//   // Invalidate Redis conversation cache
//   // for all conversation participants
//   // ==========================================
//   await invalidateUserConversationsCache(
//     conversation.participants.map((participantId) => participantId.toString()),
//   );
//   // 8. Populate sender
//   await message.populate("senderId", "phone name avatar bio isOnline lastSeen");
//   // 9. Populate reply message
//   await message.populate({
//     path: "replyTo",
//     select: "text senderId isDeleted createdAt attachments",
//     populate: {
//       path: "senderId",
//       select: "name avatar",
//     },
//   });
//   // 10. Get recipient IDs
//   const recipientIds = conversation.participants
//     .map((participantId) => participantId.toString())
//     .filter((participantId) => participantId !== currentUserId);
//   // 11. Get recipients with push tokens
//   const recipients = await UserModel.find({
//     _id: {
//       $in: recipientIds,
//     },
//     "pushTokens.0": {
//       $exists: true,
//     },
//   }).select("pushTokens");
//   // 12. Collect all FCM tokens
//   const tokens = recipients.flatMap((user) =>
//     user.pushTokens.map((item) => item.token),
//   );
//   // 13. Prepare notification body
//   let notificationBody = trimmedText;
//   if (!notificationBody && attachments.length > 0) {
//     const firstAttachment = attachments[0];
//     switch (firstAttachment.type) {
//       case "image":
//         notificationBody = "📷 Sent an image";
//         break;
//       case "video":
//         notificationBody = "🎥 Sent a video";
//         break;
//       case "audio":
//         notificationBody = "🎤 Sent a voice message";
//         break;
//       default:
//         notificationBody = "📎 Sent a file";
//     }
//   }
//   // 14. Send push notification
//   const sender = message.senderId as unknown as IUser;
//   if (tokens.length > 0) {
//     void sendPushNotification({
//       tokens,
//       title: sender.name,
//       body: notificationBody,
//       data: {
//         type: "new_message",
//         conversationId: conversationId,
//         messageId: message._id.toString(),
//       },
//     });
//   }
//   return message;
// };
const createMessage = async (currentUserId, conversationId, text = "", replyTo, attachments = []) => {
    // ==========================================
    // 1. Validate current user ID
    // ==========================================
    if (!mongoose_1.default.Types.ObjectId.isValid(currentUserId)) {
        throw new Error("Invalid current user ID");
    }
    // ==========================================
    // 2. Validate conversation ID
    // ==========================================
    if (!mongoose_1.default.Types.ObjectId.isValid(conversationId)) {
        throw new Error("Invalid conversation ID");
    }
    // ==========================================
    // 3. Validate message content
    // ==========================================
    const trimmedText = text.trim();
    if (!trimmedText && attachments.length === 0) {
        throw new Error("Message must contain text or attachment");
    }
    // ==========================================
    // 4. Find conversation
    //    Make sure current user is a participant
    // ==========================================
    const conversation = await conversation_model_1.ConversationModel.findOne({
        _id: new mongoose_1.default.Types.ObjectId(conversationId),
        participants: new mongoose_1.default.Types.ObjectId(currentUserId),
    });
    if (!conversation) {
        throw new Error("Conversation not found or you are not a member");
    }
    // ==========================================
    // 5. Check block status
    //
    // Only apply blocking rules to DIRECT chats.
    //
    // If:
    // A blocks B
    // OR
    // B blocks A
    //
    // Then neither user can send a message.
    // ==========================================
    if (conversation.type === "direct") {
        const otherParticipantId = conversation.participants.find((participantId) => participantId.toString() !== currentUserId);
        if (!otherParticipantId) {
            throw new Error("Direct conversation participant not found");
        }
        const otherUser = await user_model_1.UserModel.findById(otherParticipantId).select("_id blockedUsers");
        if (!otherUser) {
            throw new Error("Other user not found");
        }
        const currentUser = await user_model_1.UserModel.findById(currentUserId).select("_id blockedUsers");
        if (!currentUser) {
            throw new Error("Current user not found");
        }
        // ------------------------------------------
        // Check:
        // Current user blocked the other user
        // ------------------------------------------
        const currentUserBlockedOther = currentUser.blockedUsers.some((blockedUserId) => blockedUserId.toString() === otherParticipantId.toString());
        // ------------------------------------------
        // Check:
        // Other user blocked the current user
        // ------------------------------------------
        const otherUserBlockedCurrent = otherUser.blockedUsers.some((blockedUserId) => blockedUserId.toString() === currentUserId);
        // ------------------------------------------
        // Block messaging if either side blocked
        // ------------------------------------------
        if (currentUserBlockedOther || otherUserBlockedCurrent) {
            throw new Error("You cannot send messages because this user is blocked");
        }
    }
    // ==========================================
    // 6. Validate reply message
    // ==========================================
    if (replyTo) {
        if (!mongoose_1.default.Types.ObjectId.isValid(replyTo)) {
            throw new Error("Invalid reply message ID");
        }
        const replyMessage = await message_model_1.MessageModel.findById(replyTo);
        if (!replyMessage) {
            throw new Error("Reply message not found");
        }
        if (replyMessage.conversationId.toString() !== conversationId) {
            throw new Error("Reply message belongs to another conversation");
        }
    }
    // ==========================================
    // 7. Create message
    // ==========================================
    const message = await message_model_1.MessageModel.create({
        conversationId: new mongoose_1.default.Types.ObjectId(conversationId),
        senderId: new mongoose_1.default.Types.ObjectId(currentUserId),
        // Can be empty for file/media-only messages
        text: trimmedText,
        // Attachments
        attachments,
        // Reply support
        replyTo: replyTo ? new mongoose_1.default.Types.ObjectId(replyTo) : null,
    });
    // ==========================================
    // 8. Update conversation lastMessage
    // ==========================================
    conversation.lastMessage = message._id;
    await conversation.save();
    // ==========================================
    // 9. Invalidate Redis conversation cache
    //    for all conversation participants
    // ==========================================
    await (0, cache_service_1.invalidateUserConversationsCache)(conversation.participants.map((participantId) => participantId.toString()));
    // ==========================================
    // 10. Populate sender
    // ==========================================
    await message.populate("senderId", "phone name avatar bio isOnline lastSeen");
    // ==========================================
    // 11. Populate reply message
    // ==========================================
    await message.populate({
        path: "replyTo",
        select: "text senderId isDeleted createdAt attachments",
        populate: {
            path: "senderId",
            select: "name avatar",
        },
    });
    // ==========================================
    // 12. Get recipient IDs
    // ==========================================
    const recipientIds = conversation.participants
        .map((participantId) => participantId.toString())
        .filter((participantId) => participantId !== currentUserId);
    // ==========================================
    // 13. Get recipients with push tokens
    // ==========================================
    const recipients = await user_model_1.UserModel.find({
        _id: {
            $in: recipientIds,
        },
        "pushTokens.0": {
            $exists: true,
        },
    }).select("pushTokens");
    // ==========================================
    // 14. Collect all FCM tokens
    // ==========================================
    const tokens = recipients.flatMap((user) => user.pushTokens.map((item) => item.token));
    // ==========================================
    // 15. Prepare notification body
    // ==========================================
    let notificationBody = trimmedText;
    if (!notificationBody && attachments.length > 0) {
        const firstAttachment = attachments[0];
        switch (firstAttachment.type) {
            case "image":
                notificationBody = "📷 Sent an image";
                break;
            case "video":
                notificationBody = "🎥 Sent a video";
                break;
            case "audio":
                notificationBody = "🎤 Sent a voice message";
                break;
            default:
                notificationBody = "📎 Sent a file";
        }
    }
    // ==========================================
    // 16. Send push notification
    // ==========================================
    const sender = message.senderId;
    if (tokens.length > 0) {
        void (0, notification_service_1.sendPushNotification)({
            tokens,
            title: sender.name,
            body: notificationBody,
            data: {
                type: "new_message",
                conversationId: conversationId,
                messageId: message._id.toString(),
            },
        });
    }
    // ==========================================
    // 17. Return message
    // ==========================================
    return message;
};
exports.createMessage = createMessage;
const getConversationMessages = async (currentUserId, conversationId, page = 1, limit = 30) => {
    // 1. Validate current user ID
    if (!mongoose_1.default.Types.ObjectId.isValid(currentUserId)) {
        throw new Error("Invalid current user ID");
    }
    // 2. Validate conversation ID
    if (!mongoose_1.default.Types.ObjectId.isValid(conversationId)) {
        throw new Error("Invalid conversation ID");
    }
    // 3. Find conversation and verify membership
    const conversation = await conversation_model_1.ConversationModel.findOne({
        _id: new mongoose_1.default.Types.ObjectId(conversationId),
        participants: new mongoose_1.default.Types.ObjectId(currentUserId),
    });
    if (!conversation) {
        throw new Error("Conversation not found or you are not a member");
    }
    // 4. Calculate pagination
    const skip = (page - 1) * limit;
    // 5. Fetch messages + total count together
    const [messages, total] = await Promise.all([
        message_model_1.MessageModel.find({
            conversationId: new mongoose_1.default.Types.ObjectId(conversationId),
        })
            .populate("senderId", "phone name avatar bio isOnline lastSeen")
            .sort({
            createdAt: -1,
        })
            .skip(skip)
            .limit(limit),
        message_model_1.MessageModel.countDocuments({
            conversationId: new mongoose_1.default.Types.ObjectId(conversationId),
        }),
    ]);
    // 6. Reverse for chat UI
    // DB gives newest → oldest
    // Response gives oldest → newest
    messages.reverse();
    // 7. Pagination information
    const totalPages = Math.ceil(total / limit);
    return {
        messages,
        pagination: {
            page,
            limit,
            total,
            totalPages,
            hasNextPage: page < totalPages,
            hasPreviousPage: page > 1,
        },
    };
};
exports.getConversationMessages = getConversationMessages;
const markMessageAsDelivered = async (currentUserId, messageId) => {
    // 1. Validate IDs
    if (!mongoose_1.default.Types.ObjectId.isValid(currentUserId)) {
        throw new Error("Invalid current user ID");
    }
    if (!mongoose_1.default.Types.ObjectId.isValid(messageId)) {
        throw new Error("Invalid message ID");
    }
    // 2. Find message
    const message = await message_model_1.MessageModel.findById(messageId);
    if (!message) {
        throw new Error("Message not found");
    }
    // 3. Sender cannot mark own message as delivered
    if (message.senderId.toString() === currentUserId) {
        throw new Error("You cannot mark your own message as delivered");
    }
    // 4. Verify user is a conversation member
    const conversation = await conversation_model_1.ConversationModel.findOne({
        _id: message.conversationId,
        participants: new mongoose_1.default.Types.ObjectId(currentUserId),
    }).select("_id");
    if (!conversation) {
        throw new Error("You are not a member of this conversation");
    }
    // 5. Add user only once
    await message_model_1.MessageModel.findByIdAndUpdate(messageId, {
        $addToSet: {
            deliveredTo: new mongoose_1.default.Types.ObjectId(currentUserId),
        },
    }, {
        new: true,
    });
    // 6. Return delivery information
    return {
        messageId: message._id.toString(),
        conversationId: message.conversationId.toString(),
        userId: currentUserId,
        senderId: message.senderId.toString(),
    };
};
exports.markMessageAsDelivered = markMessageAsDelivered;
const markMessageAsRead = async (currentUserId, messageId) => {
    // existing validation...
    const message = await message_model_1.MessageModel.findById(messageId);
    if (!message) {
        throw new Error("Message not found");
    }
    // Already read
    const alreadyRead = message.readBy.some((userId) => userId.toString() === currentUserId);
    if (!alreadyRead) {
        message.readBy.push(new mongoose_1.default.Types.ObjectId(currentUserId));
        await message.save();
    }
    // IMPORTANT: both users' conversation cache invalidate
    const conversation = await conversation_model_1.ConversationModel.findById(message.conversationId).select("participants");
    if (conversation) {
        await (0, cache_service_1.invalidateUserConversationsCache)(conversation.participants.map((participantId) => participantId.toString()));
    }
    await message.populate("readBy", "phone name avatar");
    return message;
};
exports.markMessageAsRead = markMessageAsRead;
const editMessage = async (currentUserId, messageId, text) => {
    // 1. Validate current user ID
    if (!mongoose_1.default.Types.ObjectId.isValid(currentUserId)) {
        throw new Error("Invalid current user ID");
    }
    // 2. Validate message ID
    if (!mongoose_1.default.Types.ObjectId.isValid(messageId)) {
        throw new Error("Invalid message ID");
    }
    // 3. Find message
    const message = await message_model_1.MessageModel.findById(messageId);
    if (!message) {
        throw new Error("Message not found");
    }
    // 4. Only sender can edit
    if (message.senderId.toString() !== currentUserId) {
        throw new Error("You can only edit your own message");
    }
    // 5. Cannot edit deleted message
    if (message.isDeleted) {
        throw new Error("Cannot edit a deleted message");
    }
    // 6. Validate text
    const trimmedText = text.trim();
    if (!trimmedText) {
        throw new Error("Message text cannot be empty");
    }
    // 7. Update message
    message.text = trimmedText;
    message.isEdited = true;
    await message.save();
    // 8. Populate sender
    await message.populate("senderId", "phone name avatar bio isOnline lastSeen");
    return message;
};
exports.editMessage = editMessage;
const deleteMessage = async (currentUserId, messageId) => {
    // Validate current user ID
    if (!mongoose_1.default.Types.ObjectId.isValid(currentUserId)) {
        throw new Error("Invalid current user ID");
    }
    // Validate message ID
    if (!mongoose_1.default.Types.ObjectId.isValid(messageId)) {
        throw new Error("Invalid message ID");
    }
    // Find message
    const message = await message_model_1.MessageModel.findById(messageId);
    if (!message) {
        throw new Error("Message not found");
    }
    // Check ownership
    if (message.senderId.toString() !== currentUserId) {
        throw new Error("You can only delete your own messages");
    }
    // Prevent duplicate deletion
    if (message.isDeleted) {
        throw new Error("Message is already deleted");
    }
    // =====================================
    // Delete attachments from Cloudinary
    // =====================================
    if (message.attachments && message.attachments.length > 0) {
        await (0, messageUpload_service_1.deleteMultipleMessageAttachments)(message.attachments);
    }
    // =====================================
    // Soft delete message
    // =====================================
    message.isDeleted = true;
    message.deletedAt = new Date();
    // Hide original text
    message.text = "";
    // Remove attachments from MongoDB
    message.attachments = [];
    await message.save();
    return {
        messageId: message._id.toString(),
        conversationId: message.conversationId.toString(),
        isDeleted: true,
        deletedAt: message.deletedAt,
    };
};
exports.deleteMessage = deleteMessage;
const getReactionSummary = async (reactions) => {
    const userIds = [
        ...new Set(reactions.map((reaction) => reaction.userId.toString())),
    ];
    const users = await user_model_1.UserModel.find({
        _id: {
            $in: userIds,
        },
    }).select("_id name");
    const userMap = new Map(users.map((user) => [user._id.toString(), user.name]));
    const reactionMap = new Map();
    for (const reaction of reactions) {
        const emoji = reaction.emoji;
        const userId = reaction.userId.toString();
        const name = userMap.get(userId) ?? "Unknown User";
        const existing = reactionMap.get(emoji);
        if (existing) {
            existing.count += 1;
            existing.users.push({
                userId,
                name,
            });
        }
        else {
            reactionMap.set(emoji, {
                emoji,
                count: 1,
                users: [
                    {
                        userId,
                        name,
                    },
                ],
            });
        }
    }
    return Array.from(reactionMap.values());
};
const addReaction = async (userId, messageId, emoji) => {
    if (!mongoose_1.Types.ObjectId.isValid(messageId)) {
        throw new Error("Invalid message ID");
    }
    if (!emoji?.trim()) {
        throw new Error("Emoji is required");
    }
    const message = await message_model_1.MessageModel.findById(messageId);
    if (!message) {
        throw new Error("Message not found");
    }
    if (message.isDeleted) {
        throw new Error("Cannot react to a deleted message");
    }
    const isMember = await (0, conversation_service_1.isConversationMember)(message.conversationId.toString(), userId);
    if (!isMember) {
        throw new Error("You are not a member of this conversation");
    }
    const existingReactionIndex = message.reactions.findIndex((reaction) => reaction.userId.toString() === userId && reaction.emoji === emoji);
    // Same emoji again = remove it
    if (existingReactionIndex !== -1) {
        message.reactions.splice(existingReactionIndex, 1);
        await message.save();
        return {
            action: "removed",
            message,
            reactionSummary: await getReactionSummary(message.reactions),
        };
    }
    // Add new reaction
    message.reactions.push({
        userId: new mongoose_1.Types.ObjectId(userId),
        emoji,
        createdAt: new Date(),
    });
    await message.save();
    return {
        action: "added",
        message,
        reactionSummary: await getReactionSummary(message.reactions),
    };
};
exports.addReaction = addReaction;
