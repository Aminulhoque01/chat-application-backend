"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setUserOffline = exports.setUserOnline = exports.updateUserAvatar = exports.updateUserProfile = exports.getUserById = exports.searchUsers = exports.getAllUsers = void 0;
const mongoose_1 = require("mongoose");
const cache_keys_1 = require("../../cache/cache.keys");
const cache_service_1 = require("../../cache/cache.service");
const user_model_1 = require("./user.model");
const block_model_1 = require("../block/block.model");
/**
 * ==========================================
 * Get all users
 * ==========================================
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
     * Get users + total
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
 * ==========================================
 * Search users
 * ==========================================
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
const getUserById = async (targetUserId, viewerUserId) => {
    if (!mongoose_1.Types.ObjectId.isValid(targetUserId)) {
        return null;
    }
    const cacheKey = cache_keys_1.cacheKeys.userProfile(targetUserId);
    /**
     * ========================================
     * 1. Get base profile from Redis
     * ========================================
     */
    let user = await (0, cache_service_1.getCache)(cacheKey);
    if (user) {
        console.log("User profile: Redis HIT");
    }
    else {
        console.log("User profile: Redis MISS");
        /**
         * ======================================
         * 2. Get user from MongoDB
         * ======================================
         */
        user = await user_model_1.UserModel.findById(targetUserId).select("-__v").lean();
        if (!user) {
            return null;
        }
        /**
         * ======================================
         * 3. Cache only base user data
         * ======================================
         */
        await (0, cache_service_1.setCache)(cacheKey, user, 300);
    }
    /**
     * ========================================
     * Own profile
     * ========================================
     */
    if (!viewerUserId ||
        !mongoose_1.Types.ObjectId.isValid(viewerUserId) ||
        viewerUserId === targetUserId) {
        return user;
    }
    const viewerId = new mongoose_1.Types.ObjectId(viewerUserId);
    const targetId = new mongoose_1.Types.ObjectId(targetUserId);
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
    const block = await block_model_1.BlockModel.findOne({
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
exports.getUserById = getUserById;
/**
 * ==========================================
 * Update user profile
 * ==========================================
 */
const updateUserProfile = async (userId, data) => {
    const updateData = {};
    if (data.name !== undefined) {
        updateData.name = data.name.trim();
    }
    if (data.bio !== undefined) {
        updateData.bio = data.bio.trim();
    }
    const user = await user_model_1.UserModel.findByIdAndUpdate(userId, {
        $set: updateData,
    }, {
        new: true,
        runValidators: true,
    }).select("-__v");
    /**
     * Clear profile cache
     */
    await (0, cache_service_1.deleteCache)(cache_keys_1.cacheKeys.userProfile(userId));
    return user;
};
exports.updateUserProfile = updateUserProfile;
/**
 * ==========================================
 * Update avatar
 * ==========================================
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
    /**
     * Clear profile cache
     */
    await (0, cache_service_1.deleteCache)(cache_keys_1.cacheKeys.userProfile(userId));
    return user;
};
exports.updateUserAvatar = updateUserAvatar;
/**
 * ==========================================
 * Set user online
 * ==========================================
 */
const setUserOnline = async (userId) => {
    const user = await user_model_1.UserModel.findByIdAndUpdate(userId, {
        $set: {
            isOnline: true,
        },
    }, {
        new: true,
    });
    /**
     * IMPORTANT:
     * Do not cache online state.
     *
     * Presence should come from DB/socket.
     */
    await (0, cache_service_1.deleteCache)(cache_keys_1.cacheKeys.userProfile(userId));
    return user;
};
exports.setUserOnline = setUserOnline;
/**
 * ==========================================
 * Set user offline
 * ==========================================
 */
const setUserOffline = async (userId) => {
    const user = await user_model_1.UserModel.findByIdAndUpdate(userId, {
        $set: {
            isOnline: false,
            lastSeen: new Date(),
        },
    }, {
        new: true,
    });
    /**
     * Clear cached profile
     */
    await (0, cache_service_1.deleteCache)(cache_keys_1.cacheKeys.userProfile(userId));
    return user;
};
exports.setUserOffline = setUserOffline;
