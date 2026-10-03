import http from "http";

import app from "./app";

import { env } from "./config/env";

import { connectDB } from "./config/db";

import {
  connectRedis,
  disconnectRedis,
} from "./config/redis";

import { createSocketServer } from "./socket/socket.server";

const startServer = async () => {
  try {
    // MongoDB
    await connectDB();

    // Redis
    await connectRedis();

    // HTTP server
    const httpServer = http.createServer(app);

    // Socket.IO
    createSocketServer(httpServer);

    // Start server
    httpServer.listen(
      env.PORT,
      "0.0.0.0",
      () => {
        console.log(
          `Server running on port ${env.PORT}`,
        );
      },
    );

    // Graceful shutdown
    const shutdown = async () => {
      console.log("Shutting down server...");

      httpServer.close(async () => {
        try {
          await disconnectRedis();

          console.log("Server stopped");

          process.exit(0);
        } catch (error) {
          console.error(
            "Error during shutdown:",
            error,
          );

          process.exit(1);
        }
      });
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  } catch (error) {
    console.error(
      "Server failed to start:",
      error,
    );

    process.exit(1);
  }
};

startServer();