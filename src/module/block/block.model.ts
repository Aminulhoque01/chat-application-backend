import { Schema, model } from "mongoose";

import type { IBlock } from "./block.interface";

const blockSchema = new Schema<IBlock>(
  {
    blockerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    blockedId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

// Prevent duplicate block relationship.
//
// Example:
// A -> B
//
// This relationship can exist only once.
blockSchema.index(
  {
    blockerId: 1,
    blockedId: 1,
  },
  {
    unique: true,
  },
);

export const BlockModel = model<IBlock>("Block", blockSchema);
