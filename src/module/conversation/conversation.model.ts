import { Schema, model } from "mongoose";

import {
  IConversation,
  ConversationType,
} from "./conversation.interface";

const conversationSchema =
  new Schema<IConversation>(
    {
      type: {
        type: String,
        enum: ["direct", "group"] satisfies ConversationType[],
        required: true,
        index: true,
      },
  
      participants: [
        {
          type: Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
      ],

      name: {
        type: String,
        trim: true,
        maxlength: 100,
      },

         // ==========================================
      // GROUP PHOTO
      // ==========================================

      groupPhoto: {
        type: String,
        default: null,
      },

      admins: [
        {
          type: Schema.Types.ObjectId,
          ref: "User",
        },
      ],

      createdBy: {
        type: Schema.Types.ObjectId,
        ref: "User",
      },

      lastMessage: {
        type: Schema.Types.ObjectId,
        ref: "Message",
        default: null,
      },
    },
    {
      timestamps: true,
      versionKey: false,
    },
  );

export const ConversationModel =
  model<IConversation>(
    "Conversation",
    conversationSchema,
  );