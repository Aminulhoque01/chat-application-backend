import { Router } from "express";

import {
blockUserController,
unblockUserController,
blockStatus,
} from "./block.controller";

import {
authMiddleware,
} from "../../middleware/auth.middleware";

const blockRouter = Router();

/**

* Block a user
* POST /api/block/:id
  */
 blockRouter.post(
  "/:id",
  authMiddleware,
  blockUserController,
  );

/**

* Unblock a user
* DELETE /api/block/:id
  */
  blockRouter.delete(
  "/:id",
  authMiddleware,
  unblockUserController,
  );

/**

* Get block status
* GET /api/block/status/:id
  */
  blockRouter.get(
  "/status/:id",
  authMiddleware,
  blockStatus,
  );

export default blockRouter;
