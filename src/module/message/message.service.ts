// import mongoose, { Types } from "mongoose";

// import { MessageModel } from "./message.model";
// import { ConversationModel } from "../conversation/conversation.model";
// import { isConversationMember } from "../conversation/conversation.service";
// import { IAttachment, IMessageReaction } from "./message.interface";
// import { deleteMultipleMessageAttachments } from "./messageUpload.service";
// import { invalidateUserConversationsCache } from "../../cache/cache.service";
// import { UserModel } from "../user/user.model";
// import { sendPushNotification } from "../notification/notification.service";
// import { IUser } from "../user/user.interface";
// import { BlockModel } from "../block/block.model";

 
 
// export const createMessage = async (
//   currentUserId: string,
//   conversationId: string,
//   text = "",
//   replyTo?: string,
//   attachments: IAttachment[] = [],
// ) => {
//   // ==========================================
//   // 1. Validate current user ID
//   // ==========================================

//   if (
//     !mongoose.Types.ObjectId.isValid(
//       currentUserId,
//     )
//   ) {
//     throw new Error(
//       "Invalid current user ID",
//     );
//   }

//   // ==========================================
//   // 2. Validate conversation ID
//   // ==========================================

//   if (
//     !mongoose.Types.ObjectId.isValid(
//       conversationId,
//     )
//   ) {
//     throw new Error(
//       "Invalid conversation ID",
//     );
//   }

//   // ==========================================
//   // 3. Validate message content
//   // ==========================================

//   const trimmedText =
//     text?.trim() ?? "";

//   if (
//     !trimmedText &&
//     attachments.length === 0
//   ) {
//     throw new Error(
//       "Message must contain text or attachment",
//     );
//   }

//   // ==========================================
//   // 4. Find conversation
//   //
//   // Make sure current user is a participant
//   // ==========================================

//   const conversation =
//     await ConversationModel.findOne({
//       _id:
//         new mongoose.Types.ObjectId(
//           conversationId,
//         ),

//       participants:
//         new mongoose.Types.ObjectId(
//           currentUserId,
//         ),
//     });

//   if (!conversation) {
//     throw new Error(
//       "Conversation not found or you are not a member",
//     );
//   }

//   // ==========================================
//   // 5. Check block status
//   //
//   // ONLY direct conversations
//   //
//   // Example:
//   //
//   // A blocks B
//   //
//   // Block document:
//   //
//   // blockerId = A
//   // blockedId = B
//   //
//   // In this situation:
//   //
//   // A -> B message ❌
//   // B -> A message ❌
//   //
//   // Group conversations are NOT blocked here.
//   // ==========================================

//   if (
//     conversation.type ===
//     "direct"
//   ) {
//     const otherParticipantId =
//       conversation.participants.find(
//         (participantId) =>
//           participantId.toString() !==
//           currentUserId,
//       );

//     if (
//       !otherParticipantId
//     ) {
//       throw new Error(
//         "Direct conversation participant not found",
//       );
//     }

//     const currentUserObjectId =
//       new mongoose.Types.ObjectId(
//         currentUserId,
//       );

//     const otherUserObjectId =
//       new mongoose.Types.ObjectId(
//         otherParticipantId.toString(),
//       );

//     // ========================================
//     // Check both directions
//     //
//     // 1. Current user blocked other user
//     //
//     // 2. Other user blocked current user
//     // ========================================

//     const blockExists =
//       await BlockModel.exists({
//         $or: [
//           {
//             blockerId:
//               currentUserObjectId,

//             blockedId:
//               otherUserObjectId,
//           },

//           {
//             blockerId:
//               otherUserObjectId,

//             blockedId:
//               currentUserObjectId,
//           },
//         ],
//       });

//     // ========================================
//     // Block exists
//     // ========================================

//     if (blockExists) {
//       throw new Error(
//         "You cannot send messages because this user is blocked",
//       );
//     }
//   }

//   // ==========================================
//   // 6. Validate reply message
//   // ==========================================

//   if (replyTo) {
//     // ----------------------------------------
//     // Validate reply message ID
//     // ----------------------------------------

//     if (
//       !mongoose.Types.ObjectId.isValid(
//         replyTo,
//       )
//     ) {
//       throw new Error(
//         "Invalid reply message ID",
//       );
//     }

//     // ----------------------------------------
//     // Find reply message
//     // ----------------------------------------

//     const replyMessage =
//       await MessageModel.findById(
//         replyTo,
//       );

//     if (!replyMessage) {
//       throw new Error(
//         "Reply message not found",
//       );
//     }

//     // ----------------------------------------
//     // Make sure reply belongs to
//     // same conversation
//     // ----------------------------------------

//     if (
//       replyMessage.conversationId.toString() !==
//       conversationId
//     ) {
//       throw new Error(
//         "Reply message belongs to another conversation",
//       );
//     }
//   }

//   // ==========================================
//   // 7. Create message
//   // ==========================================

//   const message =
//     await MessageModel.create({
//       conversationId:
//         new mongoose.Types.ObjectId(
//           conversationId,
//         ),

//       senderId:
//         new mongoose.Types.ObjectId(
//           currentUserId,
//         ),

//       // Text can be empty when
//       // message contains attachment
//       text: trimmedText,

