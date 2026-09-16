import { Types } from "mongoose";

import { cacheKeys } from "../../cache/cache.keys";

import { deleteCache, getCache, setCache } from "../../cache/cache.service";

import { UserModel } from "./user.model";

import { BlockModel } from "../block/block.model";

export interface GetUsersQuery {
  search?: string;
  phone?: string;
  isOnline?: boolean;

  page?: number;
  limit?: number;

  sortBy?: "name" | "createdAt" | "updatedAt" | "lastSeen";

  sortOrder?: "asc" | "desc";
}

export interface UpdateProfileData {
  name?: string;
  bio?: string;
}

/**
 * ==========================================
 * Get all users
 * ==========================================
 */
export const getAllUsers = async (query: GetUsersQuery = {}) => {
  const {
    search,
    phone,
    isOnline,
    page = 1,
    limit = 20,
    sortBy = "name",
    sortOrder = "asc",
  } = query;

  const filter: Record<string, unknown> = {};

  /**
   * Search by name or phone
   */
  if (search) {
    filter.$or = [
      {
        name: {
          $regex: search,
          $options: "i",
        },
      },
      {
        phone: {
          $regex: search,
          $options: "i",
        },
      },
    ];
  }

  /**
   * Phone filter
   */
  if (phone) {
    filter.phone = {
      $regex: phone,
      $options: "i",
    };
  }

  /**
   * Online/offline filter
   */
  if (typeof isOnline === "boolean") {
    filter.isOnline = isOnline;
  }

  /**
   * Pagination
   */
  const currentPage = Math.max(1, page);

  const currentLimit = Math.min(Math.max(1, limit), 100);

  const skip = (currentPage - 1) * currentLimit;

  /**
   * Sorting
   */
  const sort: Record<string, 1 | -1> = {
    [sortBy]: sortOrder === "desc" ? -1 : 1,
  };

  /**
   * Get users + total
   */
  const [users, total] = await Promise.all([
    UserModel.find(filter)
      .select("-__v")
      .sort(sort)
      .skip(skip)
      .limit(currentLimit)
      .lean(),

    UserModel.countDocuments(filter),
  ]);

  const totalPages = Math.ceil(total / currentLimit);

  return {
    users,

    pagination: {
      page: currentPage,
      limit: currentLimit,
      total,
      totalPages,

      hasNextPage: currentPage < totalPages,

      hasPrevPage: currentPage > 1,
    },
  };
};

/**
 * ==========================================
 * Search users
 * ==========================================
 */
export const searchUsers = async (query: string, page = 1, limit = 20) => {
  const regex = new RegExp(query, "i");

  const skip = (page - 1) * limit;

  const filter = {
    $or: [
      {
        name: regex,
      },
      {
        phone: regex,
      },
    ],
  };

  const [users, total] = await Promise.all([
    UserModel.find(filter)
      .select("-__v")
      .sort({
        name: 1,
      })
      .skip(skip)
      .limit(limit)
      .lean(),

    UserModel.countDocuments(filter),
  ]);

  const totalPages = Math.ceil(total / limit);

  return {
    users,

    pagination: {
      page,
      limit,
      total,
      totalPages,

      hasNextPage: page < totalPages,

      hasPrevPage: page > 1,
    },
  };
};

/**
 * ==========================================
 * Get single user
 *
 * targetUserId = profile owner
 * viewerUserId = currently logged-in user
 *
 * IMPORTANT:
 * Redis stores only the base user.
 * Block information is checked separately
 * because block status depends on the viewer.
 * ==========================================
 */
