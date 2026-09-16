"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.removePushTokenController = exports.registerPushTokenController = void 0;
const notification_service_1 = require("./notification.service");
const registerPushTokenController = async (req, res) => {
    try {
        const currentUserId = req.user?.userId;
        if (!currentUserId) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized",
            });
        }
        const { token, device } = req.body;
        if (!token || typeof token !== "string") {
            return res.status(400).json({
                success: false,
                message: "Valid push token is required",
            });
        }
        await (0, notification_service_1.registerPushToken)(currentUserId, token, device);
        return res.status(200).json({
            success: true,
            message: "Push token registered successfully",
        });
    }
    catch (error) {
        console.error("Register push token error:", error);
        const message = error instanceof Error ? error.message : "Failed to register push token";
        return res.status(400).json({
            success: false,
            message,
        });
    }
};
exports.registerPushTokenController = registerPushTokenController;
const removePushTokenController = async (req, res) => {
    try {
        const currentUserId = req.user?.userId;
        if (!currentUserId) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized",
            });
        }
        const { token } = req.body;
        if (!token || typeof token !== "string") {
            return res.status(400).json({
                success: false,
                message: "Valid push token is required",
            });
        }
        await (0, notification_service_1.removePushToken)(currentUserId, token);
        return res.status(200).json({
            success: true,
            message: "Push token removed successfully",
        });
    }
    catch (error) {
        console.error("Remove push token error:", error);
        const message = error instanceof Error ? error.message : "Failed to remove push token";
        return res.status(400).json({
            success: false,
            message,
        });
    }
};
exports.removePushTokenController = removePushTokenController;
