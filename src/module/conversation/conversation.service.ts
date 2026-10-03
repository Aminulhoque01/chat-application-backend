import mongoose from "mongoose";

import { ConversationModel } from "./conversation.model";
import { UserModel } from "../user/user.model";

import {
  getCache,
  invalidateUserConversationsCache,
  setCache,
} from "../../cache/cache.service";

import { cacheKeys } from "../../cache/cache.keys";

import { MessageModel } from "../message/message.model";

import { uploadToCloudinary } from "../../utils/cloudinary";

import { getSocketIO } from "../../socket/socket.instance";

// ==========================================
// SYSTEM MESSAGE REALTIME HELPER
// ==========================================

const createAndEmitSystemMessage = async ({
  conversationId,
  senderId,
  text,
  recipientUserIds,
}: {
  conversationId: string;
  senderId: string;
  text: string;
  recipientUserIds: string[];
}) => {
  // ==========================================
  // CREATE SYSTEM MESSAGE
  // ==========================================

  const systemMessage = await MessageModel.create({
    conversationId: new mongoose.Types.ObjectId(conversationId),

    senderId: new mongoose.Types.ObjectId(senderId),

    type: "system",

    text,

    attachments: [],

    isEdited: false,

    isDeleted: false,

    deletedAt: null,

    deliveredTo: [],

    readBy: [],

    reactions: [],

    replyTo: null,

    isForwarded: false,

    forwardedFrom: null,
  });

  // ==========================================
  // POPULATE SENDER
  // ==========================================

  await systemMessage.populate(
    "senderId",
    "phone name avatar bio isOnline lastSeen",
  );

  // ==========================================
  // GET SOCKET.IO
  // ==========================================

  const io = getSocketIO();

  // ==========================================
  // UNIQUE USER ROOMS
  // ==========================================

  const uniqueUserIds = [
    ...new Set(recipientUserIds.map((id) => id.toString())),
  ];

  // ==========================================
  // BUILD SOCKET ROOMS
  // ==========================================

  const rooms = uniqueUserIds.map((userId) => `user:${userId}`);

  // ==========================================
  // REALTIME MESSAGE
  // ==========================================

  if (rooms.length > 0) {
    io.to(rooms).emit("message:new", systemMessage);
  }

  return systemMessage;
};

// ==========================================
// CREATE DIRECT CONVERSATION
// ==========================================

export const createDirectConversation = async (
  currentUserId: string,
  participantId: string,
) => {
  if (!mongoose.Types.ObjectId.isValid(currentUserId)) {
    throw new Error("Invalid current user ID");
  }

  if (!mongoose.Types.ObjectId.isValid(participantId)) {
    throw new Error("Invalid participant ID");
  }

  if (currentUserId === participantId) {
    throw new Error("You cannot create a conversation with yourself");
  }

  const participant = await UserModel.findById(participantId);

  if (!participant) {
    throw new Error("Participant user not found");
  }

  const currentUserObjectId = new mongoose.Types.ObjectId(currentUserId);

  const participantObjectId = new mongoose.Types.ObjectId(participantId);

  const existingConversation = await ConversationModel.findOne({
    type: "direct",

    participants: {
      $all: [currentUserObjectId, participantObjectId],

      $size: 2,
    },
  })
    .populate("participants", "phone name avatar bio isOnline lastSeen")
    .populate("lastMessage");

  if (existingConversation) {
    return existingConversation;
  }

  const conversation = await ConversationModel.create({
    type: "direct",

    participants: [currentUserObjectId, participantObjectId],

    admins: [],

    createdBy: currentUserObjectId,

    lastMessage: null,
  });

  await conversation.populate(
    "participants",
    "phone name avatar bio isOnline lastSeen",
  );

  return conversation;
};

// ==========================================
// GET MY CONVERSATIONS
// ==========================================