//       // Attachments
//       attachments,

//       // Reply message
//       replyTo: replyTo
//         ? new mongoose.Types.ObjectId(
//             replyTo,
//           )
//         : null,
//     });

//   // ==========================================
//   // 8. Update conversation last message
//   // ==========================================

//   conversation.lastMessage =
//     message._id;

//   await conversation.save();

//   // ==========================================
//   // 9. Invalidate conversation cache
//   // for all participants
//   // ==========================================

//   await invalidateUserConversationsCache(
//     conversation.participants.map(
//       (participantId) =>
//         participantId.toString(),
//     ),
//   );

//   // ==========================================
//   // 10. Populate sender
//   // ==========================================

//   await message.populate(
//     "senderId",
//     "phone name avatar bio isOnline lastSeen",
//   );

//   // ==========================================
//   // 11. Populate reply message
//   // ==========================================

//   await message.populate({
//     path: "replyTo",

//     select:
//       "text senderId isDeleted createdAt attachments",

//     populate: {
//       path: "senderId",

//       select:
//         "name avatar",
//     },
//   });

//   // ==========================================
//   // 12. Get recipient IDs
//   // ==========================================

//   const recipientIds =
//     conversation.participants
//       .map(
//         (participantId) =>
//           participantId.toString(),
//       )
//       .filter(
//         (participantId) =>
//           participantId !==
//           currentUserId,
//       );

//   // ==========================================
//   // 13. Find recipients with push tokens
//   // ==========================================

//   const recipients =
//     await UserModel.find({
//       _id: {
//         $in: recipientIds,
//       },

//       "pushTokens.0": {
//         $exists: true,
//       },
//     }).select(
//       "pushTokens",
//     );

//   // ==========================================
//   // 14. Collect FCM tokens
//   // ==========================================

//   const tokens =
//     recipients.flatMap(
//       (user) =>
//         user.pushTokens.map(
//           (item) =>
//             item.token,
//         ),
//     );

//   // ==========================================
//   // 15. Prepare notification body
//   // ==========================================

//   let notificationBody =
//     trimmedText;

//   if (
//     !notificationBody &&
//     attachments.length > 0
//   ) {
//     const firstAttachment =
//       attachments[0];

//     switch (
//       firstAttachment.type
//     ) {
//       case "image":
//         notificationBody =
//           "📷 Sent an image";
//         break;

//       case "video":
//         notificationBody =
//           "🎥 Sent a video";
//         break;

//       case "audio":
//         notificationBody =
//           "🎤 Sent a voice message";
//         break;

//       default:
//         notificationBody =
//           "📎 Sent a file";
//         break;
//     }
//   }

//   // ==========================================
//   // 16. Send push notification
//   // ==========================================

//   const sender =
//     message.senderId as unknown as IUser;

//   if (
//     tokens.length > 0
//   ) {
//     void sendPushNotification({
//       tokens,

//       title:
//         sender.name,

//       body:
//         notificationBody,

//       data: {
//         type:
//           "new_message",

//         conversationId:
//           conversationId,

//         messageId:
//           message._id.toString(),
//       },
//     });
//   }

//   // ==========================================
//   // 17. Return message
//   // ==========================================

//   return message;
// };



// export const getConversationMessages = async (
//   currentUserId: string,
//   conversationId: string,
//   page = 1,
//   limit = 30,
// ) => {
//   // 1. Validate current user ID
//   if (!mongoose.Types.ObjectId.isValid(currentUserId)) {
//     throw new Error("Invalid current user ID");
//   }

//   // 2. Validate conversation ID
//   if (!mongoose.Types.ObjectId.isValid(conversationId)) {
//     throw new Error("Invalid conversation ID");
//   }

//   // 3. Find conversation and verify membership
//   const conversation = await ConversationModel.findOne({
//     _id: new mongoose.Types.ObjectId(conversationId),

//     participants: new mongoose.Types.ObjectId(currentUserId),
//   });

//   if (!conversation) {
//     throw new Error("Conversation not found or you are not a member");
//   }

//   // 4. Calculate pagination
//   const skip = (page - 1) * limit;

//   // 5. Fetch messages + total count together
//   const [messages, total] = await Promise.all([
//     MessageModel.find({
//       conversationId: new mongoose.Types.ObjectId(conversationId),
//     })
//       .populate("senderId", "phone name avatar bio isOnline lastSeen")
//       .sort({
//         createdAt: -1,
//       })
//       .skip(skip)
//       .limit(limit),

//     MessageModel.countDocuments({
//       conversationId: new mongoose.Types.ObjectId(conversationId),
//     }),
//   ]);

//   // 6. Reverse for chat UI
//   // DB gives newest → oldest
//   // Response gives oldest → newest
//   messages.reverse();

//   // 7. Pagination information
//   const totalPages = Math.ceil(total / limit);

//   return {
//     messages,

//     pagination: {
//       page,
//       limit,
//       total,
//       totalPages,

//       hasNextPage: page < totalPages,

//       hasPreviousPage: page > 1,
//     },
//   };
// };

// export const markMessageAsDelivered = async (
//   currentUserId: string,
//   messageId: string,
// ) => {
//   // 1. Validate IDs
//   if (!mongoose.Types.ObjectId.isValid(currentUserId)) {
//     throw new Error("Invalid current user ID");
//   }

