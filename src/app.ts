import express from "express";
import cors from "cors";

import authRouter from "./module/auth/auth.route";
import userRouter from "./module/user/user.route";
import conversationRouter from "./module/conversation/conversation.route";
import messageRouter from "./module/message/message.route";
import notificationRouter from "./module/notification/notification.route";

const app = express();

app.use(
  cors({
    origin: true,
    credentials: true,
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
app.use("/api/conversation", conversationRouter);
app.use("/api/message", messageRouter);
app.use("api/notifications", notificationRouter);

export default app;
