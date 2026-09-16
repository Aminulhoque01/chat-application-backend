import { Types } from "mongoose";

import { BlockModel } from "./block.model";

import { UserModel } from "../user/user.model";
import { deleteCache } from "../../cache/cache.service";
import { cacheKeys } from "../../cache/cache.keys";

// =====================================================
// BLOCK USER
// =====================================================

export const blockUser = async (
  currentUserId: string,
  targetUserId: string,
) => {
  // -----------------------------------------
  // Validate IDs
  // -----------------------------------------

  if (
    !Types.ObjectId.isValid(currentUserId) ||
    !Types.ObjectId.isValid(targetUserId)
  ) {
    throw new Error("Invalid user ID");
  }

  // -----------------------------------------
  // Prevent self block
  // -----------------------------------------

  if (currentUserId === targetUserId) {
    throw new Error("You cannot block yourself");
  }

  const blockerId = new Types.ObjectId(currentUserId);

  const blockedId = new Types.ObjectId(targetUserId);

  // -----------------------------------------
  // Check target user
  // -----------------------------------------

  const targetUser = await UserModel.findById(blockedId).select("_id");

  if (!targetUser) {
    throw new Error("User not found");
  }

  // -----------------------------------------
  // Check existing block
  // -----------------------------------------

  const existingBlock = await BlockModel.findOne({
    blockerId,
    blockedId,
  }).select("_id");

  if (existingBlock) {
    throw new Error("User is already blocked");
  }

  // -----------------------------------------
  // Create block relationship
  //
  // IMPORTANT:
  //
  // Only currentUser -> targetUser
  //
  // We DO NOT create the reverse
  // relationship.
  // -----------------------------------------

  const block = await BlockModel.create({
    blockerId,
    blockedId,
  });

  // -----------------------------------------
  // Clear profile cache
  // -----------------------------------------

  await Promise.all([
    deleteCache(cacheKeys.userProfile(currentUserId)),

    deleteCache(cacheKeys.userProfile(targetUserId)),
  ]);

  return block;
};

// =====================================================
// UNBLOCK USER
// =====================================================

export const unblockUser = async (
  currentUserId: string,
  targetUserId: string,
) => {
  // -----------------------------------------
  // Validate IDs
  // -----------------------------------------

  if (
    !Types.ObjectId.isValid(currentUserId) ||
    !Types.ObjectId.isValid(targetUserId)
  ) {
    throw new Error("Invalid user ID");
  }

  // -----------------------------------------
  // Prevent self unblock
  // -----------------------------------------

  if (currentUserId === targetUserId) {
    throw new Error("You cannot unblock yourself");
  }

  const blockerId = new Types.ObjectId(currentUserId);

  const blockedId = new Types.ObjectId(targetUserId);

  // -----------------------------------------
  // Check target user
  // -----------------------------------------

  const targetUser = await UserModel.findById(blockedId).select("_id");

  if (!targetUser) {
    throw new Error("User not found");
  }

  // -----------------------------------------
  // Find ONLY the block created by
  // current user.
  //
  // This is what guarantees:
  //
  // A can unblock B
  // B cannot unblock A
  // -----------------------------------------

  const block = await BlockModel.findOne({
    blockerId,
    blockedId,
  }).select("_id");

  if (!block) {
    throw new Error("You have not blocked this user");
  }

  // -----------------------------------------
  // Delete block relationship
  // -----------------------------------------

  await BlockModel.deleteOne({
    _id: block._id,
  });

  // -----------------------------------------
  // Clear profile cache
  // -----------------------------------------

  await Promise.all([
    deleteCache(cacheKeys.userProfile(currentUserId)),

    deleteCache(cacheKeys.userProfile(targetUserId)),
  ]);

  return true;
};

// =====================================================
// GET BLOCK STATUS
// =====================================================

export const getBlockStatus = async (
  currentUserId: string,
  targetUserId: string,
) => {
  // -----------------------------------------
  // Validate IDs
  // -----------------------------------------

  if (
    !Types.ObjectId.isValid(currentUserId) ||
    !Types.ObjectId.isValid(targetUserId)
  ) {
    throw new Error("Invalid user ID");
  }

  // -----------------------------------------
  // Prevent self status check
  // -----------------------------------------

  if (currentUserId === targetUserId) {
    throw new Error("You cannot check block status for yourself");
  }

  const currentUserObjectId = new Types.ObjectId(currentUserId);

  const targetUserObjectId = new Types.ObjectId(targetUserId);

  // -----------------------------------------
  // Check both directions
  //
  // currentUser -> targetUser
  //
  // targetUser -> currentUser
  // -----------------------------------------

  const [blockedByMe, blockedByOther] = await Promise.all([
    BlockModel.exists({
      blockerId: currentUserObjectId,

      blockedId: targetUserObjectId,
    }),

    BlockModel.exists({
      blockerId: targetUserObjectId,

      blockedId: currentUserObjectId,
    }),
  ]);

  // -----------------------------------------
  // Return complete status
  // -----------------------------------------

  return {
    isBlocked: Boolean(blockedByMe || blockedByOther),

    blockedByMe: Boolean(blockedByMe),

    blockedByOther: Boolean(blockedByOther),

    canUnblock: Boolean(blockedByMe),
  };
};

// =====================================================
// CHECK WHETHER TWO USERS ARE BLOCKED
// =====================================================
//
// This helper will later be used by:
//
// - message service
// - socket
// - online status
// - last seen
// - realtime events
//
// =====================================================

export const isBlockedBetweenUsers = async (
  userId1: string,
  userId2: string,
): Promise<boolean> => {
  if (!Types.ObjectId.isValid(userId1) || !Types.ObjectId.isValid(userId2)) {
    return false;
  }

  const firstUserId = new Types.ObjectId(userId1);

  const secondUserId = new Types.ObjectId(userId2);

  const block = await BlockModel.exists({
    $or: [
      {
        blockerId: firstUserId,

        blockedId: secondUserId,
      },

      {
        blockerId: secondUserId,

        blockedId: firstUserId,
      },
    ],
  });

  return Boolean(block);
};