//   if (!mongoose.Types.ObjectId.isValid(messageId)) {
//     throw new Error("Invalid message ID");
//   }

//   // 2. Find message
//   const message = await MessageModel.findById(messageId);

//   if (!message) {
//     throw new Error("Message not found");
//   }

//   // 3. Sender cannot mark own message as delivered
//   if (message.senderId.toString() === currentUserId) {
//     throw new Error("You cannot mark your own message as delivered");
//   }

//   // 4. Verify user is a conversation member
//   const conversation = await ConversationModel.findOne({
//     _id: message.conversationId,
//     participants: new mongoose.Types.ObjectId(currentUserId),
//   }).select("_id");

//   if (!conversation) {
//     throw new Error("You are not a member of this conversation");
//   }

//   // 5. Add user only once
//   await MessageModel.findByIdAndUpdate(
//     messageId,
//     {
//       $addToSet: {
//         deliveredTo: new mongoose.Types.ObjectId(currentUserId),
//       },
//     },
//     {
//       new: true,
//     },
//   );

//   // 6. Return delivery information
//   return {
//     messageId: message._id.toString(),
//     conversationId: message.conversationId.toString(),
//     userId: currentUserId,
//     senderId: message.senderId.toString(),
//   };
// };

// export const markMessageAsRead = async (
//   currentUserId: string,
//   messageId: string,
// ) => {
//   // existing validation...

//   const message = await MessageModel.findById(messageId);

//   if (!message) {
//     throw new Error("Message not found");
//   }

//   // Already read
//   const alreadyRead = message.readBy.some(
//     (userId) => userId.toString() === currentUserId,
//   );

//   if (!alreadyRead) {
//     message.readBy.push(new mongoose.Types.ObjectId(currentUserId));

//     await message.save();
//   }

//   // IMPORTANT: both users' conversation cache invalidate
//   const conversation = await ConversationModel.findById(
//     message.conversationId,
//   ).select("participants");

//   if (conversation) {
//     await invalidateUserConversationsCache(
//       conversation.participants.map((participantId) =>
//         participantId.toString(),
//       ),
//     );
//   }

//   await message.populate("readBy", "phone name avatar");

//   return message;
// };

// export const editMessage = async (
//   currentUserId: string,
//   messageId: string,
//   text: string,
// ) => {
//   // 1. Validate current user ID
//   if (!mongoose.Types.ObjectId.isValid(currentUserId)) {
//     throw new Error("Invalid current user ID");
//   }

//   // 2. Validate message ID
//   if (!mongoose.Types.ObjectId.isValid(messageId)) {
//     throw new Error("Invalid message ID");
//   }

//   // 3. Find message
//   const message = await MessageModel.findById(messageId);

//   if (!message) {
//     throw new Error("Message not found");
//   }

//   // 4. Only sender can edit
//   if (message.senderId.toString() !== currentUserId) {
//     throw new Error("You can only edit your own message");
//   }

//   // 5. Cannot edit deleted message
//   if (message.isDeleted) {
//     throw new Error("Cannot edit a deleted message");
//   }

//   // 6. Validate text
//   const trimmedText = text.trim();

//   if (!trimmedText) {
//     throw new Error("Message text cannot be empty");
//   }

//   // 7. Update message
//   message.text = trimmedText;
//   message.isEdited = true;

//   await message.save();

//   // 8. Populate sender
//   await message.populate("senderId", "phone name avatar bio isOnline lastSeen");

//   return message;
// };

// export const deleteMessage = async (
//   currentUserId: string,
//   messageId: string,
// ) => {
//   // Validate current user ID
//   if (!mongoose.Types.ObjectId.isValid(currentUserId)) {
//     throw new Error("Invalid current user ID");
//   }

//   // Validate message ID
//   if (!mongoose.Types.ObjectId.isValid(messageId)) {
//     throw new Error("Invalid message ID");
//   }

//   // Find message
//   const message = await MessageModel.findById(messageId);

//   if (!message) {
//     throw new Error("Message not found");
//   }

//   // Check ownership
//   if (message.senderId.toString() !== currentUserId) {
//     throw new Error("You can only delete your own messages");
//   }

//   // Prevent duplicate deletion
//   if (message.isDeleted) {
//     throw new Error("Message is already deleted");
//   }

//   // =====================================
//   // Delete attachments from Cloudinary
//   // =====================================
//   if (message.attachments && message.attachments.length > 0) {
//     await deleteMultipleMessageAttachments(message.attachments);
//   }

//   // =====================================
//   // Soft delete message
//   // =====================================
//   message.isDeleted = true;

//   message.deletedAt = new Date();

//   // Hide original text
//   message.text = "";

//   // Remove attachments from MongoDB
//   message.attachments = [];

//   await message.save();

//   return {
//     messageId: message._id.toString(),

//     conversationId: message.conversationId.toString(),

//     isDeleted: true,

//     deletedAt: message.deletedAt,
//   };
// };

// const getReactionSummary = async (reactions: IMessageReaction[]) => {
//   const userIds = [
//     ...new Set(reactions.map((reaction) => reaction.userId.toString())),
//   ];

