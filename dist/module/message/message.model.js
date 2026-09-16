"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessageModel = void 0;
const mongoose_1 = require("mongoose");
const attachmentSchema = new mongoose_1.Schema({
    type: {
        type: String,
        enum: ["image", "video", "file", "audio"],
        required: true,
    },
    url: {
        type: String,
        required: true,
    },
    publicId: {
        type: String,
        required: true,
    },
    fileName: {
        type: String,
        required: true,
    },
    mimeType: {
        type: String,
        required: true,
    },
    size: {
        type: Number,
        required: true,
    },
}, {
    _id: false,
});
const messageSchema = new mongoose_1.Schema({
    conversationId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "Conversation",
        required: true,
    },
    senderId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    text: {
        type: String,
        default: "",
        trim: true,
    },
    attachments: {
        type: [attachmentSchema],
        default: [],
    },
    isEdited: {
        type: Boolean,
        default: false,
    },
    isDeleted: {
        type: Boolean,
        default: false,
    },
    deletedAt: {
        type: Date,
        default: null,
    },
    deliveredTo: [
        {
            type: mongoose_1.Schema.Types.ObjectId,
            ref: "User",
        },
    ],
    readBy: [
        {
            type: mongoose_1.Schema.Types.ObjectId,
            ref: "User",
        },
    ],
    reactions: [
        {
            userId: {
                type: mongoose_1.Schema.Types.ObjectId,
                ref: "User",
                required: true,
            },
            emoji: {
                type: String,
                required: true,
            },
            createdAt: {
                type: Date,
                default: Date.now,
            },
        },
    ],
    replyTo: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "Message",
        default: null,
    },
    isForwarded: {
        type: Boolean,
        default: false,
    },
    forwardedFrom: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "Message",
        default: null,
    },
}, {
    timestamps: true,
});
/*
  Important validation:
  Message must contain either:
  - text
  OR
  - attachment
*/
messageSchema.pre("validate", function (next) {
    if (this.isDeleted) {
        return next();
    }
    const hasText = typeof this.text === "string" && this.text.trim().length > 0;
    const hasAttachments = this.attachments && this.attachments.length > 0;
    if (!hasText && !hasAttachments) {
        return next(new Error("Message must contain text or attachment"));
    }
    next();
});
exports.MessageModel = (0, mongoose_1.model)("Message", messageSchema);
