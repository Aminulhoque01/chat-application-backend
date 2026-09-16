import mongoose from "mongoose";
import type { Response } from "express";

import type { AuthRequest } from "../../middleware/auth.middleware";

import {
  blockUser,
  unblockUser,
  getBlockStatus,
} from "./block.service";

import { getSocketIO } from "../../socket/socket.instance";

// =====================================================
// BLOCK USER
// =====================================================

export const blockUserController = async (
  req: AuthRequest,
  res: Response,
) => {
  try {
    // -----------------------------------------
    // Authentication
    // -----------------------------------------

    if (!req.user?.userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const currentUserId = req.user.userId;
    const { id: targetUserId } = req.params;

    // -----------------------------------------
    // Validate target ID
    // -----------------------------------------

    if (
      !mongoose.Types.ObjectId.isValid(
        targetUserId as string,
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    // -----------------------------------------
    // Create block relationship
    // -----------------------------------------

    await blockUser(
      currentUserId,
      targetUserId as string,
    );

    // -----------------------------------------
    // Realtime block event
    //
    // Only the blocked user's personal room
    // receives this event.
    // -----------------------------------------

    try {
      const io = getSocketIO();

      io.to(`user:${targetUserId}`).emit(
        "user:blocked",
        {
          blockerId: currentUserId,
          blockedId: targetUserId as string,
        },
      );
    } catch (socketError) {
      /**
       * Socket notification failure should NOT
       * make the successful database block request
       * return 500.
       */
      console.error(
        "Failed to emit user:blocked event:",
        socketError,
      );
    }

    return res.status(200).json({
      success: true,
      message: "User blocked successfully",
    });
  } catch (error) {
    console.error(
      "Block user error:",
      error,
    );

    const message =
      error instanceof Error
        ? error.message
        : "Failed to block user";

    // -----------------------------------------
    // Known errors
    // -----------------------------------------

    if (message === "User not found") {
      return res.status(404).json({
        success: false,
        message,
      });
    }

    if (message === "You cannot block yourself") {
      return res.status(400).json({
        success: false,
        message,
      });
    }

    if (message === "User is already blocked") {
      return res.status(409).json({
        success: false,
        message,
      });
    }

    if (message === "Invalid user ID") {
      return res.status(400).json({
        success: false,
        message,
      });
    }

    return res.status(500).json({
      success: false,
      message,
    });
  }
};

// =====================================================
// UNBLOCK USER
// =====================================================

export const unblockUserController = async (
  req: AuthRequest,
  res: Response,
) => {
  try {
    // -----------------------------------------
    // Authentication
    // -----------------------------------------

    if (!req.user?.userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const currentUserId = req.user.userId;
    const { id: targetUserId } = req.params;

    // -----------------------------------------
    // Validate target ID
    // -----------------------------------------

    if (
      !mongoose.Types.ObjectId.isValid(
        targetUserId as string,
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    // -----------------------------------------
    // Unblock
    //
    // Service only allows the original blocker
    // to unblock the target user.
    // -----------------------------------------

    await unblockUser(
      currentUserId,
      targetUserId as string,
    );

    // -----------------------------------------
    // Realtime unblock event
    //
    // Notify the previously blocked user.
    // -----------------------------------------

    try {
      const io = getSocketIO();

      io.to(`user:${targetUserId}`).emit(
        "user:unblocked",
        {
          blockerId: currentUserId,
          blockedId: targetUserId as string,
        },
      );
    } catch (socketError) {
      /**
       * Socket notification failure should NOT
       * make the successful database unblock
       * request return 500.
       */
      console.error(
        "Failed to emit user:unblocked event:",
        socketError,
      );
    }

    return res.status(200).json({
      success: true,
      message: "User unblocked successfully",
    });
  } catch (error) {
    console.error(
      "Unblock user error:",
      error,
    );

    const message =
      error instanceof Error
        ? error.message
        : "Failed to unblock user";

    // -----------------------------------------
    // Known errors
    // -----------------------------------------

    if (message === "User not found") {
      return res.status(404).json({
        success: false,
        message,
      });
    }

    if (message === "You cannot unblock yourself") {
      return res.status(400).json({
        success: false,
        message,
      });
    }

    // -----------------------------------------
    // Current user is not the blocker
    // -----------------------------------------

    if (
      message ===
      "You have not blocked this user"
    ) {
      return res.status(403).json({
        success: false,
        message,
      });
    }

    if (message === "Invalid user ID") {
      return res.status(400).json({
        success: false,
        message,
      });
    }

    return res.status(500).json({
      success: false,
      message,
    });
  }
};

// =====================================================
// GET BLOCK STATUS
// =====================================================

export const blockStatus = async (
  req: AuthRequest,
  res: Response,
) => {
  try {
    // -----------------------------------------
    // Authentication
    // -----------------------------------------

    if (!req.user?.userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const currentUserId = req.user.userId;
    const { id: targetUserId } = req.params;

    // -----------------------------------------
    // Validate target ID
    // -----------------------------------------

    if (
      !mongoose.Types.ObjectId.isValid(
        targetUserId as string,
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    // -----------------------------------------
    // Get block status
    // -----------------------------------------

    const result = await getBlockStatus(
      currentUserId,
      targetUserId as string,
    );

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error(
      "Get block status error:",
      error,
    );

    const message =
      error instanceof Error
        ? error.message
        : "Failed to get block status";

    if (
      message ===
      "You cannot check block status for yourself"
    ) {
      return res.status(400).json({
        success: false,
        message,
      });
    }

    if (message === "Invalid user ID") {
      return res.status(400).json({
        success: false,
        message,
      });
    }

    if (message === "User not found") {
      return res.status(404).json({
        success: false,
        message,
      });
    }

    return res.status(500).json({
      success: false,
      message,
    });
  }
};