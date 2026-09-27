 
import { Server } from "socket.io";
import { Types } from "mongoose";

import { AuthenticatedSocket } from "./socket.types";

import {
  setUserOffline,
  setUserOnline,
} from "../module/user/user.service";

import {
  addReaction,
  createMessage,
  deleteMessage,
  editMessage,
  markMessageAsDelivered,
  markMessageAsRead,
} from "../module/message/message.service";

import { isConversationMember } from "../module/conversation/conversation.service";
import { ConversationModel } from "../module/conversation/conversation.model";

import { BlockModel } from "../module/block/block.model";

/**
 * ============================================================
 * Populated sender type
 * ============================================================
 *
 * MessageModel senderId is normally an ObjectId.
 *
 * But createMessage() populates senderId before returning
 * the message.
 *
 * This type tells TypeScript about the populated structure.
 * ============================================================
 */
interface PopulatedSender {
  _id: Types.ObjectId;
  phone: string;
  name: string;
  avatar?: string | null;
  bio?: string | null;
  isOnline?: boolean;
  lastSeen?: Date | null;
}

/**
 * ============================================================
 * Check whether current user is blocked with another user
 * inside a direct conversation.
 *
 * Block relationship:
 *
 * A -> B
 * B -> A
 *
 * Communication is blocked both ways.
 *
 * Group conversations are NOT affected by block.
 * ============================================================
 */
