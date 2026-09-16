import { Request, Response } from "express";

import {
  addReaction,
  createMessage,
  deleteMessage,
  editMessage,
  getConversationMessages,
  markMessageAsRead,
} from "./message.service";

import {
  editMessageSchema,
  getMessagesSchema,
  sendMessageSchema,
} from "./message.validation";

import { uploadMultipleMessageFiles } from "./messageUpload.service";
import { getSocketIO } from "../../socket/socket.instance";
import { ConversationModel } from "../conversation/conversation.model";

export const sendMessage = async (
  req: Request,
  res: Response,
) => {
  
  try {
    // ==========================================
    // Current User
    // ==========================================

    const currentUserId =
      req.user?.userId;

    if (!currentUserId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    // ==========================================
    // Validate Request Body
    // ==========================================

    const result =
      sendMessageSchema.safeParse(
        req.body ?? {},
      );

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid message data",
        errors:
          result.error.flatten(),
      });
    }

    const {
      conversationId,
      text,
      replyTo,
    } = result.data;

    // ==========================================
    // Convert Files Safely
    // ==========================================

    const files = Array.isArray(
      req.files,
    )
      ? req.files
      : [];

    // ==========================================
    // Upload Attachments
    // ==========================================

    const attachments =
      files.length > 0
        ? await uploadMultipleMessageFiles(
            files,
          )
        : [];

    // ==========================================
    // Create Message
    // ==========================================

    const message =
      await createMessage(
        currentUserId,
        conversationId,
        text,
        replyTo,
        attachments,
      );

    // ==========================================
    // Find Conversation Participants
    // ==========================================

    const conversation =
      await ConversationModel.findById(
        conversationId,
      ).select("participants");

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message:
          "Conversation not found",
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

    const io = getSocketIO();

    for (
      const participantId
      of conversation.participants
    ) {
      const participantRoom =
        `user:${participantId.toString()}`;

      io.to(
        participantRoom,
      ).emit(
        "message:new",
        message,
      );
    }

    console.log(
      `REST message ${message._id} sent to personal rooms`,
    );

    // ==========================================
    // Response
    // ==========================================

    return res.status(201).json({
      success: true,
      message:
        "Message sent successfully",
      data: message,
    });
  } catch (error) {
    console.error(
      "Send message error:",
      error,
    );

    const message =
      error instanceof Error
        ? error.message
        : "Failed to send message";

    return res.status(400).json({
      success: false,
      message,
    });
  }
};

export const getMessages = async (req: Request, res: Response) => {
  try {
    const currentUserId = req.user?.userId;

    if (!currentUserId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    // Validate params + query
    const result = getMessagesSchema.safeParse({
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

    const data = await getConversationMessages(
      currentUserId,
      conversationId,
      page,
      limit,
    );

    return res.status(200).json({
      success: true,
      message: "Messages fetched successfully",
      data,
    });
  } catch (error) {
    console.error("Get messages error:", error);

    const message =
      error instanceof Error ? error.message : "Failed to fetch messages";

    return res.status(400).json({
      success: false,
      message,
    });
  }
};


export const markMessageAsReadController = async (
  req: Request,
  res: Response,
) => {
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

    const data = await markMessageAsRead(
      currentUserId,
      messageId as string,
    );

    return res.status(200).json({
      success: true,
      message: "Message marked as read successfully",
      data,
    });
  } catch (error) {
    console.error(
      "Mark message as read error:",
      error,
    );

    const message =
      error instanceof Error
        ? error.message
        : "Failed to mark message as read";

    return res.status(400).json({
      success: false,
      message,
    });
  }
};

export const updateMessage = async (req: Request, res: Response) => {
  try {
    const currentUserId = req.user?.userId;

    if (!currentUserId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const result = editMessageSchema.safeParse({
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

    const message = await editMessage(currentUserId, messageId, text);

    return res.status(200).json({
      success: true,
      message: "Message updated successfully",
      data: message,
    });
  } catch (error) {
    console.error("Update message error:", error);

    return res.status(400).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to update message",
    });
  }
};

export const deleteMessageController = async (req: Request, res: Response) => {
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

    const data = await deleteMessage(currentUserId, messageId as string);

    return res.status(200).json({
      success: true,
      message: "Message deleted successfully",
      data,
    });
  } catch (error) {
    console.error("Delete message error:", error);

    const message =
      error instanceof Error ? error.message : "Failed to delete message";

    return res.status(400).json({
      success: false,
      message,
    });
  }
};

export const addReactionController = async (req: Request, res: Response) => {
  try {
    const { messageId } = req.params;
    const { emoji } = req.body;

    const userId = req.user?.userId;

    const result = await addReaction(
      userId as string,
      messageId as string,
      emoji,
    );

    return res.status(200).json({
      success: true,
      message:
        result.action === "added"
          ? "Reaction added successfully"
          : "Reaction removed successfully",

      data: {
        message: result.message,
        reactionSummary: result.reactionSummary,
      },
    });
  } catch (error) {
    console.error("Add reaction error:", error);

    return res.status(400).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to add reaction",
    });
  }
};
