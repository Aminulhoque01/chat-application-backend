import { Router } from "express";

import { callController } from "./call.controller";
import { authMiddleware } from "../../middleware/auth.middleware";

 
const callRouter = Router();

callRouter.get(
  "/history",
  authMiddleware,
  callController.getMyCalls,
);

export default callRouter;