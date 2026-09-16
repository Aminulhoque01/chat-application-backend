"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendPushNotification = exports.removePushToken = exports.registerPushToken = void 0;
const firebase_1 = require("../../config/firebase");
const user_model_1 = require("../user/user.model");
const registerPushToken = async (currentUserId, token, device = "web") => {
    if (!token?.trim()) {
        throw new Error("Push token is required");
    }
    const user = await user_model_1.UserModel.findById(currentUserId);
    if (!user) {
        throw new Error("User not found");
    }
    const tokenExists = user.pushTokens.some((item) => item.token === token);
    if (tokenExists) {
        return user;
    }
    user.pushTokens.push({
        token: token.trim(),
        device,
        createdAt: new Date(),
    });
    await user.save();
    return user;
};
exports.registerPushToken = registerPushToken;
const removePushToken = async (currentUserId, token) => {
    if (!token?.trim()) {
        throw new Error("Push token is required");
    }
    const user = await user_model_1.UserModel.findById(currentUserId);
    if (!user) {
        throw new Error("User not found");
    }
    user.pushTokens =
        user.pushTokens.filter((item) => item.token !== token);
    await user.save();
    return user;
};
exports.removePushToken = removePushToken;
const sendPushNotification = async ({ tokens, title, body, data = {}, }) => {
    if (!tokens.length) {
        return;
    }
    try {
        const messages = tokens.map((token) => ({
            token,
            notification: {
                title,
                body,
            },
            data,
            webpush: {
                notification: {
                    icon: "/icon-192x192.png",
                },
            },
        }));
        const responses = await firebase_1.firebaseMessaging.sendEach(messages);
        const successCount = responses.responses.filter((response) => response.success).length;
        const failureCount = responses.responses.filter((response) => !response.success).length;
        console.log(`Push notification: ${successCount} sent, ${failureCount} failed`);
        return responses;
    }
    catch (error) {
        console.error("Push notification error:", error);
    }
};
exports.sendPushNotification = sendPushNotification;
