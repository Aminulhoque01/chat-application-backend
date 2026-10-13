import { Types } from "mongoose";

export type CallType = "audio" | "video";

export type CallStatus =
  | "ringing"
  | "accepted"
  | "rejected"
  | "cancelled"
  | "missed"
  | "completed";

export interface ICall {
  caller: Types.ObjectId;
  receiver: Types.ObjectId;

  type: CallType;
  status: CallStatus;

  startedAt?: Date;
  answeredAt?: Date;
  endedAt?: Date;

  duration?: number;

  createdAt?: Date;
  updatedAt?: Date;
}