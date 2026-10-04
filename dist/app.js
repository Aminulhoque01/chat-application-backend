"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const auth_route_1 = __importDefault(require("./module/auth/auth.route"));
const user_route_1 = __importDefault(require("./module/user/user.route"));
const conversation_route_1 = __importDefault(require("./module/conversation/conversation.route"));
const message_route_1 = __importDefault(require("./module/message/message.route"));
const notification_route_1 = __importDefault(require("./module/notification/notification.route"));
const block_route_1 = __importDefault(require("./module/block/block.route"));
const env_1 = require("./config/env");
const app = (0, express_1.default)();
app.use((0, cors_1.default)({
    origin: env_1.env.CLIENT_URL,
    credentials: true,
}));
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
app.get("/health", (_req, res) => {
    res.status(200).json({
        success: true,
        message: "Chat API is running",
    });
});
app.use("/api/user", user_route_1.default);
app.use("/api/auth", auth_route_1.default);
app.use("/api/block", block_route_1.default);
app.use("/api/conversation", conversation_route_1.default);
app.use("/api/message", message_route_1.default);
app.use("/api/notifications", notification_route_1.default);
exports.default = app;
