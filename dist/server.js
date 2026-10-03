"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = __importDefault(require("http"));
const app_1 = __importDefault(require("./app"));
const env_1 = require("./config/env");
const db_1 = require("./config/db");
const redis_1 = require("./config/redis");
const socket_server_1 = require("./socket/socket.server");
const startServer = async () => {
    try {
        // MongoDB
        await (0, db_1.connectDB)();
        // Redis
        await (0, redis_1.connectRedis)();
        // HTTP server
        const httpServer = http_1.default.createServer(app_1.default);
        // Socket.IO
        (0, socket_server_1.createSocketServer)(httpServer);
        // Start server
        httpServer.listen(env_1.env.PORT, "0.0.0.0", () => {
            console.log(`Server running on port ${env_1.env.PORT}`);
        });
        // Graceful shutdown
        const shutdown = async () => {
            console.log("Shutting down server...");
            httpServer.close(async () => {
                try {
                    await (0, redis_1.disconnectRedis)();
                    console.log("Server stopped");
                    process.exit(0);
                }
                catch (error) {
                    console.error("Error during shutdown:", error);
                    process.exit(1);
                }
            });
        };
        process.on("SIGINT", shutdown);
        process.on("SIGTERM", shutdown);
    }
    catch (error) {
        console.error("Server failed to start:", error);
        process.exit(1);
    }
};
startServer();