//   const users = await UserModel.find({
//     _id: {
//       $in: userIds,
//     },
//   }).select("_id name");

//   const userMap = new Map(
//     users.map((user) => [user._id.toString(), user.name]),
//   );

//   const reactionMap = new Map<
//     string,
//     {
//       emoji: string;
//       count: number;
//       users: {
//         userId: string;
//         name: string;
//       }[];
//     }
//   >();

//   for (const reaction of reactions) {
//     const emoji = reaction.emoji;

//     const userId = reaction.userId.toString();

//     const name = userMap.get(userId) ?? "Unknown User";

//     const existing = reactionMap.get(emoji);

//     if (existing) {
//       existing.count += 1;

//       existing.users.push({
//         userId,
//         name,
//       });
//     } else {
//       reactionMap.set(emoji, {
//         emoji,

//         count: 1,

//         users: [
//           {
//             userId,
//             name,
//           },
//         ],
//       });
//     }
//   }

//   return Array.from(reactionMap.values());
// };

// export const addReaction = async (
//   userId: string,
//   messageId: string,
//   emoji: string,
// ) => {
//   if (!Types.ObjectId.isValid(messageId)) {
//     throw new Error("Invalid message ID");
//   }

//   if (!emoji?.trim()) {
//     throw new Error("Emoji is required");
//   }

//   const message = await MessageModel.findById(messageId);

//   if (!message) {
//     throw new Error("Message not found");
//   }

//   if (message.isDeleted) {
//     throw new Error("Cannot react to a deleted message");
//   }

//   const isMember = await isConversationMember(
//     message.conversationId.toString(),
//     userId,
//   );

//   if (!isMember) {
//     throw new Error("You are not a member of this conversation");
//   }

//   const existingReactionIndex = message.reactions.findIndex(
//     (reaction) =>
//       reaction.userId.toString() === userId && reaction.emoji === emoji,
//   );

//   // Same emoji again = remove it
//   if (existingReactionIndex !== -1) {
//     message.reactions.splice(existingReactionIndex, 1);

//     await message.save();

//     return {
//       action: "removed" as const,
//       message,
//       reactionSummary: await getReactionSummary(message.reactions),
//     };
//   }

//   // Add new reaction
//   message.reactions.push({
//     userId: new Types.ObjectId(userId),
//     emoji,
//     createdAt: new Date(),
//   });

//   await message.save();

//   return {
//     action: "added" as const,
//     message,
//     reactionSummary: await getReactionSummary(message.reactions),
//   };
// };





import mongoose, { Types } from "mongoose";

import { MessageModel } from "./message.model";
import { ConversationModel } from "../conversation/conversation.model";
import { isConversationMember } from "../conversation/conversation.service";
import {
  IAttachment,
  IMessageReaction,
} from "./message.interface";
import { deleteMultipleMessageAttachments } from "./messageUpload.service";
import { invalidateUserConversationsCache } from "../../cache/cache.service";
import { UserModel } from "../user/user.model";
import { sendPushNotification } from "../notification/notification.service";
import { IUser } from "../user/user.interface";
import { BlockModel } from "../block/block.model";

/**
 * ============================================================
 * Helper: Check whether two users are blocked in a
 * direct conversation.
 *
 * Block relationship is one-way in database:
 *
 * blockerId = A
 * blockedId = B
 *
 * But messaging interaction is blocked in BOTH directions:
 *
 * A -> B ❌
 * B -> A ❌
 *
 * Group conversations are NOT affected.
 * ============================================================
 */
const isDirectConversationBlocked = async (
  conversationId: string,
  currentUserId: string,
): Promise<boolean> => {
  // ------------------------------------------
  // Validate IDs
  // ------------------------------------------

  if (!Types.ObjectId.isValid(conversationId)) {
    throw new Error("Invalid conversation ID");
  }

  if (!Types.ObjectId.isValid(currentUserId)) {
    throw new Error("Invalid current user ID");
  }

  // ------------------------------------------
  // Find conversation
  // ------------------------------------------

  const conversation =
    await ConversationModel.findOne({
      _id: new Types.ObjectId(conversationId),

      participants: new Types.ObjectId(
        currentUserId,
      ),
    }).select("type participants");

  if (!conversation) {
    throw new Error(
      "Conversation not found or you are not a member",
    );
  }

  // ------------------------------------------
  // Group conversations are not blocked
  // ------------------------------------------

  if (conversation.type !== "direct") {
    return false;
  }

  // ------------------------------------------
  // Find other participant
  // ------------------------------------------

  const otherParticipantId =
    conversation.participants.find(
      (participantId) =>
        participantId.toString() !==
        currentUserId,
    );

  if (!otherParticipantId) {
    throw new Error(
      "Direct conversation participant not found",
    );
  }

  const currentUserObjectId =
    new Types.ObjectId(currentUserId);

  const otherUserObjectId =
    new Types.ObjectId(
      otherParticipantId.toString(),
    );

  // ------------------------------------------
  // Check both block directions
  // ------------------------------------------

  const blockExists =
    await BlockModel.exists({
      $or: [
        {
          blockerId:
            currentUserObjectId,

          blockedId:
            otherUserObjectId,
        },

        {
          blockerId:
            otherUserObjectId,

          blockedId:
            currentUserObjectId,
        },
      ],
    });

  return Boolean(blockExists);
};

