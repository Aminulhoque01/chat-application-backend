import { Socket } from "socket.io";

export interface ClientToServerEvents {
  // ==========================================
  // Conversation
  // ==========================================

  "conversation:join": (payload: {
    conversationId: string;
  }) => void;

  "conversation:leave": (payload: {
    conversationId: string;
  }) => void;

  /**
   * Mark all unread messages of a conversation
   * as read for the current user.
   *
   * This is triggered when the user opens/sees
   * a conversation.
   */
  "conversation:read": (payload: {
    conversationId: string;
  }) => void;

  // ==========================================
  // Message
  // ==========================================

  "message:send": (payload: {
    conversationId: string;
    text: string;
    replyTo?: string;
  }) => void;

  "message:reaction": (payload: {
    messageId: string;
    emoji: string;
  }) => void;

  "message:edit": (payload: {
    messageId: string;
    text: string;
  }) => void;

  "message:delete": (payload: {
    messageId: string;
  }) => void;

  "message:deleted": (data: {
    messageId: string;
    conversationId: string;
    isDeleted: boolean;
    deletedAt: Date | null;
  }) => void;

  "message:delivered": (payload: {
    messageId: string;
  }) => void;

  /**
   * Mark one specific message as read.
   *
   * Existing functionality remains.
   */
  "message:read": (payload: {
    messageId: string;
  }) => void;

  // ==========================================
  // Typing
  // ==========================================

  "typing:start": (payload: {
    conversationId: string;
  }) => void;

  "typing:stop": (payload: {
    conversationId: string;
  }) => void;
}

export interface ServerToClientEvents {
  // ==========================================
  // Conversation
  // ==========================================

  "conversation:joined": (data: {
    conversationId: string;
  }) => void;

  "conversation:left": (data: {
    conversationId: string;
  }) => void;

  "conversation:error": (data: {
    message: string;
    conversationId?: string;
  }) => void;

  /**
   * Sent after the current user marks all unread
   * messages of a conversation as read.
   *
   * messageIds contains the messages that were
   * actually changed in the database.
   */
  "conversation:read:update": (data: {
    conversationId: string;
    userId: string;
    messageIds: string[];
  }) => void;

  // ==========================================
  // Message
  // ==========================================

  "message:new": (message: any) => void;

  "message:reaction:update": (data: {
    messageId: string;
    conversationId: string;
    action: "added" | "removed";

    reactionSummary: Array<{
      emoji: string;
      count: number;
      userIds: string[];
    }>;
  }) => void;

  "message:delivery:update": (data: {
    messageId: string;
    userId: string;
  }) => void;

  "message:edit": (payload: {
    messageId: string;
    text: string;
  }) => void;

  "message:delete": (payload: {
    messageId: string;
  }) => void;

  /**
   * Existing single-message read receipt.
   */
  "message:read:update": (data: {
    messageId: string;
    conversationId: string;
    userId: string;
  }) => void;

  "message:error": (data: {
    message: string;
  }) => void;

  // ==========================================
  // Typing
  // ==========================================

  "typing:start": (data: {
    conversationId: string;
    userId: string;
  }) => void;

  "typing:stop": (data: {
    conversationId: string;
    userId: string;
  }) => void;

  // ==========================================
  // Block
  // ==========================================

  "user:blocked": (data: {
    blockerId: string;
    blockedId: string;
  }) => void;

  "user:unblocked": (data: {
    blockerId: string;
    blockedId: string;
  }) => void;
}

// ==========================================
// Server To Server
// ==========================================

export interface InterServerEvents {}

// ==========================================
// Socket Data
// ==========================================

export interface SocketData {
  userId: string;
}

// ==========================================
// Authenticated Socket
// ==========================================

export type AuthenticatedSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;