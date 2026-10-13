import { Request, Response } from "express";

import { callService } from "./call.service";

const getMyCalls = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }
    const userId = req.user.userId;

    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;

    const result = await callService.getUserCalls(userId, page, limit);

    res.status(200).json({
      success: true,
      message: "Call history retrieved successfully",
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to retrieve call history",
      error,
    });
  }
};

export const callController = {
  getMyCalls,
};
