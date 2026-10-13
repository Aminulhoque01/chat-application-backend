
import { Types } from "mongoose";

import { Call } from "./call.model";
import type {
  CallStatus,
  CallType,
} from "./call.interface";

interface CreateCallPayload {
  caller: string;
  receiver: string;
  type: CallType;
}

const ACTIVE_STATUSES: CallStatus[] = [
  "ringing",
  "accepted",
];

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

const createCall = async (
  payload: CreateCallPayload,
) => {
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

  // Do not allow another active call involving either user.
  const activeCall = await Call.findOne({
    status: { $in: ACTIVE_STATUSES },
    $or: [
      { caller: { $in: [caller, receiver] } },
      { receiver: { $in: [caller, receiver] } },
    ],
  });

  if (activeCall) {
    throw new Error("One of the users is already in a call");
  }

  return Call.create({
    caller: new Types.ObjectId(caller),
    receiver: new Types.ObjectId(receiver),
    type,
    status: "ringing",
  });
};

const acceptCall = async (
  callId: string,
  userId: string,
) => {
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
      receiver: userId,
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

const rejectCall = async (
  callId: string,
  userId: string,
) => {
  if (!isValidObjectId(userId)) {
    throw new Error("Invalid user ID");
  }

  const call = await getCallById(callId);

  if (call.receiver.toString() !== userId) {
    throw new Error("Only the receiver can reject this call");
  }

  if (call.status !== "ringing") {
    throw new Error("This call is no longer ringing");
  }

  const updatedCall = await Call.findOneAndUpdate(
    {
      _id: callId,
      receiver: userId,
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
    throw new Error("Call could not be rejected");
  }

  return updatedCall;
};

const cancelCall = async (
  callId: string,
  userId: string,
) => {
  if (!isValidObjectId(userId)) {
    throw new Error("Invalid user ID");
  }

  const call = await getCallById(callId);

  if (call.caller.toString() !== userId) {
    throw new Error("Only the caller can cancel this call");
  }

  if (call.status !== "ringing") {
    throw new Error("Only ringing calls can be cancelled");
  }

  const updatedCall = await Call.findOneAndUpdate(
    {
      _id: callId,
      caller: userId,
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
    throw new Error("Call could not be cancelled");
  }

  return updatedCall;
};

const completeCall = async (
  callId: string,
  userId: string,
) => {
  if (!isValidObjectId(userId)) {
    throw new Error("Invalid user ID");
  }

  const call = await getCallById(callId);

  if (!isParticipant(call, userId)) {
    throw new Error("You are not a participant in this call");
  }

  if (!ACTIVE_STATUSES.includes(call.status)) {
    throw new Error("This call has already ended");
  }

  const endedAt = new Date();

  const duration = call.answeredAt
    ? Math.max(
        0,
        Math.floor(
          (endedAt.getTime() -
            call.answeredAt.getTime()) /
            1000,
        ),
      )
    : 0;

  const updatedCall = await Call.findOneAndUpdate(
    {
      _id: callId,
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

  if (!updatedCall) {
    throw new Error("Call has already ended");
  }

  return updatedCall;
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
      { caller: userId },
      { receiver: userId },
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
  status: "accepted" | "rejected" | "cancelled" |"missed",
) => {
  const updateData: Record<string, unknown> = { status };

  if (status === "accepted") {
    updateData.answeredAt = new Date();
  } else {
    updateData.endedAt = new Date();
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
  getUserCalls,
  updateCallStatus
};
