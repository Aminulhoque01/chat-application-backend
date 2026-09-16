import { Request, Response } from "express";
import mongoose from "mongoose";

import {
 
  getAllUsers,
 
  getUserById,
  GetUsersQuery,
  searchUsers,
   
  updateUserAvatar,
  updateUserProfile,
} from "./user.service";

import { uploadToCloudinary } from "../../utils/cloudinary";
import { AuthRequest } from "../../middleware/auth.middleware";

/**
 * Get all users
 *
 * GET /api/users
 */
export const getAllUser = async (
  req: Request,
  res: Response,
) => {
  try {
    const {
      search,
      phone,
      isOnline,
      page,
      limit,
      sortBy,
      sortOrder,
    } = req.query;

    const query: GetUsersQuery = {};

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

      if (
        Number.isInteger(pageNumber) &&
        pageNumber > 0
      ) {
        query.page = pageNumber;
      }
    }

    // Limit
    if (typeof limit === "string") {
      const limitNumber = Number(limit);

      if (
        Number.isInteger(limitNumber) &&
        limitNumber > 0
      ) {
        query.limit = limitNumber;
      }
    }

    // Sort field
    if (
      sortBy === "name" ||
      sortBy === "createdAt" ||
      sortBy === "updatedAt" ||
      sortBy === "lastSeen"
    ) {
      query.sortBy = sortBy;
    }

    // Sort order
    if (
      sortOrder === "asc" ||
      sortOrder === "desc"
    ) {
      query.sortOrder = sortOrder;
    }

    const users = await getAllUsers(query);

    return res.status(200).json({
      success: true,
      message: "Users fetched successfully",
      data: users,
    });
  } catch (error) {
    console.error(
      "Get all users error:",
      error,
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch users",
    });
  }
};

/**
 * Search users
 *
 * GET /api/users/search?query=rahim
 */
export const searchUser = async (
  req: Request,
  res: Response,
) => {
  try {
    const { query, page, limit } =
      req.query;

    /**
     * query must be a string
     */
    if (typeof query !== "string") {
      return res.status(400).json({
        success: false,
        message:
          "Search query is required",
      });
    }

    const pageNumber =
      typeof page === "string"
        ? Number(page)
        : 1;

    const limitNumber =
      typeof limit === "string"
        ? Number(limit)
        : 20;

    const users = await searchUsers(
      query,
      pageNumber,
      limitNumber,
    );

    return res.status(200).json({
      success: true,
      message:
        "Users searched successfully",
      data: users,
    });
  } catch (error) {
    console.error(
      "Search user error:",
      error,
    );

    return res.status(500).json({
      success: false,
      message: "Failed to search users",
    });
  }
};

/**
 * Get single user
 *
 * GET /api/users/:id
 */
export const getUserProfile = async (
  req: Request,
  res: Response,
) => {
  try {
    const { id } = req.params;

    if (
      !mongoose.Types.ObjectId.isValid(id as string)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    const user = await getUserById(id as string);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      message:
        "User profile fetched successfully",
      data: user,
    });
  } catch (error) {
    console.error(
      "Get user profile error:",
      error,
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch user profile",
    });
  }
};

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
export const updateProfile = async (
  req: Request,
  res: Response,
) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const userId = req.user?.userId;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    const { name, bio } = req.body;

    if (
      name !== undefined &&
      typeof name !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "Name must be a string",
      });
    }

    if (
      bio !== undefined &&
      typeof bio !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "Bio must be a string",
      });
    }

    const user = await updateUserProfile(
      userId,
      {
        name,
        bio,
      },
    );

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
  } catch (error) {
    console.error(
      "Update profile error:",
      error,
    );

    return res.status(500).json({
      success: false,
      message: "Failed to update profile",
    });
  }
};

/**
 * Update own avatar
 *
 * PATCH /api/users/me/avatar
 */
export const updateAvatar = async (
  req: Request,
  res: Response,
) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const userId = req.user?.userId;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
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

    const uploadedImage =
      await uploadToCloudinary(
        req.file.buffer,
        "chat-app/avatars",
      );

    const user =
      await updateUserAvatar(
        userId,
        uploadedImage.secure_url,
      );

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
  } catch (error) {
    console.error(
      "Update avatar error:",
      error,
    );

    return res.status(500).json({
      success: false,
      message: "Failed to update avatar",
    });
  }
};


 