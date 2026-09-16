"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.editMessageSchema = exports.getMessagesSchema = exports.sendMessageSchema = void 0;
const zod_1 = require("zod");
exports.sendMessageSchema = zod_1.z.object({
    conversationId: zod_1.z.string().min(1),
    text: zod_1.z.string().optional().default(""),
    replyTo: zod_1.z.string().optional(),
});
exports.getMessagesSchema = zod_1.z.object({
    params: zod_1.z.object({
        id: zod_1.z
            .string()
            .min(1, "Conversation ID is required"),
    }),
    query: zod_1.z.object({
        page: zod_1.z.coerce
            .number()
            .int()
            .positive()
            .default(1),
        limit: zod_1.z.coerce
            .number()
            .int()
            .positive()
            .max(100)
            .default(30),
    }),
});
exports.editMessageSchema = zod_1.z.object({
    params: zod_1.z.object({
        id: zod_1.z.string().min(1),
    }),
    body: zod_1.z.object({
        text: zod_1.z
            .string()
            .trim()
            .min(1)
            .max(5000),
    }),
});
