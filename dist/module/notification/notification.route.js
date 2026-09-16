"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const notification_controller_1 = require("./notification.controller");
const notificationRouter = (0, express_1.Router)();
notificationRouter.post("/token", auth_middleware_1.authMiddleware, notification_controller_1.registerPushTokenController);
notificationRouter.delete("/token", auth_middleware_1.authMiddleware, notification_controller_1.removePushTokenController);
exports.default = notificationRouter;
