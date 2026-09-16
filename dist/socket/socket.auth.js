"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.socketAuth = void 0;
const jwt_1 = require("../utils/jwt");
const socketAuth = (socket, next) => {
    try {
        const token = socket.handshake.auth?.token;
        if (!token ||
            typeof token !== "string") {
            return next(new Error("Authentication required"));
        }
        const decoded = (0, jwt_1.verifyToken)(token);
        socket.data.userId =
            decoded.userId;
        next();
    }
    catch (error) {
        console.error("Socket authentication failed:", error);
        next(new Error("Invalid or expired token"));
    }
};
exports.socketAuth = socketAuth;