/**
 * ============================================================
 * CREATE MESSAGE
 * ============================================================
 */
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

  if (
    !mongoose.Types.ObjectId.isValid(
      currentUserId,
    )
  ) {
    throw new Error(
      "Invalid current user ID",
    );
  }

  // ==========================================
  // 2. Validate conversation ID
  // ==========================================

  if (
    !mongoose.Types.ObjectId.isValid(
      conversationId,
    )
  ) {
    throw new Error(
      "Invalid conversation ID",
    );
  }

  // ==========================================
  // 3. Validate message content
  // ==========================================

  const trimmedText =
    text?.trim() ?? "";

  if (
    !trimmedText &&
    attachments.length === 0
  ) {
    throw new Error(
      "Message must contain text or attachment",
    );
  }

  // ==========================================
  // 4. Find conversation
  // ==========================================

  const conversation =
    await ConversationModel.findOne({
      _id:
        new mongoose.Types.ObjectId(
          conversationId,
        ),

      participants:
        new mongoose.Types.ObjectId(
          currentUserId,
        ),
    });

  if (!conversation) {
    throw new Error(
      "Conversation not found or you are not a member",
    );
  }

  // ==========================================
  // 5. Check block status
  //
  // Only direct conversations.
  //
  // Group conversations are not blocked.
  // ==========================================

  const blocked =
    await isDirectConversationBlocked(
      conversationId,
      currentUserId,
    );

  if (blocked) {
    throw new Error(
      "You cannot send messages because this user is blocked",
    );
  }

  // ==========================================
  // 6. Validate reply message
  // ==========================================

  if (replyTo) {
    // ----------------------------------------
    // Validate reply message ID
    // ----------------------------------------

    if (
      !mongoose.Types.ObjectId.isValid(
        replyTo,
      )
    ) {
      throw new Error(
        "Invalid reply message ID",
      );
    }

    // ----------------------------------------
    // Find reply message
    // ----------------------------------------

    const replyMessage =
      await MessageModel.findById(
        replyTo,
      );

    if (!replyMessage) {
      throw new Error(
        "Reply message not found",
      );
    }

    // ----------------------------------------
    // Make sure reply belongs to
    // same conversation
    // ----------------------------------------

    if (
      replyMessage.conversationId.toString() !==
      conversationId
    ) {
      throw new Error(
        "Reply message belongs to another conversation",
      );
    }
  }

  // ==========================================
  // 7. Create message
  // ==========================================

  const message =
    await MessageModel.create({
      conversationId:
        new mongoose.Types.ObjectId(
          conversationId,
        ),

      senderId:
        new mongoose.Types.ObjectId(
          currentUserId,
        ),

      text: trimmedText,

      attachments,

      replyTo: replyTo
        ? new mongoose.Types.ObjectId(
            replyTo,
          )
        : null,
    });

  // ==========================================
  // 8. Update conversation last message
  // ==========================================

  conversation.lastMessage =
    message._id;

  await conversation.save();

  // ==========================================
  // 9. Invalidate conversation cache
  // ==========================================

  await invalidateUserConversationsCache(
    conversation.participants.map(
      (participantId) =>
        participantId.toString(),
    ),
  );

  // ==========================================
  // 10. Populate sender
  // ==========================================

  await message.populate(
    "senderId",
    "phone name avatar bio isOnline lastSeen",
  );

  // ==========================================
  // 11. Populate reply message
  // ==========================================

  await message.populate({
    path: "replyTo",

    select:
      "text senderId isDeleted createdAt attachments",

    populate: {
      path: "senderId",

      select:
        "name avatar",
    },
  });

  // ==========================================
  // 12. Get recipient IDs
  // ==========================================

  const recipientIds =
    conversation.participants
      .map(
        (participantId) =>
          participantId.toString(),
      )
      .filter(
        (participantId) =>
          participantId !==
          currentUserId,
      );

  // ==========================================
  // 13. Find recipients with push tokens
  // ==========================================

  const recipients =
    await UserModel.find({
      _id: {
        $in: recipientIds,
      },

      "pushTokens.0": {
        $exists: true,
      },
    }).select(
      "pushTokens",
    );

  // ==========================================
  // 14. Collect FCM tokens
  // ==========================================

  const tokens =
    recipients.flatMap(
      (user) =>
        user.pushTokens.map(
          (item) =>
            item.token,
        ),
    );

  // ==========================================
  // 15. Prepare notification body
  // ==========================================

  let notificationBody =
    trimmedText;

  if (
    !notificationBody &&
    attachments.length > 0
  ) {
    const firstAttachment =
      attachments[0];

    switch (
      firstAttachment.type
    ) {
      case "image":
        notificationBody =
          "📷 Sent an image";
        break;

      case "video":
        notificationBody =
          "🎥 Sent a video";
        break;

      case "audio":
        notificationBody =
          "🎤 Sent a voice message";
        break;

      default:
        notificationBody =
          "📎 Sent a file";
        break;
    }
  }

  // ==========================================
  // 16. Send push notification
  // ==========================================

  const sender =
    message.senderId as unknown as IUser;

  if (
    tokens.length > 0
  ) {
    void sendPushNotification({
      tokens,

      title:
        sender.name,

      body:
        notificationBody,

      data: {
        type:
          "new_message",

        conversationId:
          conversationId,

        messageId:
          message._id.toString(),
      },
    });
  }

  // ==========================================
  // 17. Return message
  // ==========================================

  return message;
};

