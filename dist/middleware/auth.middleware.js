"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const authMiddleware = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({
                success: false,
                message: "Authorization header is missing",
            });
        }
        const [type, token] = authHeader.split(" ");
        if (type !== "Bearer" ||
            !token) {
            return res.status(401).json({
                success: false,
                message: "Invalid authorization format",
            });
        }
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
        if (!decoded.userId) {
            return res.status(401).json({
                success: false,
                message: "Invalid token payload",
            });
        }
        req.user = {
            userId: decoded.userId,
        };
        next();
    }
    catch (error) {
        console.error("Auth middleware error:", error);
        return res.status(401).json({
            success: false,
            message: "Unauthorized",
        });
    }
};
exports.authMiddleware = authMiddleware;
