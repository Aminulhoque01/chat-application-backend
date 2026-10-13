
import { Types } from "mongoose";

import { Call } from "./call.model";
import type { CallStatus, CallType } from "./call.interface";

interface CreateCallPayload {
  caller: string;
  receiver: string;
  type: CallType;
}

const ACTIVE_STATUSES: CallStatus[] = ["ringing", "accepted"];
const RING_TIMEOUT_MS = 30_000;

const isValidObjectId = (id: string) =>
  Types.ObjectId.isValid(id);

const getCallById = async (callId: string) => {
  if (!isValidObjectId(callId)) {
    throw new Error("Invalid call ID");
  }

  const call = await Call.findById(callId);

  if (!call) {
    throw new Error("Call not found");
  }

  return call;
};

const isParticipant = (
  call: {
    caller: Types.ObjectId;
    receiver: Types.ObjectId;
  },
  userId: string,
) =>
  call.caller.toString() === userId ||
  call.receiver.toString() === userId;

/**
 * A ringing call is considered missed after 30 seconds.
 * This is a fallback in case the in-memory timeout never runs,
 * for example when the server restarts.
 */
const expireStaleRingingCalls = async (
  userIds: string[],
) => {
  const cutoff = new Date(Date.now() - RING_TIMEOUT_MS);
  const objectIds = userIds.map((id) => new Types.ObjectId(id));

  await Call.updateMany(
    {
      status: "ringing",
      createdAt: { $lte: cutoff },
      $or: [
        { caller: { $in: objectIds } },
        { receiver: { $in: objectIds } },
      ],
    },
    {
      $set: {
        status: "missed",
        endedAt: new Date(),
        duration: 0,
      },
    },
  );
};

const createCall = async (payload: CreateCallPayload) => {
  const { caller, receiver, type } = payload;

  if (
    !isValidObjectId(caller) ||
    !isValidObjectId(receiver)
  ) {
    throw new Error("Invalid caller or receiver ID");
  }

  if (caller === receiver) {
    throw new Error("You cannot call yourself");
  }

  if (type !== "audio" && type !== "video") {
    throw new Error("Invalid call type");
  }

  // Clean up expired ringing calls before checking for active calls.
  await expireStaleRingingCalls([caller, receiver]);

  const userIds = [
    new Types.ObjectId(caller),
    new Types.ObjectId(receiver),
  ];

  const activeCall = await Call.findOne({
    status: { $in: ACTIVE_STATUSES },
    $or: [
      { caller: { $in: userIds } },
      { receiver: { $in: userIds } },
    ],
  });

  if (activeCall) {
    throw new Error(
      "One of the users is already in a call. Please end the existing call first.",
    );
  }

  return Call.create({
    caller: new Types.ObjectId(caller),
    receiver: new Types.ObjectId(receiver),
    type,
    status: "ringing",
  });
};

const acceptCall = async (callId: string, userId: string) => {
  if (!isValidObjectId(userId)) {
    throw new Error("Invalid user ID");
  }

  const call = await getCallById(callId);

  if (call.receiver.toString() !== userId) {
    throw new Error("Only the receiver can accept this call");
  }

  if (call.status !== "ringing") {
    throw new Error("This call is no longer ringing");
  }

  const updatedCall = await Call.findOneAndUpdate(
    {
      _id: callId,
      receiver: new Types.ObjectId(userId),
      status: "ringing",
    },
    {
      $set: {
        status: "accepted",
        answeredAt: new Date(),
      },
    },
    { new: true },
  );

  if (!updatedCall) {
    throw new Error("Call could not be accepted");
  }

  return updatedCall;
};

const rejectCall = async (callId: string, userId: string) => {
  if (!isValidObjectId(userId)) {
    throw new Error("Invalid user ID");
  }

  const updatedCall = await Call.findOneAndUpdate(
    {
      _id: callId,
      receiver: new Types.ObjectId(userId),
      status: "ringing",
    },
    {
      $set: {
        status: "rejected",
        endedAt: new Date(),
        duration: 0,
      },
    },
    { new: true },
  );

  if (!updatedCall) {
    const call = await getCallById(callId);

    if (call.receiver.toString() !== userId) {
      throw new Error("Only the receiver can reject this call");
    }

    throw new Error("This call is no longer ringing");
  }

  return updatedCall;
};

const cancelCall = async (callId: string, userId: string) => {
  if (!isValidObjectId(userId)) {
    throw new Error("Invalid user ID");
  }

  const updatedCall = await Call.findOneAndUpdate(
    {
      _id: callId,
      caller: new Types.ObjectId(userId),
      status: "ringing",
    },
    {
      $set: {
        status: "cancelled",
        endedAt: new Date(),
        duration: 0,
      },
    },
    { new: true },
  );

  if (!updatedCall) {
    const call = await getCallById(callId);

    if (call.caller.toString() !== userId) {
      throw new Error("Only the caller can cancel this call");
    }

    throw new Error("Only ringing calls can be cancelled");
  }

  return updatedCall;
};