export const getMyConversations = async (currentUserId: string) => {
  if (!mongoose.Types.ObjectId.isValid(currentUserId)) {
    throw new Error("Invalid user ID");
  }

  const cacheKey = cacheKeys.userConversations(currentUserId);

  // ==========================================
  // REDIS HIT
  // ==========================================

  const cachedConversations = await getCache(cacheKey);

  if (cachedConversations) {
    console.log("Conversations: Redis HIT");

    return cachedConversations;
  }

  console.log("Conversations: Redis MISS");

  const currentUserObjectId = new mongoose.Types.ObjectId(currentUserId);

  // ==========================================
  // GET CONVERSATIONS
  // ==========================================

  const conversations = await ConversationModel.find({
    participants: currentUserObjectId,
  })
    .populate("participants", "phone name avatar bio isOnline lastSeen")
    .populate("createdBy", "phone name avatar")
    .populate({
      path: "lastMessage",

      populate: {
        path: "senderId",

        select: "phone name avatar",
      },
    })
    .sort({
      updatedAt: -1,
    })
    .lean();

  // ==========================================
  // UNREAD COUNT
  // ==========================================

  const conversationsWithUnreadCount = await Promise.all(
    conversations.map(async (conversation) => {
      const unreadCount = await MessageModel.countDocuments({
        conversationId: conversation._id,

        // Own messages are not unread
        senderId: {
          $ne: currentUserObjectId,
        },

        // System messages are not unread
        type: {
          $ne: "system",
        },

        // Deleted messages are not unread
        isDeleted: false,

        // Current user has not read
        readBy: {
          $nin: [currentUserObjectId],
        },
      });

      return {
        ...conversation,

        unreadCount,
      };
    }),
  );

  // ==========================================
  // REDIS
  // ==========================================

  await setCache(cacheKey, conversationsWithUnreadCount, 300);

  return conversationsWithUnreadCount;
};

// ==========================================
// CREATE GROUP
// ==========================================

export const createGroupConversation = async (
  currentUserId: string,
  name: string,
  participantIds: string[],
) => {
  // ==========================================
  // VALIDATE CURRENT USER
  // ==========================================

  if (!mongoose.Types.ObjectId.isValid(currentUserId)) {
    throw new Error("Invalid current user ID");
  }

  // ==========================================
  // MINIMUM MEMBERS
  // ==========================================

  if (participantIds.length < 2) {
    throw new Error("A group must have at least 3 members");
  }

  // ==========================================
  // REMOVE DUPLICATES
  // ==========================================

  const uniqueParticipantIds = [...new Set(participantIds)];

  if (uniqueParticipantIds.length !== participantIds.length) {
    throw new Error("Duplicate participants are not allowed");
  }

  // ==========================================
  // VALIDATE PARTICIPANT IDS
  // ==========================================

  const invalidParticipantId = uniqueParticipantIds.find(
    (id) => !mongoose.Types.ObjectId.isValid(id),
  );

  if (invalidParticipantId) {
    throw new Error(`Invalid participant ID: ${invalidParticipantId}`);
  }

  // ==========================================
  // CURRENT USER CANNOT BE PASSED
  // ==========================================

  if (uniqueParticipantIds.includes(currentUserId)) {
    throw new Error("You are already included automatically");
  }

  // ==========================================
  // CHECK USERS
  // ==========================================

  const users = await UserModel.find({
    _id: {
      $in: uniqueParticipantIds,
    },
  }).select("_id");

  if (users.length !== uniqueParticipantIds.length) {
    throw new Error("One or more participants do not exist");
  }

  // ==========================================
  // OBJECT IDS
  // ==========================================

  const currentUserObjectId = new mongoose.Types.ObjectId(currentUserId);

  const participantObjectIds = uniqueParticipantIds.map(
    (id) => new mongoose.Types.ObjectId(id),
  );

  // ==========================================
  // CREATE GROUP
  // ==========================================

  const conversation = await ConversationModel.create({
    type: "group",

    name: name.trim(),

    participants: [currentUserObjectId, ...participantObjectIds],

    admins: [currentUserObjectId],

    createdBy: currentUserObjectId,

    lastMessage: null,
  });

  // ==========================================
  // POPULATE
  // ==========================================

  await conversation.populate(
    "participants",
    "phone name avatar bio isOnline lastSeen",
  );

  await conversation.populate("createdBy", "phone name avatar");

  return conversation;
};

// ==========================================
// ADD PARTICIPANTS
// ==========================================

