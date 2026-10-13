import express from "express";
import cors from "cors";

import authRouter from "./module/auth/auth.route";
import userRouter from "./module/user/user.route";
import conversationRouter from "./module/conversation/conversation.route";
import messageRouter from "./module/message/message.route";
import notificationRouter from "./module/notification/notification.route";
import blockRouter from "./module/block/block.route";

import { env } from "./config/env";

const app = express();

app.use(
  cors({
    origin: env.CLIENT_URL,
    credentials: true,
  }),
);

const allowedOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/health", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "Chat API is running",
  });
});

app.use("/api/user", userRouter);
app.use("/api/auth", authRouter);
app.use("/api/block", blockRouter);
app.use("/api/conversation", conversationRouter);
app.use("/api/message", messageRouter);
app.use("/api/notifications", notificationRouter);

export default app;