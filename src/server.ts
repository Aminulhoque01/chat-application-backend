


import http from "http";

import app from "./app";

import {
  env,
} from "./config/env";

 import { connectDB } from "./config/db";

import {
  connectRedis,
  disconnectRedis,
} from "./config/redis";

import {
  createSocketServer,
} from "./socket/socket.server";

const startServer =
  async () => {
    try {
      // MongoDB
      await connectDB();

      // Redis
      await connectRedis();

      // HTTP server
      const httpServer =
        http.createServer(app);

      // Socket.IO
      createSocketServer(
        httpServer,
      );

      httpServer.listen(
        env.PORT,
        () => {
          console.log(
            `Server running on http://localhost:${env.PORT}`,
          );
        },
      );

      // Graceful shutdown
      const shutdown =
        async () => {
          console.log(
            "Shutting down server...",
          );

          httpServer.close(
            async () => {
              await disconnectRedis();

              console.log(
                "Server stopped",
              );

              process.exit(0);
            },
          );
        };

      process.on(
        "SIGINT",
        shutdown,
      );

      process.on(
        "SIGTERM",
        shutdown,
      );
    } catch (error) {
      console.error(
        "Server failed to start:",
        error,
      );

      process.exit(1);
    }
  };

startServer();