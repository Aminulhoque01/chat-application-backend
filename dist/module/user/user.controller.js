"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUserByIdController = exports.updateAvatar = exports.updateProfile = exports.getUserProfile = exports.searchUser = exports.getAllUser = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const user_service_1 = require("./user.service");
const cloudinary_1 = require("../../utils/cloudinary");
/**
 * Get all users
 *
 * GET /api/users
 */
const getAllUser = async (req, res) => {
    try {
        const { search, phone, isOnline, page, limit, sortBy, sortOrder, } = req.query;
        const query = {};
        // Search
        if (typeof search === "string") {
            query.search = search;
        }
        // Phone
        if (typeof phone === "string") {
            query.phone = phone;
        }
        // Online filter
        if (isOnline === "true") {
            query.isOnline = true;
        }
        if (isOnline === "false") {
            query.isOnline = false;
        }
        // Page
        if (typeof page === "string") {
            const pageNumber = Number(page);
            if (Number.isInteger(pageNumber) &&
                pageNumber > 0) {
                query.page = pageNumber;
            }
        }
        // Limit
        if (typeof limit === "string") {
            const limitNumber = Number(limit);
            if (Number.isInteger(limitNumber) &&
                limitNumber > 0) {
                query.limit = limitNumber;
            }
        }
        // Sort field
        if (sortBy === "name" ||
            sortBy === "createdAt" ||
            sortBy === "updatedAt" ||
            sortBy === "lastSeen") {
            query.sortBy = sortBy;
        }
        // Sort order
        if (sortOrder === "asc" ||
            sortOrder === "desc") {
            query.sortOrder = sortOrder;
        }
        const users = await (0, user_service_1.getAllUsers)(query);
        return res.status(200).json({
            success: true,
            message: "Users fetched successfully",
            data: users,
        });
    }
    catch (error) {
        console.error("Get all users error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch users",
        });
    }
};
exports.getAllUser = getAllUser;
/**
 * Search users
 *
 * GET /api/users/search?query=rahim
 */
const searchUser = async (req, res) => {
    try {
        const { query, page, limit } = req.query;
        /**
         * query must be a string
         */
        if (typeof query !== "string") {
            return res.status(400).json({
                success: false,
                message: "Search query is required",
            });
        }
        const pageNumber = typeof page === "string"
            ? Number(page)
            : 1;
        const limitNumber = typeof limit === "string"
            ? Number(limit)
            : 20;
        const users = await (0, user_service_1.searchUsers)(query, pageNumber, limitNumber);
        return res.status(200).json({
            success: true,
            message: "Users searched successfully",
            data: users,
        });
    }
    catch (error) {
        console.error("Search user error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to search users",
        });
    }
};
exports.searchUser = searchUser;
/**
 * Get single user
 *
 * GET /api/users/:id
 */
const getUserProfile = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose_1.default.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid user ID",
            });
        }
        const user = await (0, user_service_1.getUserById)(id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }
        return res.status(200).json({
            success: true,
            message: "User profile fetched successfully",
            data: user,
        });
    }
    catch (error) {
        console.error("Get user profile error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch user profile",
        });
    }
};
exports.getUserProfile = getUserProfile;
/**
 * Update own profile
 *
 * PATCH /api/users/me/profile
 *
 * body:
 * {
 *   name: "...",
 *   bio: "..."
 * }
 */
const updateProfile = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized",
            });
        }
        const userId = req.user?.userId;
        if (!mongoose_1.default.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid user ID",
            });
        }
        const { name, bio } = req.body;
        if (name !== undefined &&
            typeof name !== "string") {
            return res.status(400).json({
                success: false,
                message: "Name must be a string",
            });
        }
        if (bio !== undefined &&
            typeof bio !== "string") {
            return res.status(400).json({
                success: false,
                message: "Bio must be a string",
            });
        }
        const user = await (0, user_service_1.updateUserProfile)(userId, {
            name,
            bio,
        });
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }
        return res.status(200).json({
            success: true,
            message: "Profile updated successfully",
            data: user,
        });
    }
    catch (error) {
        console.error("Update profile error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to update profile",
        });
    }
};
exports.updateProfile = updateProfile;
/**
 * Update own avatar
 *
 * PATCH /api/users/me/avatar
 */
const updateAvatar = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized",
            });
        }
        const userId = req.user?.userId;
        if (!mongoose_1.default.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid user ID",
            });
        }
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "Avatar image is required",
            });
        }
        const uploadedImage = await (0, cloudinary_1.uploadToCloudinary)(req.file.buffer, "chat-app/avatars");
        const user = await (0, user_service_1.updateUserAvatar)(userId, uploadedImage.secure_url);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }
        return res.status(200).json({
            success: true,
            message: "Avatar updated successfully",
            data: user,
        });
    }
    catch (error) {
        console.error("Update avatar error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to update avatar",
        });
    }
};
exports.updateAvatar = updateAvatar;
const getUserByIdController = async (req, res) => {
    try {
        const { id: userId, } = req.params;
        /**
         * ======================================
         * Validate target user ID
         * ======================================
         */
        if (!mongoose_1.default.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid user ID",
            });
        }
        /**
         * ======================================
         * Current logged-in user
         * ======================================
         */
        const viewerUserId = req.user?.userId;
        /**
         * ======================================
         * Get block-aware profile
         * ======================================
         */
        const user = await (0, user_service_1.getUserById)(userId, viewerUserId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }
        return res.status(200).json({
            success: true,
            data: user,
        });
    }
    catch (error) {
        console.error("Get user by ID error:", error);
        return res.status(500).json({
            success: false,
            message: error instanceof Error
                ? error.message
                : "Failed to get user",
        });
    }
};
exports.getUserByIdController = getUserByIdController;