export const addParticipantsToGroup = async (
  currentUserId: string,
  conversationId: string,
  participantIds: string[],
) => {
  // ==========================================
  // VALIDATION
  // ==========================================

  if (!mongoose.Types.ObjectId.isValid(conversationId)) {
    throw new Error("Invalid conversation ID");
  }

  if (!mongoose.Types.ObjectId.isValid(currentUserId)) {
    throw new Error("Invalid current user ID");
  }

  const invalidParticipantId = participantIds.find(
    (id) => !mongoose.Types.ObjectId.isValid(id),
  );

  if (invalidParticipantId) {
    throw new Error(`Invalid participant ID: ${invalidParticipantId}`);
  }

  // ==========================================
  // UNIQUE IDS
  // ==========================================

  const uniqueParticipantIds = [...new Set(participantIds)];

  // ==========================================
  // FIND CONVERSATION
  // ==========================================

  const conversation = await ConversationModel.findById(conversationId);

  if (!conversation) {
    throw new Error("Conversation not found");
  }

  // ==========================================
  // MUST BE GROUP
  // ==========================================

  if (conversation.type !== "group") {
    throw new Error("Participants can only be added to groups");
  }

  // ==========================================
  // CHECK ADMIN
  // ==========================================

  const isAdmin = conversation.admins.some(
    (adminId) => adminId.toString() === currentUserId,
  );

  if (!isAdmin) {
    throw new Error("Only group admins can add participants");
  }

  // ==========================================
  // OBJECT IDS
  // ==========================================

  const newParticipantObjectIds = uniqueParticipantIds.map(
    (id) => new mongoose.Types.ObjectId(id),
  );

  // ==========================================
  // CHECK USERS
  // ==========================================

  const users = await UserModel.find({
    _id: {
      $in: newParticipantObjectIds,
    },
  }).select("_id name phone");

  if (users.length !== newParticipantObjectIds.length) {
    throw new Error("One or more users do not exist");
  }

  // ==========================================
  // CHECK EXISTING MEMBERS
  // ==========================================

  const existingParticipantIds = new Set(
    conversation.participants.map((id) => id.toString()),
  );

  const alreadyMembers = uniqueParticipantIds.filter((id) =>
    existingParticipantIds.has(id),
  );

  if (alreadyMembers.length > 0) {
    throw new Error("One or more users are already group members");
  }

  // ==========================================
  // ADD PARTICIPANTS
  // ==========================================

  conversation.participants.push(...newParticipantObjectIds);

  await conversation.save();

  // ==========================================
  // USER NAMES
  // ==========================================

  const addedUserNames = users.map(
    (user) => user.name?.trim() || user.phone || "User",
  );

  // ==========================================
  // SYSTEM MESSAGE TEXT
  // ==========================================

  let systemMessageText: string;

  if (addedUserNames.length === 1) {
    systemMessageText = `${addedUserNames[0]} was added to this group`;
  } else if (addedUserNames.length === 2) {
    systemMessageText = `${addedUserNames[0]} and ${addedUserNames[1]} were added to this group`;
  } else {
    const lastUser = addedUserNames[addedUserNames.length - 1];

    const firstUsers = addedUserNames.slice(0, -1).join(", ");

    systemMessageText = `${firstUsers} and ${lastUser} were added to this group`;
  }

  // ==========================================
  // ALL MEMBERS
  // ==========================================

  const allMemberIds = conversation.participants.map((participantId) =>
    participantId.toString(),
  );

  // ==========================================
  // CREATE + REALTIME SYSTEM MESSAGE
  // ==========================================

  const systemMessage = await createAndEmitSystemMessage({
    conversationId: conversation._id.toString(),

    senderId: currentUserId,

    text: systemMessageText,

    recipientUserIds: allMemberIds,
  });

  // ==========================================
  // LAST MESSAGE
  // ==========================================

  conversation.lastMessage = systemMessage._id;

  await conversation.save();

  // ==========================================
  // CACHE INVALIDATION
  // ==========================================

  await invalidateUserConversationsCache(allMemberIds);

  // ==========================================
  // POPULATE
  // ==========================================

  await conversation.populate(
    "participants",
    "phone name avatar bio isOnline lastSeen",
  );

  await conversation.populate("createdBy", "phone name avatar");

  await conversation.populate({
    path: "lastMessage",

    populate: {
      path: "senderId",

      select: "phone name avatar",
    },
  });

  return conversation;
};

// ==========================================
// REMOVE / LEAVE GROUP
// ==========================================

