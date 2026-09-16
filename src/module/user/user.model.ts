import { Schema, model } from "mongoose";

import { IPushToken, IUser } from "./user.interface";

const pushTokenSchema = new Schema<IPushToken>(
  {
    token: {
      type: String,
      required: true,
    },

    device: {
      type: String,
      default: "web",
    },

    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    _id: false,
  },
);

const userSchema = new Schema<IUser>(
  {
    phone: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    avatar: {
      type: String,
      default: null,
    },

    bio: {
      type: String,
      maxlength: 500,
      default: "",
    },

    isOnline: {
      type: Boolean,
      default: false,
    },

    lastSeen: {
      type: Date,
      default: null,
    },

    // ==========================================
    // Firebase / Push Notification Tokens
    // ==========================================

    pushTokens: {
      type: [pushTokenSchema],

      default: [],
    },

    blockedUsers: {
      type: [
        {
          type: Schema.Types.ObjectId,
          ref: "User",
        },
      ],
      default: [],
    },
  },
  {
    timestamps: true,

    versionKey: false,
  },
);

export const UserModel = model<IUser>("User", userSchema);
