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
    user.pushTokens = user.pushTokens.filter((item) => item.token !== token);
    await user.save();
    return user;
};
exports.removePushToken = removePushToken;
const sendPushNotification = async ({ tokens, title, body, data = {}, }) => {
    if (!tokens.length) {
        console.log("No FCM tokens found");
        return;
    }
    console.log("=================================");
    console.log("FCM SEND DEBUG");
    console.log("Token count:", tokens.length);
    console.log("Title:", title);
    console.log("Body:", body);
    console.log("Data:", data);
    console.log("=================================");
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
    try {
        const responses = await firebase_1.firebaseMessaging.sendEach(messages);
        responses.responses.forEach((response, index) => {
            if (response.success) {
                console.log(`✅ FCM token ${index + 1} sent successfully`);
            }
            else {
                console.error(`❌ FCM token ${index + 1} failed`);
                console.error("FCM error code:", response.error?.code);
                console.error("FCM error message:", response.error?.message);
                console.error("Full FCM error:", response.error);
            }
        });
        const successCount = responses.responses.filter((response) => response.success).length;
        const failureCount = responses.responses.filter((response) => !response.success).length;
        console.log(`Push notification: ${successCount} sent, ${failureCount} failed`);
        return responses;
    }
    catch (error) {
        console.error("Push notification request failed:", error);
    }
};
exports.sendPushNotification = sendPushNotification;