/**
 * ============================================================
 * GET CONVERSATION MESSAGES
 * ============================================================
 */
/**
 * ============================================================
 * GET CONVERSATION MESSAGES
 * ============================================================
 */
export const getConversationMessages = async (
  currentUserId: string,
  conversationId: string,
  page = 1,
  limit = 30,
) => {
  // ==========================================
  // 1. Validate current user ID
  // ==========================================

  if (
    !mongoose.Types.ObjectId.isValid(
      currentUserId,
    )
  ) {
    throw new Error(
      "Invalid current user ID",
    );
  }

  // ==========================================
  // 2. Validate conversation ID
  // ==========================================

  if (
    !mongoose.Types.ObjectId.isValid(
      conversationId,
    )
  ) {
    throw new Error(
      "Invalid conversation ID",
    );
  }

  // ==========================================
  // 3. Find conversation
  // ==========================================

  const conversation =
    await ConversationModel.findOne({
      _id:
        new mongoose.Types.ObjectId(
          conversationId,
        ),

      participants:
        new mongoose.Types.ObjectId(
          currentUserId,
        ),
    });

  if (!conversation) {
    throw new Error(
      "Conversation not found or you are not a member",
    );
  }

  // ==========================================
  // 4. Calculate pagination
  // ==========================================

  const skip =
    (page - 1) * limit;

  // ==========================================
  // 5. Fetch messages + total
  // ==========================================

  const [
    messages,
    total,
  ] = await Promise.all([
    MessageModel.find({
      conversationId:
        new mongoose.Types.ObjectId(
          conversationId,
        ),
    })

      // ========================================
      // Populate message sender
      // ========================================

      .populate(
        "senderId",
        "phone name avatar bio isOnline lastSeen",
      )

      // ========================================
      // Populate replied message
      // ========================================

      .populate({
        path: "replyTo",

        select:
          "text senderId isDeleted createdAt attachments",

        populate: {
          path: "senderId",

          select:
            "name avatar",
        },
      })

      // ========================================
      // Newest → oldest
      // ========================================

      .sort({
        createdAt: -1,
      })

      .skip(skip)

      .limit(limit),

    // ========================================
    // Total message count
    // ========================================

    MessageModel.countDocuments({
      conversationId:
        new mongoose.Types.ObjectId(
          conversationId,
        ),
    }),
  ]);

  // ==========================================
  // 6. Reverse for chat UI
  //
  // DB:
  // newest → oldest
  //
  // UI:
  // oldest → newest
  // ==========================================

  messages.reverse();

  // ==========================================
  // 7. Pagination information
  // ==========================================

  const totalPages =
    Math.ceil(
      total / limit,
    );

  return {
    messages,

    pagination: {
      page,

      limit,

      total,

      totalPages,

      hasNextPage:
        page < totalPages,

      hasPreviousPage:
        page > 1,
    },
  };
};

/**
 * ============================================================
 * MARK MESSAGE AS DELIVERED
 * ============================================================
 */
export const markMessageAsDelivered =
  async (
    currentUserId: string,
    messageId: string,
  ) => {
    // ==========================================
    // 1. Validate IDs
    // ==========================================

    if (
      !mongoose.Types.ObjectId.isValid(
        currentUserId,
      )
    ) {
      throw new Error(
        "Invalid current user ID",
      );
    }

    if (
      !mongoose.Types.ObjectId.isValid(
        messageId,
      )
    ) {
      throw new Error(
        "Invalid message ID",
      );
    }

    // ==========================================
    // 2. Find message
    // ==========================================

    const message =
      await MessageModel.findById(
        messageId,
      );

    if (!message) {
      throw new Error(
        "Message not found",
      );
    }

    // ==========================================
    // 3. Sender cannot mark own message
    // ==========================================

    if (
      message.senderId.toString() ===
      currentUserId
    ) {
      throw new Error(
        "You cannot mark your own message as delivered",
      );
    }

    // ==========================================
    // 4. Verify conversation membership
    // ==========================================

    const conversation =
      await ConversationModel.findOne({
        _id:
          message.conversationId,

        participants:
          new mongoose.Types.ObjectId(
            currentUserId,
          ),
      }).select(
        "_id",
      );

    if (!conversation) {
      throw new Error(
        "You are not a member of this conversation",
      );
    }

    // ==========================================
    // 5. Check block status
    // ==========================================

    const blocked =
      await isDirectConversationBlocked(
        message.conversationId.toString(),
        currentUserId,
      );

    if (blocked) {
      throw new Error(
        "You cannot interact with this user because they are blocked",
      );
    }

    // ==========================================
    // 6. Add user only once
    // ==========================================

    await MessageModel.findByIdAndUpdate(
      messageId,
      {
        $addToSet: {
          deliveredTo:
            new mongoose.Types.ObjectId(
              currentUserId,
            ),
        },
      },
      {
        new: true,
      },
    );

    // ==========================================
    // 7. Return delivery information
    // ==========================================

    return {
      messageId:
        message._id.toString(),

      conversationId:
        message.conversationId.toString(),

      userId:
        currentUserId,

      senderId:
        message.senderId.toString(),
    };
  };

