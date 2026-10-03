import { Types } from "mongoose";

export type AttachmentType =
  | "image"
  | "video"
  | "file"
  | "audio";

export type MessageType =
  | "text"
  | "system";

export interface IAttachment {
  type: AttachmentType;
  url: string;
  publicId: string;
  fileName: string;
  mimeType: string;
  size: number;
}

export interface IMessageReaction {
  userId: Types.ObjectId;
  emoji: string;
  createdAt: Date;
}

export interface IMessage {
  conversationId: Types.ObjectId;

  senderId: Types.ObjectId;

  type: MessageType;

  text: string;

  attachments: IAttachment[];

  isEdited: boolean;

  isDeleted: boolean;

  deletedAt: Date | null;

  deliveredTo: Types.ObjectId[];

  readBy: Types.ObjectId[];

  reactions: IMessageReaction[];

  replyTo?: Types.ObjectId | null;

  isForwarded?: boolean;

  forwardedFrom?: Types.ObjectId | null;
}

