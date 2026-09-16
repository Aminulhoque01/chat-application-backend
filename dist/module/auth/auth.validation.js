"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loginSchema = void 0;
const zod_1 = require("zod");
exports.loginSchema = zod_1.z.object({
    phone: zod_1.z
        .string()
        .min(5, "Phone number is required")
        .max(20, "Invalid phone number"),
    name: zod_1.z
        .string()
        .min(2, "Name must be at least 2 characters")
        .max(100, "Name cannot exceed 100 characters")
        .trim(),
});