export const getUserById = async (
  targetUserId: string,
  viewerUserId?: string,
) => {
  if (!Types.ObjectId.isValid(targetUserId)) {
    return null;
  }

  const cacheKey = cacheKeys.userProfile(targetUserId);

  /**
   * ========================================
   * 1. Get base profile from Redis
   * ========================================
   */
  let user = await getCache(cacheKey);

  if (user) {
    console.log("User profile: Redis HIT");
  } else {
    console.log("User profile: Redis MISS");

    /**
     * ======================================
     * 2. Get user from MongoDB
     * ======================================
     */
    user = await UserModel.findById(targetUserId).select("-__v").lean();

    if (!user) {
      return null;
    }

    /**
     * ======================================
     * 3. Cache only base user data
     * ======================================
     */
    await setCache(cacheKey, user, 300);
  }

  /**
   * ========================================
   * Own profile
   * ========================================
   */
  if (
    !viewerUserId ||
    !Types.ObjectId.isValid(viewerUserId) ||
    viewerUserId === targetUserId
  ) {
    return user;
  }

  const viewerId = new Types.ObjectId(viewerUserId);

  const targetId = new Types.ObjectId(targetUserId);

  /**
   * ========================================
   * 4. Check block relationship
   *
   * Direction 1:
   *
   * viewer blocks target
   *
   * Direction 2:
   *
   * target blocks viewer
   * ========================================
   */
  const block = await BlockModel.findOne({
    $or: [
      {
        blockerId: viewerId,
        blockedId: targetId,
      },

      {
        blockerId: targetId,
        blockedId: viewerId,
      },
    ],
  })
    .select("blockerId blockedId")
    .lean();

  /**
   * ========================================
   * No block
   * ========================================
   */
  if (!block) {
    return user;
  }

  /**
   * ========================================
   * Block exists
   *
   * Hide presence information
   * ========================================
   */
  const blockedByMe = block.blockerId.toString() === viewerUserId;

  const blockedByOther = block.blockerId.toString() === targetUserId;

  return {
    ...user,

    /**
     * Hide online status
     */
    isOnline: false,

    /**
     * Hide last seen
     */
    lastSeen: null,

    /**
     * Block information
     */
    isBlocked: true,

    blockedByMe,

    blockedByOther,

    /**
     * ONLY blocker can unblock
     */
    canUnblock: blockedByMe,
  };
};

/**
 * ==========================================
 * Update user profile
 * ==========================================
 */
export const updateUserProfile = async (
  userId: string,
  data: UpdateProfileData,
) => {
  const updateData: UpdateProfileData = {};

  if (data.name !== undefined) {
    updateData.name = data.name.trim();
  }

  if (data.bio !== undefined) {
    updateData.bio = data.bio.trim();
  }

  const user = await UserModel.findByIdAndUpdate(
    userId,
    {
      $set: updateData,
    },
    {
      new: true,
      runValidators: true,
    },
  ).select("-__v");

  /**
   * Clear profile cache
   */
  await deleteCache(cacheKeys.userProfile(userId));

  return user;
};

/**
 * ==========================================
 * Update avatar
 * ==========================================
 */
export const updateUserAvatar = async (userId: string, avatarUrl: string) => {
  const user = await UserModel.findByIdAndUpdate(
    userId,
    {
      $set: {
        avatar: avatarUrl,
      },
    },
    {
      new: true,
      runValidators: true,
    },
  ).select("-__v");

  /**
   * Clear profile cache
   */
  await deleteCache(cacheKeys.userProfile(userId));

  return user;
};

/**
 * ==========================================
 * Set user online
 * ==========================================
 */
export const setUserOnline = async (userId: string) => {
  const user = await UserModel.findByIdAndUpdate(
    userId,
    {
      $set: {
        isOnline: true,
      },
    },
    {
      new: true,
    },
  );

  /**
   * IMPORTANT:
   * Do not cache online state.
   *
   * Presence should come from DB/socket.
   */
  await deleteCache(cacheKeys.userProfile(userId));

  return user;
};

/**
 * ==========================================
 * Set user offline
 * ==========================================
 */
export const setUserOffline = async (userId: string) => {
  const user = await UserModel.findByIdAndUpdate(
    userId,
    {
      $set: {
        isOnline: false,

        lastSeen: new Date(),
      },
    },
    {
      new: true,
    },
  );

  /**
   * Clear cached profile
   */
  await deleteCache(cacheKeys.userProfile(userId));

  return user;
};