/**
 * ============================================================
 * MARK MESSAGE AS READ
 * ============================================================
 */
export const markMessageAsRead =
  async (
    currentUserId: string,
    messageId: string,
  ) => {
    // ==========================================
    // 1. Validate IDs
    // ==========================================

    if (
      !mongoose.Types.ObjectId.isValid(
        currentUserId,
      )
    ) {
      throw new Error(
        "Invalid current user ID",
      );
    }

    if (
      !mongoose.Types.ObjectId.isValid(
        messageId,
      )
    ) {
      throw new Error(
        "Invalid message ID",
      );
    }

    // ==========================================
    // 2. Find message
    // ==========================================

    const message =
      await MessageModel.findById(
        messageId,
      );

    if (!message) {
      throw new Error(
        "Message not found",
      );
    }

    // ==========================================
    // 3. Verify membership
    // ==========================================

    const conversation =
      await ConversationModel.findOne({
        _id:
          message.conversationId,

        participants:
          new mongoose.Types.ObjectId(
            currentUserId,
          ),
      }).select(
        "_id participants",
      );

    if (!conversation) {
      throw new Error(
        "You are not a member of this conversation",
      );
    }

    // ==========================================
    // 4. Check block status
    // ==========================================

    const blocked =
      await isDirectConversationBlocked(
        message.conversationId.toString(),
        currentUserId,
      );

    if (blocked) {
      throw new Error(
        "You cannot interact with this user because they are blocked",
      );
    }

    // ==========================================
    // 5. Already read?
    // ==========================================

    const alreadyRead =
      message.readBy.some(
        (userId) =>
          userId.toString() ===
          currentUserId,
      );

    // ==========================================
    // 6. Add read status
    // ==========================================

    if (!alreadyRead) {
      message.readBy.push(
        new mongoose.Types.ObjectId(
          currentUserId,
        ),
      );

      await message.save();
    }

    // ==========================================
    // 7. Invalidate conversation cache
    // ==========================================

    await invalidateUserConversationsCache(
      conversation.participants.map(
        (participantId) =>
          participantId.toString(),
      ),
    );

    // ==========================================
    // 8. Populate readBy
    // ==========================================

    await message.populate(
      "readBy",
      "phone name avatar",
    );

    return message;
  };

/**
 * ============================================================
 * EDIT MESSAGE
 * ============================================================
 */
export const editMessage = async (
  currentUserId: string,
  messageId: string,
  text: string,
) => {
  // ==========================================
  // 1. Validate current user ID
  // ==========================================

  if (
    !mongoose.Types.ObjectId.isValid(
      currentUserId,
    )
  ) {
    throw new Error(
      "Invalid current user ID",
    );
  }

  // ==========================================
  // 2. Validate message ID
  // ==========================================

  if (
    !mongoose.Types.ObjectId.isValid(
      messageId,
    )
  ) {
    throw new Error(
      "Invalid message ID",
    );
  }

  // ==========================================
  // 3. Find message
  // ==========================================

  const message =
    await MessageModel.findById(
      messageId,
    );

  if (!message) {
    throw new Error(
      "Message not found",
    );
  }

  // ==========================================
  // 4. Only sender can edit
  // ==========================================

  if (
    message.senderId.toString() !==
    currentUserId
  ) {
    throw new Error(
      "You can only edit your own message",
    );
  }

  // ==========================================
  // 5. Cannot edit deleted message
  // ==========================================

  if (message.isDeleted) {
    throw new Error(
      "Cannot edit a deleted message",
    );
  }

  // ==========================================
  // 6. Validate text
  // ==========================================

  const trimmedText =
    text.trim();

  if (!trimmedText) {
    throw new Error(
      "Message text cannot be empty",
    );
  }

  // ==========================================
  // 7. Update message
  // ==========================================

  message.text =
    trimmedText;

  message.isEdited =
    true;

  await message.save();

  // ==========================================
  // 8. Populate sender
  // ==========================================

  await message.populate(
    "senderId",
    "phone name avatar bio isOnline lastSeen",
  );

  return message;
};

/**
 * ============================================================
 * DELETE MESSAGE
 * ============================================================
 */