const isDirectConversationBlocked = async (
  conversationId: string,
  currentUserId: string,
): Promise<boolean> => {
  // ==========================================================
  // Validate conversation ID
  // ==========================================================

  if (!Types.ObjectId.isValid(conversationId)) {
    throw new Error("Invalid conversation ID");
  }

  // ==========================================================
  // Validate current user ID
  // ==========================================================

  if (!Types.ObjectId.isValid(currentUserId)) {
    throw new Error("Invalid current user ID");
  }

  // ==========================================================
  // Find conversation
  // ==========================================================

  const conversation =
    await ConversationModel.findOne({
      _id: new Types.ObjectId(conversationId),

      participants: new Types.ObjectId(
        currentUserId,
      ),
    }).select(
      "type participants",
    );

  if (!conversation) {
    throw new Error(
      "Conversation not found or you are not a member",
    );
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

  // ==========================================================
  // Check both block directions
  // ==========================================================

  const blockExists =
    await BlockModel.exists({
      $or: [
        {
          blockerId:
            new Types.ObjectId(
              currentUserId,
            ),

          blockedId:
            new Types.ObjectId(
              otherParticipantId.toString(),
            ),
        },

        {
          blockerId:
            new Types.ObjectId(
              otherParticipantId.toString(),
            ),

          blockedId:
            new Types.ObjectId(
              currentUserId,
            ),
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
export const registerSocketHandlers = (
  io: Server,
  socket: AuthenticatedSocket,
) => {
  const userId =
    socket.data.userId;

  // ==========================================================
  // User Online
  // ==========================================================

  setUserOnline(userId)
    .then(() => {
      console.log(
        `User ${userId} is online`,
      );
    })
    .catch((error) => {
      console.error(
        "Failed to set user online:",
        error,
      );
    });

  // ==========================================================
  // Send Message
  // ==========================================================

  socket.on(
    "message:send",
    async (payload) => {
      try {
        const {
          conversationId,
          text = "",
          replyTo,
        } = payload;

        // ====================================================
        // Validate conversation ID
        // ====================================================

        if (!conversationId) {
          socket.emit(
            "message:error",
            {
              message:
                "Conversation ID is required",
            },
          );

          return;
        }

        // ====================================================
        // Check membership
        // ====================================================

        const isMember =
          await isConversationMember(
            conversationId,
            userId,
          );

        if (!isMember) {
          socket.emit(
            "message:error",
            {
              message:
                "You are not a member of this conversation",
            },
          );

          return;
        }

        // ====================================================
        // Create message
        //
        // createMessage() already handles:
        //
        // - conversation validation
        // - block validation
        // - reply validation
        // - sender population
        // - reply population
        // - push notification
        // ====================================================

        const message =
          await createMessage(
            userId,
            conversationId,
            text,
            replyTo,
            [],
          );

        // ====================================================
        // Get conversation participants
        // ====================================================

        const conversation =
          await ConversationModel.findById(
            conversationId,
          ).select(
            "participants",
          );

        if (!conversation) {
          throw new Error(
            "Conversation not found",
          );
        }

        // ====================================================
        // Get populated sender
        //
        // createMessage() already populated senderId.
        //
        // TypeScript still knows senderId as ObjectId,
        // therefore we explicitly describe the populated
        // structure here.
        // ====================================================

        const sender =
          message.senderId as unknown as
            PopulatedSender;

        // ====================================================
        // Convert message to plain object
        // ====================================================

        const socketMessage =
          message.toObject();

        // ====================================================
        // Prepare sender payload
        //
        // This is important for frontend notification:
        //
        // senderId.name
        // senderId.avatar
        // senderId._id
        // ====================================================

        const populatedSender = {
          _id:
            sender._id,

          phone:
            sender.phone,

          name:
            sender.name,

          avatar:
            sender.avatar ?? null,

          bio:
            sender.bio ?? null,

          isOnline:
            sender.isOnline ?? false,

          lastSeen:
            sender.lastSeen ?? null,
        };

        // ====================================================
        // Emit message to every participant
        //
        // Each participant has their own personal room:
        //
        // user:USER_ID
        //
        // This allows frontend to decide whether the
        // notification should be shown.
        // ====================================================

        for (
          const participantId of
            conversation.participants
        ) {
          const participantRoom =
            `user:${participantId.toString()}`;

          io.to(
            participantRoom,
          ).emit(
            "message:new",
            {
              ...socketMessage,

              senderId:
                populatedSender,
            },
          );
        }

        console.log(
          `Message ${message._id} delivered to participant rooms`,
        );
      } catch (error) {
        console.error(
          "message:send error:",
          error,
        );

        socket.emit(
          "message:error",
          {
            message:
              error instanceof Error
                ? error.message
                : "Failed to send message",
          },
        );
      }
    },
  );

  // ==========================================================
  // Message Reaction
  // ==========================================================

  socket.on(
    "message:reaction",
    async (payload) => {
      try {
        const {
          messageId,
          emoji,
        } = payload;

        // ====================================================
        // Validate payload
        // ====================================================

        if (
          !messageId ||
          !emoji
        ) {
          socket.emit(
            "message:error",
            {
              message:
                "Message ID and emoji are required",
            },
          );

          return;
        }

        // ====================================================
        // Add / remove reaction
        //
        // addReaction() handles:
        //
        // - membership
        // - deleted message
        // - block relationship
        // ====================================================

        const result =
          await addReaction(
            userId,
            messageId,
            emoji,
          );

        const conversationId =
          result.message.conversationId.toString();

        // ====================================================
        // Broadcast reaction update
        // ====================================================

        io.to(
          conversationId,
        ).emit(
          "message:reaction:update",
          {
            messageId:
              result.message._id.toString(),

            conversationId,

            action:
              result.action,

            reactionSummary:
              result.reactionSummary,
          },
        );

        console.log(
          `Reaction ${result.action}:`,
          emoji,
          `on message ${messageId}`,
        );
      } catch (error) {
        console.error(
          "message:reaction error:",
          error,
        );

        socket.emit(
          "message:error",
          {
            message:
              error instanceof Error
                ? error.message
                : "Failed to update reaction",
          },
        );
      }
    },
  );

  // ==========================================================
  // Message Delete
  // ==========================================================

  socket.on(
    "message:delete",
    async (payload) => {
      try {
        const {
          messageId,
        } = payload;

        // ====================================================
        // Validate message ID
        // ====================================================

        if (!messageId) {
          socket.emit(
            "message:error",
            {
              message:
                "Message ID is required",
            },
          );

          return;
        }

        // ====================================================
        // Delete message
        //
        // deleteMessage() handles ownership.
        // ====================================================

        const deletedMessage =
          await deleteMessage(
            userId,
            messageId,
          );

        const conversationId =
          deletedMessage.conversationId.toString();

        // ====================================================
        // Broadcast deletion
        // ====================================================

        io.to(
          conversationId,
        ).emit(
          "message:deleted",
          deletedMessage,
        );

        console.log(
          `Message ${messageId} deleted`,
        );
      } catch (error) {
        console.error(
          "message:delete error:",
          error,
        );

        socket.emit(
          "message:error",
          {
            message:
              error instanceof Error
                ? error.message
                : "Failed to delete message",
          },
        );
      }
    },
  );

  // ==========================================================
  // Message Edit
  // ==========================================================

  socket.on(
    "message:edit",
    async (payload) => {
      try {
        const {
          messageId,
          text,
        } = payload;

        // ====================================================
        // Validate message ID
        // ====================================================

        if (!messageId) {
          socket.emit(
            "message:error",
            {
              message:
                "Message ID is required",
            },
          );

          return;
        }

        // ====================================================
        // Validate text
        // ====================================================

        if (
          !text ||
          !text.trim()
        ) {
          socket.emit(
            "message:error",
            {
              message:
                "Message text is required",
            },
          );

          return;
        }

        // ====================================================
        // Edit message
        // ====================================================

        const message =
          await editMessage(
            userId,
            messageId,
            text,
          );

        const conversationId =
          message.conversationId.toString();

        // ====================================================
        // Broadcast edited message
        // ====================================================

        io.to(
          conversationId,
        ).emit(
          "message:edited",
          message,
        );

        console.log(
          `Message ${message._id} edited`,
        );
      } catch (error) {
        console.error(
          "message:edit error:",
          error,
        );

        socket.emit(
          "message:error",
          {
            message:
              error instanceof Error
                ? error.message
                : "Failed to edit message",
          },
        );
      }
    },
  );

  // ==========================================================
  // Message Delivered
  // ==========================================================

  socket.on(
    "message:delivered",
    async ({
      messageId,
    }) => {
      try {
        // ====================================================
        // Validate message ID
        // ====================================================

        if (!messageId) {
          socket.emit(
            "message:error",
            {
              message:
                "Message ID is required",
            },
          );

          return;
        }

        // ====================================================
        // Mark message as delivered
        // ====================================================

        const result =
          await markMessageAsDelivered(
            userId,
            messageId,
          );

        // ====================================================
        // Notify original sender
        // ====================================================

        io.to(
          `user:${result.senderId}`,
        ).emit(
          "message:delivery:update",
          {
            messageId:
              result.messageId,

            conversationId:
              result.conversationId,

            userId:
              result.userId,
          },
        );

        console.log(
          `Message ${result.messageId} delivered to user ${result.userId}`,
        );
      } catch (error) {
        console.error(
          "message:delivered error:",
          error,
        );

        socket.emit(
          "message:error",
          {
            message:
              error instanceof Error
                ? error.message
                : "Failed to mark message as delivered",
          },
        );
      }
    },
  );

  // ==========================================================
  // Message Read
  // ==========================================================

  socket.on(
    "message:read",
    async ({
      messageId,
    }) => {
      try {
        // ====================================================
        // Validate message ID
        // ====================================================

        if (!messageId) {
          socket.emit(
            "message:error",
            {
              message:
                "Message ID is required",
            },
          );

          return;
        }

        // ====================================================
        // Mark message as read
        // ====================================================

        const message =
          await markMessageAsRead(
            userId,
            messageId,
          );

        const conversationId =
          message.conversationId.toString();

        // ====================================================
        // Find sender ID
        // ====================================================

        const senderId =
          typeof message.senderId ===
          "string"
            ? message.senderId
            : message.senderId._id.toString();

        // ====================================================
        // Notify sender
        // ====================================================

        io.to(
          `user:${senderId}`,
        ).emit(
          "message:read:update",
          {
            messageId:
              message._id.toString(),

            conversationId,

            userId,
          },
        );

        console.log(
          `User ${userId} read message ${messageId}`,
        );
      } catch (error) {
        console.error(
          "message:read error:",
          error,
        );

        socket.emit(
          "message:error",
          {
            message:
              error instanceof Error
                ? error.message
                : "Failed to mark message as read",
          },
        );
      }
    },
  );

  // ==========================================================
  // Typing Start
  // ==========================================================

  socket.on(
    "typing:start",
    async ({
      conversationId,
    }) => {
      try {
        // ====================================================
        // Validate conversation ID
        // ====================================================

        if (!conversationId) {
          socket.emit(
            "message:error",
            {
              message:
                "Conversation ID is required",
            },
          );

          return;
        }

        // ====================================================
        // Check membership
        // ====================================================

        const isMember =
          await isConversationMember(
            conversationId,
            userId,
          );

        if (!isMember) {
          socket.emit(
            "message:error",
            {
              message:
                "You are not a member of this conversation",
            },
          );

          return;
        }

        // ====================================================
        // Check block relationship
        // ====================================================

        const blocked =
          await isDirectConversationBlocked(
            conversationId,
            userId,
          );

        if (blocked) {
          return;
        }

        // ====================================================
        // Emit typing start
        // ====================================================

        socket
          .to(conversationId)
          .emit(
            "typing:start",
            {
              conversationId,

              userId,
            },
          );

        console.log(
          `User ${userId} started typing in ${conversationId}`,
        );
      } catch (error) {
        console.error(
          "typing:start error:",
          error,
        );
      }
    },
  );

  // ==========================================================
  // Typing Stop
  // ==========================================================

  socket.on(
    "typing:stop",
    async ({
      conversationId,
    }) => {
      try {
        // ====================================================
        // Validate conversation ID
        // ====================================================

        if (!conversationId) {
          socket.emit(
            "message:error",
            {
              message:
                "Conversation ID is required",
            },
          );

          return;
        }

        // ====================================================
        // Check membership
        // ====================================================

        const isMember =
          await isConversationMember(
            conversationId,
            userId,
          );

        if (!isMember) {
          socket.emit(
            "message:error",
            {
              message:
                "You are not a member of this conversation",
            },
          );

          return;
        }

        // ====================================================
        // Check block relationship
        // ====================================================

        const blocked =
          await isDirectConversationBlocked(
            conversationId,
            userId,
          );

        if (blocked) {
          return;
        }

        // ====================================================
        // Emit typing stop
        // ====================================================

        socket
          .to(conversationId)
          .emit(
            "typing:stop",
            {
              conversationId,

              userId,
            },
          );

        console.log(
          `User ${userId} stopped typing in ${conversationId}`,
        );
      } catch (error) {
        console.error(
          "typing:stop error:",
          error,
        );
      }
    },
  );

  // ==========================================================
  // Disconnect
  // ==========================================================

  socket.on(
    "disconnect",
    (reason) => {
      console.log(
        `Socket disconnected: ${socket.id}`,
        `userId: ${userId}`,
        `reason: ${reason}`,
      );

      setUserOffline(userId)
        .then(() => {
          console.log(
            `User ${userId} is offline`,
          );
        })
        .catch((error) => {
          console.error(
            "Failed to set user offline:",
            error,
          );
        });
    },
  );
};

 