export const removeParticipantFromGroup = async (
  currentUserId: string,
  conversationId: string,
  targetUserId: string,
) => {
  // ==========================================
  // VALIDATE CONVERSATION
  // ==========================================

  if (!mongoose.Types.ObjectId.isValid(conversationId)) {
    throw new Error("Invalid conversation ID");
  }

  // ==========================================
  // VALIDATE CURRENT USER
  // ==========================================

  if (!mongoose.Types.ObjectId.isValid(currentUserId)) {
    throw new Error("Invalid current user ID");
  }

  // ==========================================
  // VALIDATE TARGET USER
  // ==========================================

  if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
    throw new Error("Invalid target user ID");
  }

  // ==========================================
  // FIND CONVERSATION
  // ==========================================

  const conversation = await ConversationModel.findById(conversationId);

  if (!conversation) {
    throw new Error("Conversation not found");
  }

  // ==========================================
  // MUST BE GROUP
  // ==========================================

  if (conversation.type !== "group") {
    throw new Error("Participants can only be removed from groups");
  }

  // ==========================================
  // CHECK CURRENT USER MEMBER
  // ==========================================

  const isMember = conversation.participants.some(
    (participantId) => participantId.toString() === currentUserId,
  );

  if (!isMember) {
    throw new Error("You are not a member of this group");
  }

  // ==========================================
  // CHECK TARGET MEMBER
  // ==========================================

  const isTargetMember = conversation.participants.some(
    (participantId) => participantId.toString() === targetUserId,
  );

  if (!isTargetMember) {
    throw new Error("Target user is not a member of this group");
  }

  // ==========================================
  // CHECK ADMIN
  // ==========================================

  const isAdmin = conversation.admins.some(
    (adminId) => adminId.toString() === currentUserId,
  );

  // ==========================================
  // LEAVE OR ADMIN REMOVE
  // ==========================================

  const isLeaving = currentUserId === targetUserId;

  if (!isLeaving && !isAdmin) {
    throw new Error("Only group admins can remove other members");
  }

  // ==========================================
  // PREVENT LAST MEMBER
  // ==========================================

  if (conversation.participants.length <= 1) {
    throw new Error("Group must have at least one member");
  }

  // ==========================================
  // GET USERS
  // ==========================================

  const targetUser =
    await UserModel.findById(targetUserId).select("name phone");

  if (!targetUser) {
    throw new Error("Target user not found");
  }

  const currentUser =
    await UserModel.findById(currentUserId).select("name phone");

  if (!currentUser) {
    throw new Error("Current user not found");
  }

  const targetUserName = targetUser.name?.trim() || targetUser.phone || "User";

  const currentUserName =
    currentUser.name?.trim() || currentUser.phone || "User";

  // ==========================================
  // SYSTEM MESSAGE TEXT
  // ==========================================

  let systemMessageText: string;

  if (isLeaving) {
    systemMessageText = `${targetUserName} left this group`;
  } else {
    systemMessageText = `${currentUserName} removed ${targetUserName} from this group`;
  }

  // ==========================================
  // REMOVE PARTICIPANT
  // ==========================================

  conversation.participants = conversation.participants.filter(
    (participantId) => participantId.toString() !== targetUserId,
  );

  // ==========================================
  // REMOVE ADMIN
  // ==========================================

  conversation.admins = conversation.admins.filter(
    (adminId) => adminId.toString() !== targetUserId,
  );

  // ==========================================
  // SAVE PARTICIPANT CHANGE
  // ==========================================

  await conversation.save();

  // ==========================================
  // REMAINING MEMBERS
  // ==========================================

  const remainingMemberIds = conversation.participants.map((participantId) =>
    participantId.toString(),
  );

  // ==========================================
  // RECIPIENTS
  //
  // Remaining members always receive it.
  //
  // If admin removes someone, target also
  // receives the final system event so their
  // currently-open UI can update immediately.
  //
  // If user leaves themselves, target ===
  // current user, so we also send it to them.
  // ==========================================

  const recipientUserIds = [...remainingMemberIds, targetUserId];

  // ==========================================
  // CREATE + REALTIME SYSTEM MESSAGE
  // ==========================================

  const systemMessage = await createAndEmitSystemMessage({
    conversationId: conversation._id.toString(),

    // System event is performed by current user
    senderId: currentUserId,

    text: systemMessageText,

    recipientUserIds,
  });

  // ==========================================
  // LAST MESSAGE
  // ==========================================

  conversation.lastMessage = systemMessage._id;

  await conversation.save();

  // ==========================================
  // CACHE INVALIDATION
  // ==========================================

  await invalidateUserConversationsCache([
    ...remainingMemberIds,
    targetUserId,
    currentUserId,
  ]);

  // ==========================================
  // POPULATE PARTICIPANTS
  // ==========================================

  await conversation.populate(
    "participants",
    "phone name avatar bio isOnline lastSeen",
  );

  // ==========================================
  // POPULATE CREATOR
  // ==========================================

  await conversation.populate("createdBy", "phone name avatar");

  // ==========================================
  // POPULATE LAST MESSAGE
  // ==========================================

  await conversation.populate({
    path: "lastMessage",

    populate: {
      path: "senderId",

      select: "phone name avatar",
    },
  });

  return conversation;
};

