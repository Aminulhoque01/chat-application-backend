"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_controller_1 = require("./auth.controller");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const authRouter = (0, express_1.Router)();
authRouter.post("/login", auth_controller_1.login);
authRouter.get("/me", auth_middleware_1.authMiddleware, auth_controller_1.me);
exports.default = authRouter;
