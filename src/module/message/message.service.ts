import mongoose, { Types } from "mongoose";

import { MessageModel } from "./message.model";
import { ConversationModel } from "../conversation/conversation.model";
import { isConversationMember } from "../conversation/conversation.service";
import { IAttachment, IMessageReaction } from "./message.interface";
import { deleteMultipleMessageAttachments } from "./messageUpload.service";
import { invalidateUserConversationsCache } from "../../cache/cache.service";
import { UserModel } from "../user/user.model";
import { sendPushNotification } from "../notification/notification.service";
import { IUser } from "../user/user.interface";

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

export const createMessage = async (
  currentUserId: string,
  conversationId: string,
  text = "",
  replyTo?: string,
  attachments: IAttachment[] = [],
) => {
  // ==========================================
  // 1. Validate current user ID
  // ==========================================

  if (!mongoose.Types.ObjectId.isValid(currentUserId)) {
    throw new Error("Invalid current user ID");
  }

  // ==========================================
  // 2. Validate conversation ID
  // ==========================================

  if (!mongoose.Types.ObjectId.isValid(conversationId)) {
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

  const conversation = await ConversationModel.findOne({
    _id: new mongoose.Types.ObjectId(conversationId),

    participants: new mongoose.Types.ObjectId(currentUserId),
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
    const otherParticipantId = conversation.participants.find(
      (participantId) => participantId.toString() !== currentUserId,
    );

    if (!otherParticipantId) {
      throw new Error("Direct conversation participant not found");
    }

    const otherUser =
      await UserModel.findById(otherParticipantId).select("_id blockedUsers");

    if (!otherUser) {
      throw new Error("Other user not found");
    }

    const currentUser =
      await UserModel.findById(currentUserId).select("_id blockedUsers");

    if (!currentUser) {
      throw new Error("Current user not found");
    }

    // ------------------------------------------
    // Check:
    // Current user blocked the other user
    // ------------------------------------------

    const currentUserBlockedOther = currentUser.blockedUsers.some(
      (blockedUserId) =>
        blockedUserId.toString() === otherParticipantId.toString(),
    );


    // ------------------------------------------
    // Check:
    // Other user blocked the current user
    // ------------------------------------------

    const otherUserBlockedCurrent = otherUser.blockedUsers.some(
      (blockedUserId) => blockedUserId.toString() === currentUserId,
    );
    
    

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
    if (!mongoose.Types.ObjectId.isValid(replyTo)) {
      throw new Error("Invalid reply message ID");
    }

    const replyMessage = await MessageModel.findById(replyTo);

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

  const message = await MessageModel.create({
    conversationId: new mongoose.Types.ObjectId(conversationId),

    senderId: new mongoose.Types.ObjectId(currentUserId),

    // Can be empty for file/media-only messages
    text: trimmedText,

    // Attachments
    attachments,

    // Reply support
    replyTo: replyTo ? new mongoose.Types.ObjectId(replyTo) : null,
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

  await invalidateUserConversationsCache(
    conversation.participants.map((participantId) => participantId.toString()),
  );

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

  const recipients = await UserModel.find({
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

  const tokens = recipients.flatMap((user) =>
    user.pushTokens.map((item) => item.token),
  );

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

  const sender = message.senderId as unknown as IUser;

  if (tokens.length > 0) {
    void sendPushNotification({
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

export const getConversationMessages = async (
  currentUserId: string,
  conversationId: string,
  page = 1,
  limit = 30,
) => {
  // 1. Validate current user ID
  if (!mongoose.Types.ObjectId.isValid(currentUserId)) {
    throw new Error("Invalid current user ID");
  }

  // 2. Validate conversation ID
  if (!mongoose.Types.ObjectId.isValid(conversationId)) {
    throw new Error("Invalid conversation ID");
  }

  // 3. Find conversation and verify membership
  const conversation = await ConversationModel.findOne({
    _id: new mongoose.Types.ObjectId(conversationId),

    participants: new mongoose.Types.ObjectId(currentUserId),
  });

  if (!conversation) {
    throw new Error("Conversation not found or you are not a member");
  }

  // 4. Calculate pagination
  const skip = (page - 1) * limit;

  // 5. Fetch messages + total count together
  const [messages, total] = await Promise.all([
    MessageModel.find({
      conversationId: new mongoose.Types.ObjectId(conversationId),
    })
      .populate("senderId", "phone name avatar bio isOnline lastSeen")
      .sort({
        createdAt: -1,
      })
      .skip(skip)
      .limit(limit),

    MessageModel.countDocuments({
      conversationId: new mongoose.Types.ObjectId(conversationId),
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

export const markMessageAsDelivered = async (
  currentUserId: string,
  messageId: string,
) => {
  // 1. Validate IDs
  if (!mongoose.Types.ObjectId.isValid(currentUserId)) {
    throw new Error("Invalid current user ID");
  }

  if (!mongoose.Types.ObjectId.isValid(messageId)) {
    throw new Error("Invalid message ID");
  }

  // 2. Find message
  const message = await MessageModel.findById(messageId);

  if (!message) {
    throw new Error("Message not found");
  }

  // 3. Sender cannot mark own message as delivered
  if (message.senderId.toString() === currentUserId) {
    throw new Error("You cannot mark your own message as delivered");
  }

  // 4. Verify user is a conversation member
  const conversation = await ConversationModel.findOne({
    _id: message.conversationId,
    participants: new mongoose.Types.ObjectId(currentUserId),
  }).select("_id");

  if (!conversation) {
    throw new Error("You are not a member of this conversation");
  }

  // 5. Add user only once
  await MessageModel.findByIdAndUpdate(
    messageId,
    {
      $addToSet: {
        deliveredTo: new mongoose.Types.ObjectId(currentUserId),
      },
    },
    {
      new: true,
    },
  );

  // 6. Return delivery information
  return {
    messageId: message._id.toString(),
    conversationId: message.conversationId.toString(),
    userId: currentUserId,
    senderId: message.senderId.toString(),
  };
};

export const markMessageAsRead = async (
  currentUserId: string,
  messageId: string,
) => {
  // existing validation...

  const message = await MessageModel.findById(messageId);

  if (!message) {
    throw new Error("Message not found");
  }

  // Already read
  const alreadyRead = message.readBy.some(
    (userId) => userId.toString() === currentUserId,
  );

  if (!alreadyRead) {
    message.readBy.push(new mongoose.Types.ObjectId(currentUserId));

    await message.save();
  }

  // IMPORTANT: both users' conversation cache invalidate
  const conversation = await ConversationModel.findById(
    message.conversationId,
  ).select("participants");

  if (conversation) {
    await invalidateUserConversationsCache(
      conversation.participants.map((participantId) =>
        participantId.toString(),
      ),
    );
  }

  await message.populate("readBy", "phone name avatar");

  return message;
};

export const editMessage = async (
  currentUserId: string,
  messageId: string,
  text: string,
) => {
  // 1. Validate current user ID
  if (!mongoose.Types.ObjectId.isValid(currentUserId)) {
    throw new Error("Invalid current user ID");
  }

  // 2. Validate message ID
  if (!mongoose.Types.ObjectId.isValid(messageId)) {
    throw new Error("Invalid message ID");
  }

  // 3. Find message
  const message = await MessageModel.findById(messageId);

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

export const deleteMessage = async (
  currentUserId: string,
  messageId: string,
) => {
  // Validate current user ID
  if (!mongoose.Types.ObjectId.isValid(currentUserId)) {
    throw new Error("Invalid current user ID");
  }

  // Validate message ID
  if (!mongoose.Types.ObjectId.isValid(messageId)) {
    throw new Error("Invalid message ID");
  }

  // Find message
  const message = await MessageModel.findById(messageId);

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
    await deleteMultipleMessageAttachments(message.attachments);
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

const getReactionSummary = async (reactions: IMessageReaction[]) => {
  const userIds = [
    ...new Set(reactions.map((reaction) => reaction.userId.toString())),
  ];

  const users = await UserModel.find({
    _id: {
      $in: userIds,
    },
  }).select("_id name");

  const userMap = new Map(
    users.map((user) => [user._id.toString(), user.name]),
  );

  const reactionMap = new Map<
    string,
    {
      emoji: string;
      count: number;
      users: {
        userId: string;
        name: string;
      }[];
    }
  >();

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
    } else {
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

export const addReaction = async (
  userId: string,
  messageId: string,
  emoji: string,
) => {
  if (!Types.ObjectId.isValid(messageId)) {
    throw new Error("Invalid message ID");
  }

  if (!emoji?.trim()) {
    throw new Error("Emoji is required");
  }

  const message = await MessageModel.findById(messageId);

  if (!message) {
    throw new Error("Message not found");
  }

  if (message.isDeleted) {
    throw new Error("Cannot react to a deleted message");
  }

  const isMember = await isConversationMember(
    message.conversationId.toString(),
    userId,
  );

  if (!isMember) {
    throw new Error("You are not a member of this conversation");
  }

  const existingReactionIndex = message.reactions.findIndex(
    (reaction) =>
      reaction.userId.toString() === userId && reaction.emoji === emoji,
  );

  // Same emoji again = remove it
  if (existingReactionIndex !== -1) {
    message.reactions.splice(existingReactionIndex, 1);

    await message.save();

    return {
      action: "removed" as const,
      message,
      reactionSummary: await getReactionSummary(message.reactions),
    };
  }

  // Add new reaction
  message.reactions.push({
    userId: new Types.ObjectId(userId),
    emoji,
    createdAt: new Date(),
  });

  await message.save();

  return {
    action: "added" as const,
    message,
    reactionSummary: await getReactionSummary(message.reactions),
  };
};