// ==========================================
// PROMOTE MEMBER TO ADMIN
// ==========================================

export const promoteMemberToAdmin = async (
  currentUserId: string,
  conversationId: string,
  targetUserId: string,
) => {
  if (!mongoose.Types.ObjectId.isValid(conversationId)) {
    throw new Error("Invalid conversation ID");
  }

  if (!mongoose.Types.ObjectId.isValid(currentUserId)) {
    throw new Error("Invalid current user ID");
  }

  if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
    throw new Error("Invalid target user ID");
  }

  const conversation = await ConversationModel.findById(conversationId);

  if (!conversation) {
    throw new Error("Conversation not found");
  }

  if (conversation.type !== "group") {
    throw new Error("Only groups can have admins");
  }

  const isCurrentUserMember = conversation.participants.some(
    (participantId) => participantId.toString() === currentUserId,
  );

  if (!isCurrentUserMember) {
    throw new Error("You are not a member of this group");
  }

  const isCurrentUserAdmin = conversation.admins.some(
    (adminId) => adminId.toString() === currentUserId,
  );

  if (!isCurrentUserAdmin) {
    throw new Error("Only group admins can promote members");
  }

  const isTargetMember = conversation.participants.some(
    (participantId) => participantId.toString() === targetUserId,
  );

  if (!isTargetMember) {
    throw new Error("Target user is not a group member");
  }

  const isAlreadyAdmin = conversation.admins.some(
    (adminId) => adminId.toString() === targetUserId,
  );

  if (isAlreadyAdmin) {
    throw new Error("User is already an admin");
  }

  // ==========================================
  // TARGET USER
  // ==========================================

  const targetUser =
    await UserModel.findById(targetUserId).select("name phone");

  if (!targetUser) {
    throw new Error("Target user not found");
  }

  // ==========================================
  // CURRENT USER
  // ==========================================

  const currentUser =
    await UserModel.findById(currentUserId).select("name phone");

  if (!currentUser) {
    throw new Error("Current user not found");
  }

  const targetUserName = targetUser.name?.trim() || targetUser.phone || "User";

  const currentUserName =
    currentUser.name?.trim() || currentUser.phone || "User";

  // ==========================================
  // PROMOTE
  // ==========================================

  conversation.admins.push(new mongoose.Types.ObjectId(targetUserId));

  await conversation.save();

  // ==========================================
  // SYSTEM MESSAGE
  // ==========================================

  const systemMessageText = `${targetUserName} is now an admin`;

  const memberIds = conversation.participants.map((participantId) =>
    participantId.toString(),
  );

  const systemMessage = await createAndEmitSystemMessage({
    conversationId: conversation._id.toString(),

    senderId: currentUserId,

    text: systemMessageText,

    recipientUserIds: memberIds,
  });

  // ==========================================
  // LAST MESSAGE
  // ==========================================

  conversation.lastMessage = systemMessage._id;

  await conversation.save();

  // ==========================================
  // CACHE
  // ==========================================

  await invalidateUserConversationsCache(memberIds);

  // ==========================================
  // POPULATE
  // ==========================================

  await conversation.populate(
    "participants",
    "phone name avatar bio isOnline lastSeen",
  );

  await conversation.populate("createdBy", "phone name avatar");

  await conversation.populate({
    path: "lastMessage",

    populate: {
      path: "senderId",

      select: "phone name avatar",
    },
  });

  return conversation;
};

// ==========================================
// RENAME GROUP
// ==========================================

