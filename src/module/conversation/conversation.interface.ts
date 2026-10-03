import { Types } from "mongoose";

export type ConversationType = "direct" | "group";

export interface IConversation {
  _id?: Types.ObjectId;

  type: ConversationType;
   groupPhoto?: string;
  participants: Types.ObjectId[];

  // Group only
  name?: string;

  // Group admins
  admins: Types.ObjectId[];

  // Group creator
  createdBy?: Types.ObjectId;

  // Last message reference
  lastMessage?: Types.ObjectId | null;

  createdAt?: Date;

  updatedAt?: Date;
}