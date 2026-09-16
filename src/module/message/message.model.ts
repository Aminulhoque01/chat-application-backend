import { Schema, model } from "mongoose";

import { IAttachment, IMessage } from "./message.interface";

const attachmentSchema = new Schema<IAttachment>(
  {
    type: {
      type: String,
      enum: ["image", "video", "file", "audio"],
      required: true,
    },

    url: {
      type: String,
      required: true,
    },

    publicId: {
      type: String,
      required: true,
    },

    fileName: {
      type: String,
      required: true,
    },

    mimeType: {
      type: String,
      required: true,
    },

    size: {
      type: Number,
      required: true,
    },
  },
  {
    _id: false,
  },
);

const messageSchema = new Schema<IMessage>(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
    },

    senderId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    text: {
      type: String,
      default: "",
      trim: true,
    },

    attachments: {
      type: [attachmentSchema],
      default: [],
    },

    isEdited: {
      type: Boolean,
      default: false,
    },

    isDeleted: {
      type: Boolean,
      default: false,
    },

    deletedAt: {
      type: Date,
      default: null,
    },

    deliveredTo: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    readBy: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    reactions: [
      {
        userId: {
          type: Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },

        emoji: {
          type: String,
          required: true,
        },

        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    replyTo: {
      type: Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },

    isForwarded: {
      type: Boolean,
      default: false,
    },

    forwardedFrom: {
      type: Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

/*
  Important validation:
  Message must contain either:
  - text
  OR
  - attachment
*/
messageSchema.pre("validate", function (next) {
  if (this.isDeleted) {
    return next();
  }

  const hasText = typeof this.text === "string" && this.text.trim().length > 0;

  const hasAttachments = this.attachments && this.attachments.length > 0;

  if (!hasText && !hasAttachments) {
    return next(new Error("Message must contain text or attachment"));
  }

  next();
});

export const MessageModel = model<IMessage>("Message", messageSchema);