export const deleteMessage = async (
  currentUserId: string,
  messageId: string,
) => {
  // ==========================================
  // 1. Validate current user ID
  // ==========================================

  if (
    !mongoose.Types.ObjectId.isValid(
      currentUserId,
    )
  ) {
    throw new Error(
      "Invalid current user ID",
    );
  }

  // ==========================================
  // 2. Validate message ID
  // ==========================================

  if (
    !mongoose.Types.ObjectId.isValid(
      messageId,
    )
  ) {
    throw new Error(
      "Invalid message ID",
    );
  }

  // ==========================================
  // 3. Find message
  // ==========================================

  const message =
    await MessageModel.findById(
      messageId,
    );

  if (!message) {
    throw new Error(
      "Message not found",
    );
  }

  // ==========================================
  // 4. Check ownership
  // ==========================================

  if (
    message.senderId.toString() !==
    currentUserId
  ) {
    throw new Error(
      "You can only delete your own messages",
    );
  }

  // ==========================================
  // 5. Prevent duplicate deletion
  // ==========================================

  if (message.isDeleted) {
    throw new Error(
      "Message is already deleted",
    );
  }

  // ==========================================
  // 6. Delete Cloudinary attachments
  // ==========================================

  if (
    message.attachments &&
    message.attachments.length > 0
  ) {
    await deleteMultipleMessageAttachments(
      message.attachments,
    );
  }

  // ==========================================
  // 7. Soft delete message
  // ==========================================

  message.isDeleted =
    true;

  message.deletedAt =
    new Date();

  // Hide original text
  message.text = "";

  // Remove attachments
  message.attachments = [];

  await message.save();

  // ==========================================
  // 8. Return deleted information
  // ==========================================

  return {
    messageId:
      message._id.toString(),

    conversationId:
      message.conversationId.toString(),

    isDeleted:
      true,

    deletedAt:
      message.deletedAt,
  };
};

/**
 * ============================================================
 * REACTION SUMMARY
 * ============================================================
 */
const getReactionSummary = async (
  reactions: IMessageReaction[],
) => {
  const userIds = [
    ...new Set(
      reactions.map(
        (reaction) =>
          reaction.userId.toString(),
      ),
    ),
  ];

  const users =
    await UserModel.find({
      _id: {
        $in: userIds,
      },
    }).select(
      "_id name",
    );

  const userMap =
    new Map(
      users.map(
        (user) => [
          user._id.toString(),
          user.name,
        ],
      ),
    );

  const reactionMap =
    new Map<
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

  for (
    const reaction of reactions
  ) {
    const emoji =
      reaction.emoji;

    const userId =
      reaction.userId.toString();

    const name =
      userMap.get(
        userId,
      ) ??
      "Unknown User";

    const existing =
      reactionMap.get(
        emoji,
      );

    if (existing) {
      existing.count += 1;

      existing.users.push({
        userId,

        name,
      });
    } else {
      reactionMap.set(
        emoji,
        {
          emoji,

          count: 1,

          users: [
            {
              userId,

              name,
            },
          ],
        },
      );
    }
  }

  return Array.from(
    reactionMap.values(),
  );
};

/**
 * ============================================================
 * ADD / REMOVE REACTION
 * ============================================================
 */
export const addReaction = async (
  userId: string,
  messageId: string,
  emoji: string,
) => {
  // ==========================================
  // 1. Validate user ID
  // ==========================================

  if (
    !Types.ObjectId.isValid(
      userId,
    )
  ) {
    throw new Error(
      "Invalid user ID",
    );
  }

  // ==========================================
  // 2. Validate message ID
  // ==========================================

  if (
    !Types.ObjectId.isValid(
      messageId,
    )
  ) {
    throw new Error(
      "Invalid message ID",
    );
  }

  // ==========================================
  // 3. Validate emoji
  // ==========================================

  if (!emoji?.trim()) {
    throw new Error(
      "Emoji is required",
    );
  }

  // ==========================================
  // 4. Find message
  // ==========================================

  const message =
    await MessageModel.findById(
      messageId,
    );

  if (!message) {
    throw new Error(
      "Message not found",
    );
  }

  // ==========================================
  // 5. Cannot react to deleted message
  // ==========================================

  if (message.isDeleted) {
    throw new Error(
      "Cannot react to a deleted message",
    );
  }

  // ==========================================
  // 6. Verify conversation membership
  // ==========================================

  const isMember =
    await isConversationMember(
      message.conversationId.toString(),
      userId,
    );

  if (!isMember) {
    throw new Error(
      "You are not a member of this conversation",
    );
  }

  // ==========================================
  // 7. Check block status
  // ==========================================

  const blocked =
    await isDirectConversationBlocked(
      message.conversationId.toString(),
      userId,
    );

  if (blocked) {
    throw new Error(
      "You cannot react because this user is blocked",
    );
  }

  // ==========================================
  // 8. Find existing reaction
  // ==========================================

  const existingReactionIndex =
    message.reactions.findIndex(
      (reaction) =>
        reaction.userId.toString() ===
          userId &&
        reaction.emoji ===
          emoji,
    );

  // ==========================================
  // 9. Same emoji = remove reaction
  // ==========================================

  if (
    existingReactionIndex !==
    -1
  ) {
    message.reactions.splice(
      existingReactionIndex,
      1,
    );

    await message.save();

    return {
      action:
        "removed" as const,

      message,

      reactionSummary:
        await getReactionSummary(
          message.reactions,
        ),
    };
  }

  // ==========================================
  // 10. Add new reaction
  // ==========================================

  message.reactions.push({
    userId:
      new Types.ObjectId(
        userId,
      ),

    emoji,

    createdAt:
      new Date(),
  });

  await message.save();

  // ==========================================
  // 11. Return reaction result
  // ==========================================

  return {
    action:
      "added" as const,

    message,

    reactionSummary:
      await getReactionSummary(
        message.reactions,
      ),
  };
};