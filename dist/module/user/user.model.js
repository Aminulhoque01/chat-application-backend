"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserModel = void 0;
const mongoose_1 = require("mongoose");
const pushTokenSchema = new mongoose_1.Schema({
    token: {
        type: String,
        required: true,
    },
    device: {
        type: String,
        default: "web",
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
}, {
    _id: false,
});
const userSchema = new mongoose_1.Schema({
    phone: {
        type: String,
        required: true,
        unique: true,
        index: true,
        trim: true,
    },
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100,
    },
    avatar: {
        type: String,
        default: null,
    },
    bio: {
        type: String,
        maxlength: 500,
        default: "",
    },
    isOnline: {
        type: Boolean,
        default: false,
    },
    lastSeen: {
        type: Date,
        default: null,
    },
    // ==========================================
    // Firebase / Push Notification Tokens
    // ==========================================
    pushTokens: {
        type: [pushTokenSchema],
        default: [],
    },
    blockedUsers: {
        type: [
            {
                type: mongoose_1.Schema.Types.ObjectId,
                ref: "User",
            },
        ],
        default: [],
    },
}, {
    timestamps: true,
    versionKey: false,
});
exports.UserModel = (0, mongoose_1.model)("User", userSchema);
