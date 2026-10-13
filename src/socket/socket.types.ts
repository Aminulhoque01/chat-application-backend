
import { Socket } from "socket.io";

// ==========================================
// Call Types
// ==========================================

export type CallType = "audio" | "video";

export type CallStatus =
  | "ringing"
  | "accepted"
  | "rejected"
  | "cancelled"
  | "missed"
  | "completed";

// ==========================================
// WebRTC Signaling Types
// ==========================================

export interface SessionDescription {
  type: "offer" | "answer";
  sdp: string | null;
}

export interface IceCandidate {
  candidate: string;
  sdpMid: string | null;
  sdpMLineIndex: number | null;
  usernameFragment?: string | null;
}

// ==========================================
// Client To Server Events
// ==========================================

export interface ClientToServerEvents {
  // Conversation
  "conversation:join": (payload: {
    conversationId: string;
  }) => void;

  "conversation:leave": (payload: {
    conversationId: string;
  }) => void;

  "conversation:read": (payload: {
    conversationId: string;
  }) => void;

  // Message
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

  "message:delivered": (payload: {
    messageId: string;
  }) => void;

  "message:read": (payload: {
    messageId: string;
  }) => void;

  // Typing
  "typing:start": (payload: {
    conversationId: string;
  }) => void;

  "typing:stop": (payload: {
    conversationId: string;
  }) => void;

  // Call: initiate audio/video call
  "call:initiate": (payload: {
    receiverId: string;
    type: CallType;
  }) => void;

  // WebRTC offer
  "call:offer": (payload: {
    callId: string;
    receiverId: string;
    offer: SessionDescription;
  }) => void;

  // WebRTC answer
  "call:answer": (payload: {
    callId: string;
    callerId: string;
    answer: SessionDescription;
  }) => void;

  // ICE candidate
  "call:ice-candidate": (payload: {
    callId: string;
    targetUserId: string;
    candidate: IceCandidate;
  }) => void;

  // Accept incoming call
  "call:accept": (payload: {
    callId: string;
    callerId: string;
  }) => void;

  // Reject incoming call
  "call:reject": (payload: {
    callId: string;
    callerId: string;
  }) => void;

  // Cancel outgoing call
  "call:cancel": (payload: {
    callId: string;
    receiverId: string;
  }) => void;

  // End active call
  "call:end": (payload: {
    callId: string;
    targetUserId: string;
  }) => void;
}

// ==========================================
// Server To Client Events
// ==========================================

export interface ServerToClientEvents {
  // Conversation
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

  "conversation:read:update": (data: {
    conversationId: string;
    userId: string;
    messageIds: string[];
  }) => void;

  // Message
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

  "message:deleted": (data: {
    messageId: string;
    conversationId: string;
    isDeleted: boolean;
    deletedAt: Date | null;
  }) => void;

  "message:read:update": (data: {
    messageId: string;
    conversationId: string;
    userId: string;
  }) => void;

  "message:error": (data: {
    message: string;
  }) => void;

  // Typing
  "typing:start": (data: {
    conversationId: string;
    userId: string;
  }) => void;

  "typing:stop": (data: {
    conversationId: string;
    userId: string;
  }) => void;

  // Block
  "user:blocked": (data: {
    blockerId: string;
    blockedId: string;
  }) => void;

  "user:unblocked": (data: {
    blockerId: string;
    blockedId: string;
  }) => void;

  // ==========================================
  // Call Events
  // ==========================================

  // Incoming call and caller confirmation
  "call:incoming": (data: {
    callId: string;
    callerId: string;
    receiverId: string;
    type: CallType;
    status: CallStatus;
  }) => void;

  // Receiver accepted the call
  "call:accepted": (data: {
    callId: string;
    receiverId: string;
  }) => void;

  // Receiver rejected the call
  "call:rejected": (data: {
    callId: string;
    receiverId: string;
  }) => void;

  // Receiver receives caller cancellation
  "call:cancelled": (data: {
    callId: string;
    callerId: string;
  }) => void;

  // WebRTC offer
  "call:offer": (data: {
    callId: string;
    callerId: string;
    offer: SessionDescription;
  }) => void;

  // WebRTC answer
  "call:answer": (data: {
    callId: string;
    receiverId: string;
    answer: SessionDescription;
  }) => void;

  // ICE candidate
  "call:ice-candidate": (data: {
    callId: string;
    senderId: string;
    candidate: IceCandidate;
  }) => void;

  // Active call ended
  "call:ended": (data: {
    callId: string;
    endedBy: string;
    duration: number;
  }) => void;

  // Call error
  "call:error": (data: {
    message: string;
    callId?: string;
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
``