import { Types } from "mongoose";
import { cacheKeys } from "../../cache/cache.keys";
import { deleteCache, getCache, setCache } from "../../cache/cache.service";
import { UserModel } from "./user.model";

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
 * Get all users
 * Supports:
 * - search
 * - phone filter
 * - online filter
 * - pagination
 * - sorting
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

  const currentLimit = Math.min(
    Math.max(1, limit),
    100,
  );

  const skip =
    (currentPage - 1) * currentLimit;

  /**
   * Sorting
   */
  const sort: Record<string, 1 | -1> = {
    [sortBy]:
      sortOrder === "desc" ? -1 : 1,
  };

  /**
   * Query users + count together
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

  const totalPages = Math.ceil(
    total / currentLimit,
  );

  return {
    users,

    pagination: {
      page: currentPage,
      limit: currentLimit,
      total,
      totalPages,

      hasNextPage:
        currentPage < totalPages,

      hasPrevPage:
        currentPage > 1,
    },
  };
};

/**
 * Search users
 *
 * This is optional because getAllUsers()
 * can already handle search.
 */
export const searchUsers = async (
  query: string,
  page = 1,
  limit = 20,
) => {
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

  const totalPages = Math.ceil(
    total / limit,
  );

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
 * Get single user
 */
export const getUserById = async (
  userId: string,
) => {
  const cacheKey =
    cacheKeys.userProfile(userId);

  // 1. Check Redis
  const cachedUser =
    await getCache(cacheKey);

  if (cachedUser) {
    console.log("User profile: Redis HIT");

    return cachedUser;
  }

  console.log("User profile: Redis MISS");

  // 2. Get from MongoDB
  const user =
    await UserModel.findById(userId)
      .select("-__v");

  if (!user) {
    return null;
  }

  // 3. Save to Redis
  await setCache(
    cacheKey,
    user,
    300,
  );

  return user;
};

/**
 * Update user profile
 */
export const updateUserProfile = async (
  userId: string,
  data: UpdateProfileData,
) => {
  const updateData: UpdateProfileData = {};

  if (data.name !== undefined) {
    updateData.name =
      data.name.trim();
  }

  if (data.bio !== undefined) {
    updateData.bio =
      data.bio.trim();
  }

  const user =
    await UserModel.findByIdAndUpdate(
      userId,
      {
        $set: updateData,
      },
      {
        new: true,
        runValidators: true,
      },
    ).select("-__v");

  return user;
};

/**
 * Update avatar
 */
export const updateUserAvatar = async (
  userId: string,
  avatarUrl: string,
) => {
  const user =
    await UserModel.findByIdAndUpdate(
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

  return user;
};


export const setUserOnline =
  async (userId: string) => {
    const user =
      await UserModel.findByIdAndUpdate(
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

    return user;
  };

export const setUserOffline =
  async (userId: string) => {
    const user =
      await UserModel.findByIdAndUpdate(
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

    return user;
  };


 