import { Schema, model } from "mongoose";

import {
  CallStatus,
  CallType,
  ICall,
} from "./call.interface";

const callSchema = new Schema<ICall>(
  {
    caller: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    receiver: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    type: {
      type: String,
      enum: ["audio", "video"] satisfies CallType[],
      required: true,
    },

    status: {
      type: String,
      enum: [
        "ringing",
        "accepted",
        "rejected",
        "cancelled",
        "missed",
        "completed",
      ] satisfies CallStatus[],
      default: "ringing",
      index: true,
    },

    startedAt: {
      type: Date,
    },

    answeredAt: {
      type: Date,
    },

    endedAt: {
      type: Date,
    },

    duration: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
);

export const Call = model<ICall>("Call", callSchema);