export const renameGroupConversation = async (
  currentUserId: string,
  conversationId: string,
  name: string,
) => {
  if (!mongoose.Types.ObjectId.isValid(conversationId)) {
    throw new Error("Invalid conversation ID");
  }

  if (!mongoose.Types.ObjectId.isValid(currentUserId)) {
    throw new Error("Invalid current user ID");
  }

  const conversation = await ConversationModel.findById(conversationId);

  if (!conversation) {
    throw new Error("Conversation not found");
  }

  if (conversation.type !== "group") {
    throw new Error("Only groups can be renamed");
  }

  const isMember = conversation.participants.some(
    (participantId) => participantId.toString() === currentUserId,
  );

  if (!isMember) {
    throw new Error("You are not a member of this group");
  }

  const isAdmin = conversation.admins.some(
    (adminId) => adminId.toString() === currentUserId,
  );

  if (!isAdmin) {
    throw new Error("Only group admins can rename the group");
  }

  conversation.name = name.trim();

  await conversation.save();

  const memberIds = conversation.participants.map((participantId) =>
    participantId.toString(),
  );

  await invalidateUserConversationsCache(memberIds);

  await conversation.populate(
    "participants",
    "phone name avatar bio isOnline lastSeen",
  );

  await conversation.populate("createdBy", "phone name avatar");

  return conversation;
};

// ==========================================
// CHECK CONVERSATION MEMBER
// ==========================================

export const isConversationMember = async (
  conversationId: string,
  userId: string,
): Promise<boolean> => {
  if (
    !mongoose.Types.ObjectId.isValid(conversationId) ||
    !mongoose.Types.ObjectId.isValid(userId)
  ) {
    return false;
  }

  const conversation = await ConversationModel.findOne({
    _id: conversationId,

    participants: userId,
  }).select("_id");

  return !!conversation;
};

// ==========================================
// UPDATE GROUP PHOTO
// ==========================================

export const updateGroupPhoto = async (
  currentUserId: string,
  conversationId: string,
  file: Express.Multer.File,
) => {
  if (!mongoose.Types.ObjectId.isValid(currentUserId)) {
    throw new Error("Invalid current user ID");
  }

  if (!mongoose.Types.ObjectId.isValid(conversationId)) {
    throw new Error("Invalid conversation ID");
  }

  if (!file) {
    throw new Error("Group photo is required");
  }

  const conversation = await ConversationModel.findById(conversationId);

  if (!conversation) {
    throw new Error("Conversation not found");
  }

  if (conversation.type !== "group") {
    throw new Error("Only groups can have a group photo");
  }

  const isMember = conversation.participants.some(
    (participantId) => participantId.toString() === currentUserId,
  );

  if (!isMember) {
    throw new Error("You are not a member of this group");
  }

  const isAdmin = conversation.admins.some(
    (adminId) => adminId.toString() === currentUserId,
  );

  if (!isAdmin) {
    throw new Error("Only group admins can change the group photo");
  }

  const uploadResult = await uploadToCloudinary(file.buffer, "chat-app/groups");

  conversation.groupPhoto = uploadResult.secure_url;

  await conversation.save();

  const memberIds = conversation.participants.map((participantId) =>
    participantId.toString(),
  );

  await invalidateUserConversationsCache(memberIds);

  await conversation.populate(
    "participants",
    "phone name avatar bio isOnline lastSeen",
  );

  await conversation.populate("createdBy", "phone name avatar");

  return conversation;
};

// ==========================================
// DELETE GROUP
// ==========================================

export const deleteGroupConversation = async (
  currentUserId: string,
  conversationId: string,
) => {
  if (!mongoose.Types.ObjectId.isValid(currentUserId)) {
    throw new Error("Invalid current user ID");
  }

  if (!mongoose.Types.ObjectId.isValid(conversationId)) {
    throw new Error("Invalid conversation ID");
  }

  const conversation = await ConversationModel.findById(conversationId);

  if (!conversation) {
    throw new Error("Conversation not found");
  }

  if (conversation.type !== "group") {
    throw new Error("Only groups can be deleted");
  }

  const isAdmin = conversation.admins.some(
    (adminId) => adminId.toString() === currentUserId,
  );

  if (!isAdmin) {
    throw new Error("Only group admins can delete the group");
  }

  const memberIds = conversation.participants.map((participantId) =>
    participantId.toString(),
  );

  // ==========================================
  // DELETE MESSAGES
  // ==========================================

  await MessageModel.deleteMany({
    conversationId: conversation._id,
  });

  // ==========================================
  // DELETE CONVERSATION
  // ==========================================

  await ConversationModel.deleteOne({
    _id: conversation._id,
  });

  // ==========================================
  // INVALIDATE CACHE
  // ==========================================

  await invalidateUserConversationsCache(memberIds);

  // ==========================================
  // RETURN
  // ==========================================

  return {
    conversationId,
    deleted: true,
  };
};