const completeCall = async (callId: string, userId: string) => {
  if (!isValidObjectId(userId)) {
    throw new Error("Invalid user ID");
  }

  if (!isValidObjectId(callId)) {
    throw new Error("Invalid call ID");
  }

  // Atomic update prevents two participants ending the same call
  // at the same time and overwriting each other's result.
  const existingCall = await Call.findOne({
    _id: new Types.ObjectId(callId),
    $or: [
      { caller: new Types.ObjectId(userId) },
      { receiver: new Types.ObjectId(userId) },
    ],
    status: { $in: ACTIVE_STATUSES },
  });

  if (!existingCall) {
    const call = await getCallById(callId);

    if (!isParticipant(call, userId)) {
      throw new Error("You are not a participant in this call");
    }

    // Idempotent end: if it is already closed, return its final record.
    // The socket handler should avoid creating duplicate history.
    if (!ACTIVE_STATUSES.includes(call.status)) {
      return call;
    }

    throw new Error("Call could not be ended");
  }

  const endedAt = new Date();

  const duration = existingCall.answeredAt
    ? Math.max(
        0,
        Math.floor(
          (endedAt.getTime() -
            existingCall.answeredAt.getTime()) /
            1000,
        ),
      )
    : 0;

  const updatedCall = await Call.findOneAndUpdate(
    {
      _id: new Types.ObjectId(callId),
      status: { $in: ACTIVE_STATUSES },
    },
    {
      $set: {
        status: "completed",
        endedAt,
        duration,
      },
    },
    { new: true },
  );

  if (updatedCall) return updatedCall;

  // Another participant may have ended the call concurrently.
  const finalCall = await getCallById(callId);

  if (!isParticipant(finalCall, userId)) {
    throw new Error("You are not a participant in this call");
  }

  return finalCall;
};

/**
 * End active calls for a user whose last socket has disconnected.
 * Ringing calls become missed; accepted calls become completed.
 */
const endActiveCallsForUser = async (userId: string) => {
  if (!isValidObjectId(userId)) {
    throw new Error("Invalid user ID");
  }

  const userObjectId = new Types.ObjectId(userId);

  const activeCalls = await Call.find({
    status: { $in: ACTIVE_STATUSES },
    $or: [
      { caller: userObjectId },
      { receiver: userObjectId },
    ],
  });

  const results = [];

  for (const activeCall of activeCalls) {
    const endedAt = new Date();
    const wasAccepted = activeCall.status === "accepted";

    const duration =
      wasAccepted && activeCall.answeredAt
        ? Math.max(
            0,
            Math.floor(
              (endedAt.getTime() -
                activeCall.answeredAt.getTime()) /
                1000,
            ),
          )
        : 0;

    const updatedCall = await Call.findOneAndUpdate(
      {
        _id: activeCall._id,
        status: { $in: ACTIVE_STATUSES },
      },
      {
        $set: {
          status: wasAccepted ? "completed" : "missed",
          endedAt,
          duration,
        },
      },
      { new: true },
    );

    if (updatedCall) results.push(updatedCall);
  }

  return results;
};

const getUserCalls = async (
  userId: string,
  page = 1,
  limit = 20,
) => {
  if (!isValidObjectId(userId)) {
    throw new Error("Invalid user ID");
  }

  const safePage = Number.isFinite(page)
    ? Math.max(1, Math.floor(page))
    : 1;

  const safeLimit = Number.isFinite(limit)
    ? Math.min(100, Math.max(1, Math.floor(limit)))
    : 20;

  const filter = {
    $or: [
      { caller: new Types.ObjectId(userId) },
      { receiver: new Types.ObjectId(userId) },
    ],
  };

  const skip = (safePage - 1) * safeLimit;

  const [calls, total] = await Promise.all([
    Call.find(filter)
      .populate("caller", "name avatar email")
      .populate("receiver", "name avatar email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(safeLimit)
      .lean(),

    Call.countDocuments(filter),
  ]);

  return {
    calls,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.ceil(total / safeLimit),
    },
  };
};

const updateCallStatus = async (
  callId: string,
  status: "accepted" | "rejected" | "cancelled" | "missed",
) => {
  if (!isValidObjectId(callId)) {
    throw new Error("Invalid call ID");
  }

  const updateData: Record<string, unknown> = { status };

  if (status === "accepted") {
    updateData.answeredAt = new Date();
  } else {
    updateData.endedAt = new Date();
    updateData.duration = 0;
  }

  return Call.findOneAndUpdate(
    {
      _id: new Types.ObjectId(callId),
      status: "ringing",
    },
    { $set: updateData },
    { new: true },
  );
};

export const callService = {
  createCall,
  acceptCall,
  rejectCall,
  cancelCall,
  completeCall,
  endActiveCallsForUser,
  getUserCalls,
  updateCallStatus,
};
