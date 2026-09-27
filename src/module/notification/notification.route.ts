import {
  Router,
} from "express";

import {
  authMiddleware,
} from "../../middleware/auth.middleware";

import {
  registerPushTokenController,
  removePushTokenController,
} from "./notification.controller";

const notificationRouter =Router();

notificationRouter.post(
  "/token",
  authMiddleware,
  registerPushTokenController,
);

notificationRouter.delete(
  "/token",
  authMiddleware,
  removePushTokenController,
);

export default notificationRouter;