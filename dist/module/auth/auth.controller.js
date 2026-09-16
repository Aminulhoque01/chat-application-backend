"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.me = exports.login = void 0;
const auth_validation_1 = require("./auth.validation");
const auth_service_1 = require("./auth.service");
const login = async (req, res) => {
    try {
        const result = auth_validation_1.loginSchema.safeParse(req.body);
        if (!result.success) {
            return res.status(400).json({
                success: false,
                message: "Validation failed",
                errors: result.error.flatten(),
            });
        }
        const { phone, name } = result.data;
        const resultData = await (0, auth_service_1.loginUser)({
            phone,
            name,
        });
        return res.status(200).json({
            success: true,
            message: "Login successful",
            data: {
                token: resultData.token,
                user: resultData.user,
            },
        });
    }
    catch (error) {
        console.error("Login error:", error);
        return res.status(500).json({
            success: false,
            message: "Login failed",
        });
    }
};
exports.login = login;
const me = async (req, res) => {
    try {
        if (!req.user?.userId) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized",
            });
        }
        const user = await (0, auth_service_1.getCurrentUser)(req.user?.userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }
        return res.status(200).json({
            success: true,
            message: "Current user fetched successfully",
            data: user,
        });
    }
    catch (error) {
        console.error("Get me error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to get current user",
        });
    }
};
exports.me = me;
