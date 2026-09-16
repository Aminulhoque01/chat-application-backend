import { Router } from "express";

import {
 
  getAllUser,
  getUserByIdController,
  getUserProfile,
  searchUser,
   
  updateAvatar,
  updateProfile,
} from "./user.controller";

import { uploadAvatar } from "../../middleware/upload.middleware";
import { authMiddleware } from "../../middleware/auth.middleware";
 

const userRouter = Router();

/**
 * Get all users
 *
 * GET /api/users
 *
 * Supports:
 * ?search=rahim
 * ?phone=017
 * ?isOnline=true
 * ?page=1
 * ?limit=20
 * ?sortBy=name
 * ?sortOrder=asc
 */
userRouter.get(
  "/",
  getAllUser,
);

/**
 * Search users
 *
 * GET /api/users/search?query=rahim
 */
userRouter.get(
  "/search",
  searchUser,
);

/**
 * Get my profile
 *
 * GET /api/users/me
 *
 * Optional but recommended
 */
 

/**
 * Update my profile
 *
 * PATCH /api/users/me/profile
 */
userRouter.patch(
  "/me/profile",
  authMiddleware,
  updateProfile,
);

/**
 * Update my avatar
 *
 * PATCH /api/users/me/avatar
 *
 * multipart/form-data
 * field: avatar
 */
userRouter.patch(
  "/me/avatar",
  authMiddleware,
  uploadAvatar.single("avatar"),
  updateAvatar,
);

/**
 * Get single user
 *
 * GET /api/users/:id
 */
userRouter.get(
  "/:id",
  getUserByIdController,
);

 
export default userRouter;