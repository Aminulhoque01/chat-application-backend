import { Document, Types } from "mongoose";

export interface IPushToken {
  token: string;

  device?: string;

  createdAt: Date;
}

export interface IUser extends Document {
  _id: Types.ObjectId;

  phone: string;

  name: string;

  avatar?: string | null;

  bio?: string | null;

  isOnline: boolean;

  lastSeen?: Date | null;

  pushTokens: IPushToken[];
  blockedUsers: Types.ObjectId[];

  createdAt: Date;

  updatedAt: Date;
}

export interface GetUsersQuery {
  search?: string;

  phone?: string;

  isOnline?: boolean;

  page?: number;

  limit?: number;

  sortBy?: "name" | "createdAt" | "updatedAt" | "lastSeen";

  sortOrder?: "asc" | "desc";
}
