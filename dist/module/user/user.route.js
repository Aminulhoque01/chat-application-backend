"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const user_controller_1 = require("./user.controller");
const upload_middleware_1 = require("../../middleware/upload.middleware");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const userRouter = (0, express_1.Router)();
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
userRouter.get("/", user_controller_1.getAllUser);
/**
 * Search users
 *
 * GET /api/users/search?query=rahim
 */
userRouter.get("/search", user_controller_1.searchUser);
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
userRouter.patch("/me/profile", auth_middleware_1.authMiddleware, user_controller_1.updateProfile);
/**
 * Update my avatar
 *
 * PATCH /api/users/me/avatar
 *
 * multipart/form-data
 * field: avatar
 */
userRouter.patch("/me/avatar", auth_middleware_1.authMiddleware, upload_middleware_1.uploadAvatar.single("avatar"), user_controller_1.updateAvatar);
/**
 * Get single user
 *
 * GET /api/users/:id
 */
userRouter.get("/:id", user_controller_1.getUserProfile);
userRouter.post("/:id/block", auth_middleware_1.authMiddleware, user_controller_1.blockUserController);
userRouter.delete("/:id/block", auth_middleware_1.authMiddleware, user_controller_1.unblockUserController);
userRouter.get("/:id/block-status", auth_middleware_1.authMiddleware, user_controller_1.blockStatus);
exports.default = userRouter;
