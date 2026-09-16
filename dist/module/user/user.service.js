"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBlockStatus = exports.unblockUser = exports.blockUser = exports.setUserOffline = exports.setUserOnline = exports.updateUserAvatar = exports.updateUserProfile = exports.getUserById = exports.searchUsers = exports.getAllUsers = void 0;
const mongoose_1 = require("mongoose");
const cache_keys_1 = require("../../cache/cache.keys");
const cache_service_1 = require("../../cache/cache.service");
const user_model_1 = require("./user.model");
/**
 * Get all users
 * Supports:
 * - search
 * - phone filter
 * - online filter
 * - pagination
 * - sorting
 */
const getAllUsers = async (query = {}) => {
    const { search, phone, isOnline, page = 1, limit = 20, sortBy = "name", sortOrder = "asc", } = query;
    const filter = {};
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
    const sort = {
        [sortBy]: sortOrder === "desc" ? -1 : 1,
    };
    /**
     * Query users + count together
     */
    const [users, total] = await Promise.all([
        user_model_1.UserModel.find(filter)
            .select("-__v")
            .sort(sort)
            .skip(skip)
            .limit(currentLimit)
            .lean(),
        user_model_1.UserModel.countDocuments(filter),
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
exports.getAllUsers = getAllUsers;
/**
 * Search users
 *
 * This is optional because getAllUsers()
 * can already handle search.
 */
const searchUsers = async (query, page = 1, limit = 20) => {
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
        user_model_1.UserModel.find(filter)
            .select("-__v")
            .sort({
            name: 1,
        })
            .skip(skip)
            .limit(limit)
            .lean(),
        user_model_1.UserModel.countDocuments(filter),
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
exports.searchUsers = searchUsers;
/**
 * Get single user
 */
const getUserById = async (userId) => {
    const cacheKey = cache_keys_1.cacheKeys.userProfile(userId);
    // 1. Check Redis
    const cachedUser = await (0, cache_service_1.getCache)(cacheKey);
    if (cachedUser) {
        console.log("User profile: Redis HIT");
        return cachedUser;
    }
    console.log("User profile: Redis MISS");
    // 2. Get from MongoDB
    const user = await user_model_1.UserModel.findById(userId)
        .select("-__v");
    if (!user) {
        return null;
    }
    // 3. Save to Redis
    await (0, cache_service_1.setCache)(cacheKey, user, 300);
    return user;
};
exports.getUserById = getUserById;
/**
 * Update user profile
 */
const updateUserProfile = async (userId, data) => {
    const updateData = {};
    if (data.name !== undefined) {
        updateData.name =
            data.name.trim();
    }
    if (data.bio !== undefined) {
        updateData.bio =
            data.bio.trim();
    }
    const user = await user_model_1.UserModel.findByIdAndUpdate(userId, {
        $set: updateData,
    }, {
        new: true,
        runValidators: true,
    }).select("-__v");
    return user;
};
exports.updateUserProfile = updateUserProfile;
/**
 * Update avatar
 */
const updateUserAvatar = async (userId, avatarUrl) => {
    const user = await user_model_1.UserModel.findByIdAndUpdate(userId, {
        $set: {
            avatar: avatarUrl,
        },
    }, {
        new: true,
        runValidators: true,
    }).select("-__v");
    return user;
};
exports.updateUserAvatar = updateUserAvatar;
const setUserOnline = async (userId) => {
    const user = await user_model_1.UserModel.findByIdAndUpdate(userId, {
        $set: {
            isOnline: true,
        },
    }, {
        new: true,
    });
    return user;
};
exports.setUserOnline = setUserOnline;
const setUserOffline = async (userId) => {
    const user = await user_model_1.UserModel.findByIdAndUpdate(userId, {
        $set: {
            isOnline: false,
            lastSeen: new Date(),
        },
    }, {
        new: true,
    });
    return user;
};
exports.setUserOffline = setUserOffline;
const blockUser = async (currentUserId, targetUserId) => {
    if (!mongoose_1.Types.ObjectId.isValid(currentUserId) ||
        !mongoose_1.Types.ObjectId.isValid(targetUserId)) {
        throw new Error("Invalid user ID");
    }
    if (currentUserId === targetUserId) {
        throw new Error("You cannot block yourself");
    }
    const currentUserObjectId = new mongoose_1.Types.ObjectId(currentUserId);
    const targetUserObjectId = new mongoose_1.Types.ObjectId(targetUserId);
    const targetUser = await user_model_1.UserModel.findById(targetUserObjectId).select("_id");
    if (!targetUser) {
        throw new Error("User not found");
    }
    // Block in both directions
    const [currentUser] = await Promise.all([
        user_model_1.UserModel.findByIdAndUpdate(currentUserObjectId, {
            $addToSet: {
                blockedUsers: targetUserObjectId,
            },
        }, {
            new: true,
        }).select("blockedUsers"),
        user_model_1.UserModel.findByIdAndUpdate(targetUserObjectId, {
            $addToSet: {
                blockedUsers: currentUserObjectId,
            },
        }).select("_id"),
    ]);
    if (!currentUser) {
        throw new Error("User not found");
    }
    // Invalidate both users' profile cache
    await Promise.all([
        (0, cache_service_1.deleteCache)(cache_keys_1.cacheKeys.userProfile(currentUserId)),
        (0, cache_service_1.deleteCache)(cache_keys_1.cacheKeys.userProfile(targetUserId)),
    ]);
    return currentUser;
};
exports.blockUser = blockUser;
const unblockUser = async (currentUserId, targetUserId) => {
    if (!mongoose_1.Types.ObjectId.isValid(currentUserId) ||
        !mongoose_1.Types.ObjectId.isValid(targetUserId)) {
        throw new Error("Invalid user ID");
    }
    if (currentUserId === targetUserId) {
        throw new Error("You cannot unblock yourself");
    }
    const currentUserObjectId = new mongoose_1.Types.ObjectId(currentUserId);
    const targetUserObjectId = new mongoose_1.Types.ObjectId(targetUserId);
    const targetUser = await user_model_1.UserModel.findById(targetUserObjectId).select("_id");
    if (!targetUser) {
        throw new Error("User not found");
    }
    // Remove block in both directions
    const [currentUser] = await Promise.all([
        user_model_1.UserModel.findByIdAndUpdate(currentUserObjectId, {
            $pull: {
                blockedUsers: targetUserObjectId,
            },
        }, {
            new: true,
        }).select("blockedUsers"),
        user_model_1.UserModel.findByIdAndUpdate(targetUserObjectId, {
            $pull: {
                blockedUsers: currentUserObjectId,
            },
        }).select("_id"),
    ]);
    if (!currentUser) {
        throw new Error("User not found");
    }
    // Invalidate both users' profile cache
    await Promise.all([
        (0, cache_service_1.deleteCache)(cache_keys_1.cacheKeys.userProfile(currentUserId)),
        (0, cache_service_1.deleteCache)(cache_keys_1.cacheKeys.userProfile(targetUserId)),
    ]);
    return currentUser;
};
exports.unblockUser = unblockUser;
const getBlockStatus = async (currentUserId, targetUserId) => {
    if (!mongoose_1.Types.ObjectId.isValid(currentUserId) ||
        !mongoose_1.Types.ObjectId.isValid(targetUserId)) {
        throw new Error("Invalid user ID");
    }
    if (currentUserId === targetUserId) {
        throw new Error("You cannot check block status for yourself");
    }
    const currentUserObjectId = new mongoose_1.Types.ObjectId(currentUserId);
    const targetUserObjectId = new mongoose_1.Types.ObjectId(targetUserId);
    const [currentUser, targetUser] = await Promise.all([
        user_model_1.UserModel.findById(currentUserObjectId).select("blockedUsers"),
        user_model_1.UserModel.findById(targetUserObjectId).select("blockedUsers"),
    ]);
    if (!currentUser) {
        throw new Error("User not found");
    }
    if (!targetUser) {
        throw new Error("User not found");
    }
    const currentUserBlockedTarget = currentUser.blockedUsers.some((id) => id.toString() === targetUserId);
    const targetUserBlockedCurrent = targetUser.blockedUsers.some((id) => id.toString() === currentUserId);
    return {
        isBlocked: currentUserBlockedTarget ||
            targetUserBlockedCurrent,
    };
};
exports.getBlockStatus = getBlockStatus;
