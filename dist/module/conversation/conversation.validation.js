"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renameGroupSchema = exports.promoteAdminSchema = exports.addParticipantsSchema = exports.createGroupSchema = exports.createDirectConversationSchema = void 0;
const zod_1 = require("zod");
exports.createDirectConversationSchema = zod_1.z.object({
    participantId: zod_1.z
        .string()
        .min(1, "Participant ID is required"),
});
exports.createGroupSchema = zod_1.z.object({
    name: zod_1.z
        .string()
        .trim()
        .min(1, "Group name is required")
        .max(100, "Group name cannot exceed 100 characters"),
    participantIds: zod_1.z
        .array(zod_1.z
        .string()
        .min(1, "Participant ID is required"))
        .min(2, "A group must have at least 3 members including you")
        .refine((ids) => new Set(ids).size === ids.length, {
        message: "Duplicate participant IDs are not allowed",
    }),
});
exports.addParticipantsSchema = zod_1.z.object({
    participantIds: zod_1.z
        .array(zod_1.z
        .string()
        .min(1, "Participant ID is required"))
        .min(1, "At least one participant is required")
        .refine((ids) => new Set(ids).size === ids.length, {
        message: "Duplicate participant IDs are not allowed",
    }),
});
exports.promoteAdminSchema = zod_1.z.object({
    userId: zod_1.z
        .string()
        .min(1, "User ID is required"),
});
exports.renameGroupSchema = zod_1.z.object({
    name: zod_1.z
        .string()
        .trim()
        .min(1, "Group name is required")
        .max(100, "Group name cannot exceed 100 characters"),
});
