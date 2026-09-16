"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConversationModel = void 0;
const mongoose_1 = require("mongoose");
const conversationSchema = new mongoose_1.Schema({
    type: {
        type: String,
        enum: ["direct", "group"],
        required: true,
        index: true,
    },
    participants: [
        {
            type: mongoose_1.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
    ],
    name: {
        type: String,
        trim: true,
        maxlength: 100,
    },
    admins: [
        {
            type: mongoose_1.Schema.Types.ObjectId,
            ref: "User",
        },
    ],
    createdBy: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "User",
    },
    lastMessage: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "Message",
        default: null,
    },
}, {
    timestamps: true,
    versionKey: false,
});
exports.ConversationModel = (0, mongoose_1.model)("Conversation", conversationSchema);
