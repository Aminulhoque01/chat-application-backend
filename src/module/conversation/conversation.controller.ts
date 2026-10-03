import { Request, Response } from "express";
import { addParticipantsSchema, createDirectConversationSchema, createGroupSchema, promoteAdminSchema, renameGroupSchema } from "./conversation.validation";
import { addParticipantsToGroup, createDirectConversation, createGroupConversation, deleteGroupConversation, getMyConversations, promoteMemberToAdmin, removeParticipantFromGroup, renameGroupConversation, updateGroupPhoto } from "./conversation.service";
 



export const createConversation = async (
  req: Request,
  res: Response,
) => {
  try {
     const currentUserId = req.user?.userId;

    if (!currentUserId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const result =
      createDirectConversationSchema.safeParse(
        req.body,
      );

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid request data",
        errors: result.error.flatten(),
      });
    }

    const conversation =
      await createDirectConversation(
        currentUserId,
        result.data.participantId,
      );

    return res.status(200).json({
      success: true,
      message:
        "Direct conversation created successfully",
      data: conversation,
    });
  } catch (error) {
    console.error(
      "Create conversation error:",
      error,
    );

    const message =
      error instanceof Error
        ? error.message
        : "Failed to create conversation";

    return res.status(400).json({
      success: false,
      message,
    });
  }
};

export const getConversations = async (
  req: Request,
  res: Response,
) => {
  try {
     const currentUserId = req.user?.userId;

    if (!currentUserId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const conversations =
      await getMyConversations(
        currentUserId,
      );

    return res.status(200).json({
      success: true,
      message:
        "Conversations fetched successfully",
      data: conversations,
    });
  } catch (error) {
    console.error(
      "Get conversations error:",
      error,
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch conversations",
    });
  }
};



export const createGroup = async (
  req: Request,
  res: Response,
) => {
  try {
    // Current logged-in user
    const currentUserId = req.user?.userId;

    if (!currentUserId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    // Validate request body
    const result =
      createGroupSchema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid request data",
        errors: result.error.flatten(),
      });
    }

    const {
      name,
      participantIds,
    } = result.data;

    // Create group
    const conversation =
      await createGroupConversation(
        currentUserId,
        name,
        participantIds,
      );

    return res.status(201).json({
      success: true,
      message: "Group created successfully",
      data: conversation,
    });
  } catch (error) {
    console.error(
      "Create group error:",
      error,
    );

    const message =
      error instanceof Error
        ? error.message
        : "Failed to create group";

    return res.status(400).json({
      success: false,
      message,
    });
  }
};



export const addParticipants = async (
  req: Request,
  res: Response,
) => {
  try {
    const currentUserId = req.user?.userId;

    if (!currentUserId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Conversation ID is required",
      });
    }

    // Validate body
    const result =
      addParticipantsSchema.safeParse(
        req.body,
      );

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid request data",
        errors: result.error.flatten(),
      });
    }

    const conversation =
      await addParticipantsToGroup(
        currentUserId,
        id as string,
        result.data.participantIds,
      );

    return res.status(200).json({
      success: true,
      message:
        "Participants added successfully",
      data: conversation,
    });
  } catch (error) {
    console.error(
      "Add participants error:",
      error,
    );

    const message =
      error instanceof Error
        ? error.message
        : "Failed to add participants";

    return res.status(400).json({
      success: false,
      message,
    });
  }
};


export const removeParticipant = async (
  req: Request,
  res: Response,
) => {
  try {
    const currentUserId = req.user?.userId;

    if (!currentUserId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const { id, userId } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Conversation ID is required",
      });
    }

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    const conversation =
      await removeParticipantFromGroup(
        currentUserId,
        id as string,
        userId as string,
      );

    return res.status(200).json({
      success: true,
      message:
        currentUserId === userId
          ? "You left the group successfully"
          : "Participant removed successfully",
      data: conversation,
    });
  } catch (error) {
    console.error(
      "Remove participant error:",
      error,
    );

    const message =
      error instanceof Error
        ? error.message
        : "Failed to remove participant";

    return res.status(400).json({
      success: false,
      message,
    });
  }
};


export const promoteAdmin = async (
  req: Request,
  res: Response,
) => {
  try {
    const currentUserId = req.user?.userId;

    if (!currentUserId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Conversation ID is required",
      });
    }

    const result =
      promoteAdminSchema.safeParse(
        req.body,
      );

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid request data",
        errors: result.error.flatten(),
      });
    }

    const conversation =
      await promoteMemberToAdmin(
        currentUserId,
        id as string,
        result.data.userId,
      );

    return res.status(200).json({
      success: true,
      message:
        "User promoted to admin successfully",
      data: conversation,
    });
  } catch (error) {
    console.error(
      "Promote admin error:",
      error,
    );

    const message =
      error instanceof Error
        ? error.message
        : "Failed to promote admin";

    return res.status(400).json({
      success: false,
      message,
    });
  }
};

export const renameGroup = async (
  req: Request,
  res: Response,
) => {
  try {
    const currentUserId = req.user?.userId;

    if (!currentUserId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Conversation ID is required",
      });
    }

    const result =
      renameGroupSchema.safeParse(
        req.body,
      );

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid request data",
        errors: result.error.flatten(),
      });
    }

    const conversation =
      await renameGroupConversation(
        currentUserId,
        id as string,
        result.data.name,
      );

    return res.status(200).json({
      success: true,
      message: "Group renamed successfully",
      data: conversation,
    });
  } catch (error) {
    console.error(
      "Rename group error:",
      error,
    );

    const message =
      error instanceof Error
        ? error.message
        : "Failed to rename group";

    return res.status(400).json({
      success: false,
      message,
    });
  }
};


export const updateGroupPhotoController =
  async (
    req: Request,
    res: Response,
  ) => {
    try {
      // ==========================================
      // CURRENT USER
      // ==========================================

      const currentUserId =
        req.user?.userId;

      if (!currentUserId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      // ==========================================
      // CONVERSATION ID
      // ==========================================

      const { id } =
        req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          message:
            "Conversation ID is required",
        });
      }

      // ==========================================
      // FILE
      // ==========================================

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message:
            "Group photo is required",
        });
      }

      // ==========================================
      // UPDATE PHOTO
      // ==========================================

      const conversation =
        await updateGroupPhoto(
          currentUserId,
          id as string,
          req.file,
        );

      return res.status(200).json({
        success: true,
        message:
          "Group photo updated successfully",
        data: conversation,
      });
    } catch (error) {
      console.error(
        "Update group photo error:",
        error,
      );

      const message =
        error instanceof Error
          ? error.message
          : "Failed to update group photo";

      return res.status(400).json({
        success: false,
        message,
      });
    }
  };


  export const deleteGroup =
  async (
    req: Request,
    res: Response,
  ) => {
    try {
      // ==========================================
      // CURRENT USER
      // ==========================================

      const currentUserId =
        req.user?.userId;

      if (!currentUserId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      // ==========================================
      // CONVERSATION ID
      // ==========================================

      const { id } =
        req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          message:
            "Conversation ID is required",
        });
      }

      // ==========================================
      // DELETE GROUP
      // ==========================================

      const result =
        await deleteGroupConversation(
          currentUserId,
          id as string,
        );

      return res.status(200).json({
        success: true,
        message:
          "Group deleted successfully",
        data: result,
      });
    } catch (error) {
      console.error(
        "Delete group error:",
        error,
      );

      const message =
        error instanceof Error
          ? error.message
          : "Failed to delete group";

      return res.status(400).json({
        success: false,
        message,
      });
    }
  };