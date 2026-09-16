"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSocketServer = void 0;
const socket_io_1 = require("socket.io");
const env_1 = require("../config/env");
const socket_auth_1 = require("./socket.auth");
const socket_handlers_1 = require("./socket.handlers");
const conversation_service_1 = require("../module/conversation/conversation.service");
const socket_instance_1 = require("./socket.instance");
const createSocketServer = (httpServer) => {
    const io = new socket_io_1.Server(httpServer, {
        cors: {
            origin: env_1.env.CLIENT_URL,
            credentials: true,
        },
    });
    // Store Socket.IO instance
    (0, socket_instance_1.setSocketIO)(io);
    console.log("Socket.IO initialized successfully");
    // JWT authentication
    io.use(socket_auth_1.socketAuth);
    io.on("connection", (socket) => {
        const userId = socket.data.userId;
        console.log(`Socket connected: ${socket.id}`, `userId: ${userId}`);
        /**
         * --------------------------------------------------
         * PRIVATE USER ROOM
         * --------------------------------------------------
         *
         * Every authenticated socket joins its own
         * private room.
         *
         * This allows the server to send events to a user
         * even when that user is NOT currently viewing
         * a specific conversation.
         *
         * Example:
         * user:64f123...
         */
        const userRoom = `user:${userId}`;
        socket.join(userRoom);
        console.log(`User ${userId} joined personal room ${userRoom}`);
        /**
         * Register message, typing, reaction,
         * delivery, read, etc. handlers.
         */
        (0, socket_handlers_1.registerSocketHandlers)(io, socket);
        /**
         * --------------------------------------------------
         * CONVERSATION JOIN
         * --------------------------------------------------
         */
        socket.on("conversation:join", async ({ conversationId }) => {
            try {
                if (!conversationId) {
                    socket.emit("conversation:error", {
                        message: "Conversation ID is required",
                    });
                    return;
                }
                const isMember = await (0, conversation_service_1.isConversationMember)(conversationId, userId);
                if (!isMember) {
                    socket.emit("conversation:error", {
                        message: "You are not a member of this conversation",
                        conversationId,
                    });
                    return;
                }
                await socket.join(conversationId);
                socket.emit("conversation:joined", {
                    conversationId,
                });
                console.log(`User ${userId} joined conversation ${conversationId}`);
            }
            catch (error) {
                console.error("conversation:join error:", error);
                socket.emit("conversation:error", {
                    message: "Failed to join conversation",
                });
            }
        });
        /**
         * --------------------------------------------------
         * CONVERSATION LEAVE
         * --------------------------------------------------
         */
        socket.on("conversation:leave", async ({ conversationId }) => {
            try {
                if (!conversationId) {
                    socket.emit("conversation:error", {
                        message: "Conversation ID is required",
                    });
                    return;
                }
                await socket.leave(conversationId);
                socket.emit("conversation:left", {
                    conversationId,
                });
                console.log(`User ${userId} left conversation ${conversationId}`);
            }
            catch (error) {
                console.error("conversation:leave error:", error);
                socket.emit("conversation:error", {
                    message: "Failed to leave conversation",
                });
            }
        });
        /**
         * --------------------------------------------------
         * DISCONNECT
         * --------------------------------------------------
         *
         * Socket.IO automatically removes the socket
         * from all rooms when disconnected.
         *
         * Personal room therefore needs no manual leave.
         */
        socket.on("disconnect", (reason) => {
            console.log(`Socket disconnected: ${socket.id}`, `userId: ${userId}`, `reason: ${reason}`);
        });
    });
    return io;
};
exports.createSocketServer = createSocketServer;
