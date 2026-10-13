// import { Server } from "socket.io";
// import { Types } from "mongoose";

// import { AuthenticatedSocket } from "./socket.types";

// import { setUserOffline, setUserOnline } from "../module/user/user.service";

// import {
//   addReaction,
//   createMessage,
//   deleteMessage,
//   editMessage,
//   markMessageAsDelivered,
//   markMessageAsRead,
// } from "../module/message/message.service";

// import { isConversationMember } from "../module/conversation/conversation.service";
// import { ConversationModel } from "../module/conversation/conversation.model";
// import { MessageModel } from "../module/message/message.model";
// import { BlockModel } from "../module/block/block.model";
// import { invalidateUserConversationsCache } from "../cache/cache.service";

// import { callService } from "../module/call/call.service";
// import { Call } from "../module/call/call.model";

 
// /**
//  * Populated sender type
//  */
// interface PopulatedSender {
//   _id: Types.ObjectId;
//   phone: string;
//   name: string;
//   avatar?: string | null;
//   bio?: string | null;
//   isOnline?: boolean;
//   lastSeen?: Date | null;
// }

// /**
//  * Check whether a direct conversation has a block
//  * in either direction. Group conversations are unaffected.
//  */
// const isDirectConversationBlocked = async (
//   conversationId: string,
//   currentUserId: string,
// ): Promise<boolean> => {
//   if (!Types.ObjectId.isValid(conversationId)) {
//     throw new Error("Invalid conversation ID");
//   }

//   if (!Types.ObjectId.isValid(currentUserId)) {
//     throw new Error("Invalid current user ID");
//   }

//   const conversation = await ConversationModel.findOne({
//     _id: new Types.ObjectId(conversationId),
//     participants: new Types.ObjectId(currentUserId),
//   }).select("type participants");

//   if (!conversation) {
//     throw new Error("Conversation not found or you are not a member");
//   }

//   if (conversation.type !== "direct") {
//     return false;
//   }

//   const otherParticipantId = conversation.participants.find(
//     (participantId) => participantId.toString() !== currentUserId,
//   );

//   if (!otherParticipantId) {
//     throw new Error("Direct conversation participant not found");
//   }

//   const blockExists = await BlockModel.exists({
//     $or: [
//       {
//         blockerId: new Types.ObjectId(currentUserId),
//         blockedId: otherParticipantId,
//       },
//       {
//         blockerId: otherParticipantId,
//         blockedId: new Types.ObjectId(currentUserId),
//       },
//     ],
//   });

//   return Boolean(blockExists);
// };

// /**
//  * Register Socket Handlers
//  */
// export const registerSocketHandlers = (
//   io: Server,
//   socket: AuthenticatedSocket,
// ) => {
//   const userId = socket.data.userId;

//   // ----------------------------------------------------------
//   // Personal user room
//   // ----------------------------------------------------------

//   socket.join(`user:${userId}`);

//   console.log(`User ${userId} joined personal socket room: user:${userId}`);

//   setUserOnline(userId)
//     .then(() => {
//       console.log(`User ${userId} is online`);
//     })
//     .catch((error) => {
//       console.error("Failed to set user online:", error);
//     });

//   // ----------------------------------------------------------
//   // Call helpers
//   // ----------------------------------------------------------

//   const getCallDetails = async (callId: string) => {
//     if (!Types.ObjectId.isValid(callId)) {
//       return null;
//     }

//     const call = await Call.findById(callId).select(
//       "caller receiver status type",
//     );

//     if (!call) {
//       return null;
//     }

//     return {
//       call,
//       callerId: call.caller.toString(),
//       receiverId: call.receiver.toString(),
//       status: call.status,
//     };
//   };

//   const emitCallError = (message: string) => {
//     socket.emit("call:error", { message });
//   };

//   const isActiveCallStatus = (status: string) =>
//     status === "ringing" || status === "accepted";

//   // ----------------------------------------------------------
//   // Send Message
//   // ----------------------------------------------------------

//   socket.on("message:send", async (payload) => {
//     try {
//       const { conversationId, text = "", replyTo } = payload;

//       if (!conversationId) {
//         socket.emit("message:error", {
//           message: "Conversation ID is required",
//         });
//         return;
//       }

//       if (!Types.ObjectId.isValid(conversationId)) {
//         socket.emit("message:error", {
//           message: "Invalid conversation ID",
//         });
//         return;
//       }

//       const isMember = await isConversationMember(conversationId, userId);

//       if (!isMember) {
//         socket.emit("message:error", {
//           message: "You are not a member of this conversation",
//         });
//         return;
//       }

//       const blocked = await isDirectConversationBlocked(conversationId, userId);

//       if (blocked) {
//         socket.emit("message:error", {
//           message: "You cannot send messages in this conversation",
//         });
//         return;
//       }

//       const message = await createMessage(
//         userId,
//         conversationId,
//         text,
//         replyTo,
//         [],
//       );

//       const conversation =
//         await ConversationModel.findById(conversationId).select("participants");

//       if (!conversation) {
//         throw new Error("Conversation not found");
//       }

//       const sender = message.senderId as unknown as PopulatedSender;

//       const socketMessage = message.toObject();

//       const populatedSender = {
//         _id: sender._id,
//         phone: sender.phone,
//         name: sender.name,
//         avatar: sender.avatar ?? null,
//         bio: sender.bio ?? null,
//         isOnline: sender.isOnline ?? false,
//         lastSeen: sender.lastSeen ?? null,
//       };

//       const participantIds = conversation.participants.map((participantId) =>
//         participantId.toString(),
//       );

//       await invalidateUserConversationsCache(participantIds);

//       for (const participantId of conversation.participants) {
//         io.to(`user:${participantId.toString()}`).emit("message:new", {
//           ...socketMessage,
//           senderId: populatedSender,
//         });
//       }

//       console.log(`Message ${message._id} delivered to participant rooms`);
//     } catch (error) {
//       console.error("message:send error:", error);

//       socket.emit("message:error", {
//         message:
//           error instanceof Error ? error.message : "Failed to send message",
//       });
//     }
//   });

//   // ----------------------------------------------------------
//   // Message Reaction
//   // ----------------------------------------------------------

//   socket.on("message:reaction", async (payload) => {
//     try {
//       const { messageId, emoji } = payload;

//       if (!messageId || !emoji) {
//         socket.emit("message:error", {
//           message: "Message ID and emoji are required",
//         });
//         return;
//       }

//       const result = await addReaction(userId, messageId, emoji);

//       const conversationId = result.message.conversationId.toString();

//       const targetUserId =
//         typeof result.message.senderId === "string"
//           ? result.message.senderId
//           : result.message.senderId.toString();

//       const eventId = `${result.message._id.toString()}:${userId}:${Date.now()}`;

//       const reactionPayload = {
//         eventId,
//         messageId: result.message._id.toString(),
//         conversationId,
//         action: result.action,
//         reactorId: userId,
//         targetUserId,
//         reactionSummary: result.reactionSummary,
//       };

//       // Notify users in the conversation.
//       io.to(conversationId).emit("message:reaction:update", reactionPayload);

//       // Also notify the original sender in their personal room.
//       if (targetUserId !== userId) {
//         io.to(`user:${targetUserId}`).emit(
//           "message:reaction:update",
//           reactionPayload,
//         );
//       }

//       console.log(
//         `Reaction ${result.action}: ${emoji} on message ${messageId}; target=${targetUserId}`,
//       );
//     } catch (error) {
//       console.error("message:reaction error:", error);

//       socket.emit("message:error", {
//         message:
//           error instanceof Error ? error.message : "Failed to update reaction",
//       });
//     }
//   });

//   // ----------------------------------------------------------
//   // Message Delete
//   // ----------------------------------------------------------

//   socket.on("message:delete", async (payload) => {
//     try {
//       const { messageId } = payload;

//       if (!messageId) {
//         socket.emit("message:error", {
//           message: "Message ID is required",
//         });
//         return;
//       }

//       const deletedMessage = await deleteMessage(userId, messageId);

//       const conversationId = deletedMessage.conversationId.toString();

//       const conversation =
//         await ConversationModel.findById(conversationId).select("participants");

//       if (conversation) {
//         await invalidateUserConversationsCache(
//           conversation.participants.map((participantId) =>
//             participantId.toString(),
//           ),
//         );
//       }

//       io.to(conversationId).emit("message:deleted", deletedMessage);

//       console.log(`Message ${messageId} deleted`);
//     } catch (error) {
//       console.error("message:delete error:", error);

//       socket.emit("message:error", {
//         message:
//           error instanceof Error ? error.message : "Failed to delete message",
//       });
//     }
//   });

//   // ----------------------------------------------------------
//   // Message Edit
//   // ----------------------------------------------------------

//   socket.on("message:edit", async (payload) => {
//     try {
//       const { messageId, text } = payload;

//       if (!messageId) {
//         socket.emit("message:error", {
//           message: "Message ID is required",
//         });
//         return;
//       }

//       if (!text || !text.trim()) {
//         socket.emit("message:error", {
//           message: "Message text is required",
//         });
//         return;
//       }

//       const message = await editMessage(userId, messageId, text);

//       const conversationId = message.conversationId.toString();

//       const conversation =
//         await ConversationModel.findById(conversationId).select("participants");

//       if (conversation) {
//         await invalidateUserConversationsCache(
//           conversation.participants.map((participantId) =>
//             participantId.toString(),
//           ),
//         );
//       }

//       io.to(conversationId).emit("message:edited", message);

//       console.log(`Message ${message._id} edited`);
//     } catch (error) {
//       console.error("message:edit error:", error);

//       socket.emit("message:error", {
//         message:
//           error instanceof Error ? error.message : "Failed to edit message",
//       });
//     }
//   });

//   // ----------------------------------------------------------
//   // Message Delivered
//   // ----------------------------------------------------------

//   socket.on("message:delivered", async ({ messageId }) => {
//     try {
//       if (!messageId) {
//         socket.emit("message:error", {
//           message: "Message ID is required",
//         });
//         return;
//       }

//       const result = await markMessageAsDelivered(userId, messageId);

//       io.to(`user:${result.senderId}`).emit("message:delivery:update", {
//         messageId: result.messageId,
//         conversationId: result.conversationId,
//         userId: result.userId,
//       });

//       console.log(
//         `Message ${result.messageId} delivered to user ${result.userId}`,
//       );
//     } catch (error) {
//       console.error("message:delivered error:", error);

//       socket.emit("message:error", {
//         message:
//           error instanceof Error
//             ? error.message
//             : "Failed to mark message as delivered",
//       });
//     }
//   });

//   // ----------------------------------------------------------
//   // Message Read - Single Message
//   // ----------------------------------------------------------

//   socket.on("message:read", async ({ messageId }) => {
//     try {
//       if (!messageId) {
//         socket.emit("message:error", {
//           message: "Message ID is required",
//         });
//         return;
//       }

//       const message = await markMessageAsRead(userId, messageId);

//       const conversationId = message.conversationId.toString();

//       await invalidateUserConversationsCache([userId]);

//       const senderId =
//         typeof message.senderId === "string"
//           ? message.senderId
//           : message.senderId._id.toString();

//       io.to(`user:${senderId}`).emit("message:read:update", {
//         messageId: message._id.toString(),
//         conversationId,
//         userId,
//       });

//       console.log(`User ${userId} read message ${messageId}`);
//     } catch (error) {
//       console.error("message:read error:", error);

//       socket.emit("message:error", {
//         message:
//           error instanceof Error
//             ? error.message
//             : "Failed to mark message as read",
//       });
//     }
//   });

//   // ----------------------------------------------------------
//   // Conversation Read
//   // ----------------------------------------------------------

//   socket.on("conversation:read", async ({ conversationId }) => {
//     try {
//       console.log("conversation:read RECEIVED:", {
//         conversationId,
//         userId,
//       });

//       if (!conversationId) {
//         socket.emit("conversation:error", {
//           message: "Conversation ID is required",
//           conversationId,
//         });
//         return;
//       }

//       if (!Types.ObjectId.isValid(conversationId)) {
//         socket.emit("conversation:error", {
//           message: "Invalid conversation ID",
//           conversationId,
//         });
//         return;
//       }

//       if (!Types.ObjectId.isValid(userId)) {
//         socket.emit("conversation:error", {
//           message: "Invalid user ID",
//           conversationId,
//         });
//         return;
//       }

//       const isMember = await isConversationMember(conversationId, userId);

//       if (!isMember) {
//         socket.emit("conversation:error", {
//           message: "You are not a member of this conversation",
//           conversationId,
//         });
//         return;
//       }

//       const conversationObjectId = new Types.ObjectId(conversationId);

//       const userObjectId = new Types.ObjectId(userId);

//       const unreadMessages = await MessageModel.find({
//         conversationId: conversationObjectId,
//         senderId: { $ne: userObjectId },
//         type: { $ne: "system" },
//         isDeleted: false,
//         readBy: { $nin: [userObjectId] },
//       })
//         .select("_id senderId")
//         .lean();

//       if (unreadMessages.length === 0) {
//         await invalidateUserConversationsCache([userId]);

//         socket.emit("conversation:read:update", {
//           conversationId,
//           userId,
//           messageIds: [],
//         });

//         return;
//       }

//       const messageIds = unreadMessages.map((message) =>
//         message._id.toString(),
//       );

//       const updateResult = await MessageModel.updateMany(
//         {
//           _id: {
//             $in: unreadMessages.map((message) => message._id),
//           },
//           readBy: { $nin: [userObjectId] },
//         },
//         {
//           $addToSet: {
//             readBy: userObjectId,
//           },
//         },
//       );

//       console.log("READ UPDATE RESULT:", {
//         conversationId,
//         userId,
//         matchedCount: updateResult.matchedCount,
//         modifiedCount: updateResult.modifiedCount,
//         messageCount: messageIds.length,
//       });

//       await invalidateUserConversationsCache([userId]);

//       socket.emit("conversation:read:update", {
//         conversationId,
//         userId,
//         messageIds,
//       });

//       const senderIds = [
//         ...new Set(
//           unreadMessages
//             .map((message) => message.senderId?.toString())
//             .filter(
//               (senderId): senderId is string =>
//                 Boolean(senderId) && senderId !== userId,
//             ),
//         ),
//       ];

//       for (const senderId of senderIds) {
//         io.to(`user:${senderId}`).emit("conversation:read:update", {
//           conversationId,
//           userId,
//           messageIds,
//         });
//       }

//       console.log(
//         `Conversation ${conversationId}: ${messageIds.length} message(s) marked as read by user ${userId}`,
//       );
//     } catch (error) {
//       console.error("conversation:read error:", error);

//       socket.emit("conversation:error", {
//         message:
//           error instanceof Error
//             ? error.message
//             : "Failed to mark conversation as read",
//         conversationId,
//       });
//     }
//   });

//   // ----------------------------------------------------------
//   // Typing Start
//   // ----------------------------------------------------------

//   socket.on("typing:start", async ({ conversationId }) => {
//     try {
//       if (!conversationId || !Types.ObjectId.isValid(conversationId)) {
//         socket.emit("message:error", {
//           message: "Valid conversation ID is required",
//         });
//         return;
//       }

//       const isMember = await isConversationMember(conversationId, userId);

//       if (!isMember) {
//         socket.emit("message:error", {
//           message: "You are not a member of this conversation",
//         });
//         return;
//       }

//       const blocked = await isDirectConversationBlocked(conversationId, userId);

//       if (blocked) return;

//       socket.to(conversationId).emit("typing:start", {
//         conversationId,
//         userId,
//       });

//       console.log(`User ${userId} started typing in ${conversationId}`);
//     } catch (error) {
//       console.error("typing:start error:", error);
//     }
//   });

//   // ----------------------------------------------------------
//   // Typing Stop
//   // ----------------------------------------------------------

//   socket.on("typing:stop", async ({ conversationId }) => {
//     try {
//       if (!conversationId || !Types.ObjectId.isValid(conversationId)) {
//         socket.emit("message:error", {
//           message: "Valid conversation ID is required",
//         });
//         return;
//       }

//       const isMember = await isConversationMember(conversationId, userId);

//       if (!isMember) {
//         socket.emit("message:error", {
//           message: "You are not a member of this conversation",
//         });
//         return;
//       }

//       const blocked = await isDirectConversationBlocked(conversationId, userId);

//       if (blocked) return;

//       socket.to(conversationId).emit("typing:stop", {
//         conversationId,
//         userId,
//       });

//       console.log(`User ${userId} stopped typing in ${conversationId}`);
//     } catch (error) {
//       console.error("typing:stop error:", error);
//     }
//   });

//   // ==========================================================
//   // WEBRTC CALL SIGNALING
//   // ==========================================================

//   // ----------------------------------------------------------
//   // Initiate Call
//   // ----------------------------------------------------------

//   socket.on("call:initiate", async ({ receiverId, type }) => {
//     try {
//       if (!receiverId || !Types.ObjectId.isValid(receiverId)) {
//         emitCallError("Valid receiver ID is required");
//         return;
//       }

//       if (receiverId === userId) {
//         emitCallError("You cannot call yourself");
//         return;
//       }

//       if (type !== "audio" && type !== "video") {
//         emitCallError("Call type must be audio or video");
//         return;
//       }

//       if (!Types.ObjectId.isValid(userId)) {
//         emitCallError("Invalid caller ID");
//         return;
//       }

//       // Prevent calls if either user blocked the other.
//       const blocked = await BlockModel.exists({
//         $or: [
//           {
//             blockerId: new Types.ObjectId(userId),
//             blockedId: new Types.ObjectId(receiverId),
//           },
//           {
//             blockerId: new Types.ObjectId(receiverId),
//             blockedId: new Types.ObjectId(userId),
//           },
//         ],
//       });

//       if (blocked) {
//         emitCallError("You cannot call this user");
//         return;
//       }

//       const call = await callService.createCall({
//         caller: userId,
//         receiver: receiverId,
//         type,
//       });

//       const payload = {
//         callId: call._id.toString(),
//         callerId: userId,
//         receiverId,
//         type,
//         status: "ringing" as const,
//       };

//       io.to(`user:${receiverId}`).emit("call:incoming", payload);

//       // Confirm creation to caller as well.
//       socket.emit("call:incoming", payload);

//       console.log(`Call initiated: ${userId} -> ${receiverId} (${type})`);
//     } catch (error) {
//       console.error("call:initiate error:", error);

//       emitCallError(
//         error instanceof Error ? error.message : "Failed to initiate call",
//       );
//     }
//   });

//   // ----------------------------------------------------------
//   // WebRTC Offer: caller -> receiver
//   // ----------------------------------------------------------

//   socket.on("call:offer", async ({ callId, receiverId, offer }) => {
//     try {
//       if (!callId || !receiverId || !offer) {
//         emitCallError("Call ID, receiver ID and offer are required");
//         return;
//       }

//       if (
//         !Types.ObjectId.isValid(callId) ||
//         !Types.ObjectId.isValid(receiverId)
//       ) {
//         emitCallError("Invalid call or receiver ID");
//         return;
//       }

//       const details = await getCallDetails(callId);

//       if (!details) {
//         emitCallError("Call not found");
//         return;
//       }

//       if (details.callerId !== userId || details.receiverId !== receiverId) {
//         emitCallError("You are not authorized to send this offer");
//         return;
//       }

//       if (!isActiveCallStatus(details.status)) {
//         emitCallError("This call is no longer active");
//         return;
//       }

//       io.to(`user:${details.receiverId}`).emit("call:offer", {
//         callId,
//         callerId: userId,
//         offer,
//       });
//     } catch (error) {
//       console.error("call:offer error:", error);

//       emitCallError(
//         error instanceof Error ? error.message : "Failed to send call offer",
//       );
//     }
//   });

//   // ----------------------------------------------------------
//   // WebRTC Answer: receiver -> caller
//   // ----------------------------------------------------------

//   socket.on("call:answer", async ({ callId, callerId, answer }) => {
//     try {
//       if (!callId || !callerId || !answer) {
//         emitCallError("Call ID, caller ID and answer are required");
//         return;
//       }

//       if (
//         !Types.ObjectId.isValid(callId) ||
//         !Types.ObjectId.isValid(callerId)
//       ) {
//         emitCallError("Invalid call or caller ID");
//         return;
//       }

//       const details = await getCallDetails(callId);

//       if (!details) {
//         emitCallError("Call not found");
//         return;
//       }

//       if (details.receiverId !== userId || details.callerId !== callerId) {
//         emitCallError("You are not authorized to answer this call");
//         return;
//       }

//       if (details.status !== "accepted") {
//         emitCallError("The call must be accepted before answering");
//         return;
//       }

//       io.to(`user:${details.callerId}`).emit("call:answer", {
//         callId,
//         receiverId: userId,
//         answer,
//       });
//     } catch (error) {
//       console.error("call:answer error:", error);

//       emitCallError(
//         error instanceof Error ? error.message : "Failed to send call answer",
//       );
//     }
//   });

//   // ----------------------------------------------------------
//   // ICE Candidate: forward only to the other participant
//   // ----------------------------------------------------------

//   socket.on(
//     "call:ice-candidate",
//     async ({ callId, targetUserId, candidate }) => {
//       try {
//         if (!callId || !targetUserId || !candidate) {
//           emitCallError("Call ID, target user ID and candidate are required");
//           return;
//         }

//         if (
//           !Types.ObjectId.isValid(callId) ||
//           !Types.ObjectId.isValid(targetUserId)
//         ) {
//           emitCallError("Invalid call or target user ID");
//           return;
//         }

//         const details = await getCallDetails(callId);

//         if (!details) {
//           emitCallError("Call not found");
//           return;
//         }

//         if (!isActiveCallStatus(details.status)) {
//           emitCallError("This call is no longer active");
//           return;
//         }

//         const otherParticipantId =
//           details.callerId === userId
//             ? details.receiverId
//             : details.receiverId === userId
//               ? details.callerId
//               : null;

//         if (!otherParticipantId) {
//           emitCallError("You are not a participant in this call");
//           return;
//         }

//         if (targetUserId !== otherParticipantId) {
//           emitCallError("Invalid ICE candidate recipient");
//           return;
//         }

//         io.to(`user:${otherParticipantId}`).emit("call:ice-candidate", {
//           callId,
//           senderId: userId,
//           candidate,
//         });
//       } catch (error) {
//         console.error("call:ice-candidate error:", error);

//         emitCallError(
//           error instanceof Error
//             ? error.message
//             : "Failed to send ICE candidate",
//         );
//       }
//     },
//   );

//   // ----------------------------------------------------------
//   // Accept Call: receiver only
//   // ----------------------------------------------------------

//   socket.on("call:accept", async ({ callId, callerId }) => {
//     try {
//       if (!callId || !callerId) {
//         emitCallError("Call ID and caller ID are required");
//         return;
//       }

//       if (
//         !Types.ObjectId.isValid(callId) ||
//         !Types.ObjectId.isValid(callerId)
//       ) {
//         emitCallError("Invalid call or caller ID");
//         return;
//       }

//       const details = await getCallDetails(callId);

//       if (!details) {
//         emitCallError("Call not found");
//         return;
//       }

//       if (details.receiverId !== userId || details.callerId !== callerId) {
//         emitCallError("You are not authorized to accept this call");
//         return;
//       }

//       if (details.status !== "ringing") {
//         emitCallError("This call is no longer ringing");
//         return;
//       }

//       const call = await callService.updateCallStatus(callId, "accepted");

//       if (!call) {
//         emitCallError("Call not found");
//         return;
//       }

//       const payload = {
//         callId,
//         callerId: details.callerId,
//         receiverId: userId,
//       };

//       io.to(`user:${details.callerId}`).emit("call:accepted", payload);

//       socket.emit("call:accepted", payload);

//       console.log(`Call ${callId} accepted by ${userId}`);
//     } catch (error) {
//       console.error("call:accept error:", error);

//       emitCallError(
//         error instanceof Error ? error.message : "Failed to accept call",
//       );
//     }
//   });

//   // ----------------------------------------------------------
//   // Reject Call: receiver only
//   // ----------------------------------------------------------

//   socket.on("call:reject", async ({ callId, callerId }) => {
//     try {
//       if (!callId || !callerId) {
//         emitCallError("Call ID and caller ID are required");
//         return;
//       }

//       if (
//         !Types.ObjectId.isValid(callId) ||
//         !Types.ObjectId.isValid(callerId)
//       ) {
//         emitCallError("Invalid call or caller ID");
//         return;
//       }

//       const details = await getCallDetails(callId);

//       if (!details) {
//         emitCallError("Call not found");
//         return;
//       }

//       if (details.receiverId !== userId || details.callerId !== callerId) {
//         emitCallError("You are not authorized to reject this call");
//         return;
//       }

//       if (details.status !== "ringing") {
//         emitCallError("Only a ringing call can be rejected");
//         return;
//       }

//       const call = await callService.updateCallStatus(callId, "rejected");

//       if (!call) {
//         emitCallError("Call not found");
//         return;
//       }

//       const payload = {
//         callId,
//         callerId: details.callerId,
//         receiverId: userId,
//       };

//       io.to(`user:${details.callerId}`).emit("call:rejected", payload);

//       socket.emit("call:rejected", payload);

//       console.log(`Call ${callId} rejected by ${userId}`);
//     } catch (error) {
//       console.error("call:reject error:", error);

//       emitCallError(
//         error instanceof Error ? error.message : "Failed to reject call",
//       );
//     }
//   });

//   // ----------------------------------------------------------
//   // Cancel Call: caller only, before acceptance
//   // ----------------------------------------------------------

//   socket.on("call:cancel", async ({ callId, receiverId }) => {
//     try {
//       if (!callId || !receiverId) {
//         emitCallError("Call ID and receiver ID are required");
//         return;
//       }

//       if (
//         !Types.ObjectId.isValid(callId) ||
//         !Types.ObjectId.isValid(receiverId)
//       ) {
//         emitCallError("Invalid call or receiver ID");
//         return;
//       }

//       const details = await getCallDetails(callId);

//       if (!details) {
//         emitCallError("Call not found");
//         return;
//       }

//       if (details.callerId !== userId || details.receiverId !== receiverId) {
//         emitCallError("You are not authorized to cancel this call");
//         return;
//       }

//       if (details.status !== "ringing") {
//         emitCallError("Only a ringing call can be cancelled");
//         return;
//       }

//       const call = await callService.updateCallStatus(callId, "cancelled");

//       if (!call) {
//         emitCallError("Call not found");
//         return;
//       }

//       const payload = {
//         callId,
//         callerId: userId,
//         receiverId: details.receiverId,
//       };

//       io.to(`user:${details.receiverId}`).emit("call:cancelled", payload);

//       socket.emit("call:cancelled", payload);

//       console.log(`Call ${callId} cancelled by ${userId}`);
//     } catch (error) {
//       console.error("call:cancel error:", error);

//       emitCallError(
//         error instanceof Error ? error.message : "Failed to cancel call",
//       );
//     }
//   });

//   // ----------------------------------------------------------
//   // End Call: either participant
//   // ----------------------------------------------------------

//   socket.on("call:end", async ({ callId, targetUserId }) => {
//     try {
//       if (!callId || !targetUserId) {
//         emitCallError("Call ID and target user ID are required");
//         return;
//       }

//       if (
//         !Types.ObjectId.isValid(callId) ||
//         !Types.ObjectId.isValid(targetUserId)
//       ) {
//         emitCallError("Invalid call or target user ID");
//         return;
//       }

//       const details = await getCallDetails(callId);

//       if (!details) {
//         emitCallError("Call not found");
//         return;
//       }

//       const otherParticipantId =
//         details.callerId === userId
//           ? details.receiverId
//           : details.receiverId === userId
//             ? details.callerId
//             : null;

//       if (!otherParticipantId) {
//         emitCallError("You are not a participant in this call");
//         return;
//       }

//       if (targetUserId !== otherParticipantId) {
//         emitCallError("Invalid call recipient");
//         return;
//       }

//       if (!isActiveCallStatus(details.status)) {
//         emitCallError("This call has already ended");
//         return;
//       }

//       const call = await callService.completeCall(callId, userId);

//       if (!call) {
//         emitCallError("Call not found");
//         return;
//       }

//       const payload = {
//         callId,
//         callerId: details.callerId,
//         receiverId: details.receiverId,
//         endedBy: userId,
//         duration: call.duration ?? 0,
//       };

//       io.to(`user:${otherParticipantId}`).emit("call:ended", payload);

//       socket.emit("call:ended", payload);

//       console.log(`Call ${callId} ended by ${userId}`);
//     } catch (error) {
//       console.error("call:end error:", error);

//       emitCallError(
//         error instanceof Error ? error.message : "Failed to end call",
//       );
//     }
//   });

//   // ----------------------------------------------------------
//   // Disconnect
//   // ----------------------------------------------------------

//   socket.on("disconnect", (reason) => {
//     console.log(
//       `Socket disconnected: ${socket.id}`,
//       `userId: ${userId}`,
//       `reason: ${reason}`,
//     );

//     setUserOffline(userId)
//       .then(() => {
//         console.log(`User ${userId} is offline`);
//       })
//       .catch((error) => {
//         console.error("Failed to set user offline:", error);
//       });
//   });
// };




import { Server } from "socket.io";
import { Types } from "mongoose";

import { AuthenticatedSocket } from "./socket.types";

import {
  setUserOffline,
  setUserOnline,
} from "../module/user/user.service";

import {
  addReaction,
  createMessage,
  deleteMessage,
  editMessage,
  markMessageAsDelivered,
  markMessageAsRead,
} from "../module/message/message.service";

import { isConversationMember } from "../module/conversation/conversation.service";
import { ConversationModel } from "../module/conversation/conversation.model";
import { MessageModel } from "../module/message/message.model";
import { BlockModel } from "../module/block/block.model";
import { invalidateUserConversationsCache } from "../cache/cache.service";

import { callService } from "../module/call/call.service";
import { Call } from "../module/call/call.model";

interface PopulatedSender {
  _id: Types.ObjectId;
  phone: string;
  name: string;
  avatar?: string | null;
  bio?: string | null;
  isOnline?: boolean;
  lastSeen?: Date | null;
}

type CallHistoryStatus =
  | "completed"
  | "rejected"
  | "cancelled"
  | "missed";

const isDirectConversationBlocked = async (
  conversationId: string,
  currentUserId: string,
): Promise<boolean> => {
  if (!Types.ObjectId.isValid(conversationId)) {
    throw new Error("Invalid conversation ID");
  }

  if (!Types.ObjectId.isValid(currentUserId)) {
    throw new Error("Invalid current user ID");
  }

  const conversation = await ConversationModel.findOne({
    _id: new Types.ObjectId(conversationId),
    participants: new Types.ObjectId(currentUserId),
  }).select("type participants");

  if (!conversation) {
    throw new Error("Conversation not found or you are not a member");
  }

  if (conversation.type !== "direct") return false;

  const otherParticipantId = conversation.participants.find(
    (participantId) => participantId.toString() !== currentUserId,
  );

  if (!otherParticipantId) {
    throw new Error("Direct conversation participant not found");
  }

  const blockExists = await BlockModel.exists({
    $or: [
      {
        blockerId: new Types.ObjectId(currentUserId),
        blockedId: otherParticipantId,
      },
      {
        blockerId: otherParticipantId,
        blockedId: new Types.ObjectId(currentUserId),
      },
    ],
  });

  return Boolean(blockExists);
};

export const registerSocketHandlers = (
  io: Server,
  socket: AuthenticatedSocket,
) => {
  const userId = socket.data.userId;

  socket.join(`user:${userId}`);

  console.log(`User ${userId} joined personal socket room`);

  setUserOnline(userId).catch((error) => {
    console.error("Failed to set user online:", error);
  });

  // ==========================================================
  // CALL HELPERS
  // ==========================================================

  const getCallDetails = async (callId: string) => {
    if (!Types.ObjectId.isValid(callId)) return null;

    const call = await Call.findById(callId).select(
      "caller receiver status type",
    );

    if (!call) return null;

    return {
      call,
      callerId: call.caller.toString(),
      receiverId: call.receiver.toString(),
      status: call.status,
      type: call.type as "audio" | "video",
    };
  };

  const emitCallError = (message: string) => {
    socket.emit("call:error", { message });
  };

  const isActiveCallStatus = (status: string) =>
    status === "ringing" || status === "accepted";

  // ==========================================================
  // CREATE CALL HISTORY MESSAGE
  // ==========================================================

  const createCallHistoryMessage = async (params: {
    callId: string;
    callerId: string;
    receiverId: string;
    type: "audio" | "video";
    status: CallHistoryStatus;
    duration?: number;
  }) => {
    const {
      callId,
      callerId,
      receiverId,
      type,
      status,
      duration = 0,
    } = params;

    const callObjectId = new Types.ObjectId(callId);
    const callerObjectId = new Types.ObjectId(callerId);
    const receiverObjectId = new Types.ObjectId(receiverId);

    // Prevent duplicate history messages for the same call.
    const existingMessage = await MessageModel.findOne({
      callId: callObjectId,
    });

    if (existingMessage) return existingMessage;

    const conversation = await ConversationModel.findOne({
      type: "direct",
      participants: {
        $all: [callerObjectId, receiverObjectId],
        $size: 2,
      },
    });

    if (!conversation) {
      console.warn(
        `No direct conversation found for call ${callId}. History was not created.`,
      );
      return null;
    }

    const callLabel = type === "audio" ? "Audio call" : "Video call";
    const safeDuration = Math.max(0, Math.floor(duration));

    const minutes = Math.floor(safeDuration / 60);
    const seconds = safeDuration % 60;

    const formattedDuration =
      `${String(minutes).padStart(2, "0")}:` +
      `${String(seconds).padStart(2, "0")}`;

    let text: string;

    switch (status) {
      case "completed":
        text = `${callLabel} · Completed · ${formattedDuration}`;
        break;
      case "rejected":
        text = `${callLabel} · Rejected`;
        break;
      case "cancelled":
        text = `${callLabel} · Cancelled`;
        break;
      default:
        text = `${callLabel} · Missed call`;
    }

    let createdMessage;

    try {
      createdMessage = await MessageModel.create({
        conversationId: conversation._id,
        senderId: callerObjectId,
        callId: callObjectId,
        type: "system",
        text,
        attachments: [],
      });
    } catch (error: unknown) {
      // A concurrent request may already have created this call history.
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === 11000
      ) {
        return MessageModel.findOne({ callId: callObjectId });
      }

      throw error;
    }

    await ConversationModel.updateOne(
      { _id: conversation._id },
      { $set: { lastMessage: createdMessage._id } },
    );

    const participantIds = [callerId, receiverId];

    await invalidateUserConversationsCache(participantIds);

    const populatedMessage = await MessageModel.findById(
      createdMessage._id,
    ).populate(
      "senderId",
      "_id phone name avatar bio isOnline lastSeen",
    );

    if (!populatedMessage) return createdMessage;

    const sender =
      populatedMessage.senderId as unknown as PopulatedSender;

    const socketMessage = {
      ...populatedMessage.toObject(),
      senderId: {
        _id: sender._id,
        phone: sender.phone,
        name: sender.name,
        avatar: sender.avatar ?? null,
        bio: sender.bio ?? null,
        isOnline: sender.isOnline ?? false,
        lastSeen: sender.lastSeen ?? null,
      },
    };

    // Deliver to both users, even if neither has this chat open.
    io.to(`user:${callerId}`).emit("message:new", socketMessage);
    io.to(`user:${receiverId}`).emit("message:new", socketMessage);

    return createdMessage;
  };

  // ==========================================================
  // SEND MESSAGE
  // ==========================================================

  socket.on("message:send", async (payload) => {
    try {
      const { conversationId, text = "", replyTo } = payload;

      if (!conversationId) {
        socket.emit("message:error", {
          message: "Conversation ID is required",
        });
        return;
      }

      if (!Types.ObjectId.isValid(conversationId)) {
        socket.emit("message:error", {
          message: "Invalid conversation ID",
        });
        return;
      }

      const isMember = await isConversationMember(conversationId, userId);

      if (!isMember) {
        socket.emit("message:error", {
          message: "You are not a member of this conversation",
        });
        return;
      }

      const blocked = await isDirectConversationBlocked(
        conversationId,
        userId,
      );

      if (blocked) {
        socket.emit("message:error", {
          message: "You cannot send messages in this conversation",
        });
        return;
      }

      const message = await createMessage(
        userId,
        conversationId,
        text,
        replyTo,
        [],
      );

      const conversation = await ConversationModel.findById(
        conversationId,
      ).select("participants");

      if (!conversation) throw new Error("Conversation not found");

      const sender = message.senderId as unknown as PopulatedSender;
      const socketMessage = message.toObject();

      const populatedSender = {
        _id: sender._id,
        phone: sender.phone,
        name: sender.name,
        avatar: sender.avatar ?? null,
        bio: sender.bio ?? null,
        isOnline: sender.isOnline ?? false,
        lastSeen: sender.lastSeen ?? null,
      };

      const participantIds = conversation.participants.map((id) =>
        id.toString(),
      );

      await invalidateUserConversationsCache(participantIds);

      for (const participantId of conversation.participants) {
        io.to(`user:${participantId.toString()}`).emit("message:new", {
          ...socketMessage,
          senderId: populatedSender,
        });
      }
    } catch (error) {
      console.error("message:send error:", error);

      socket.emit("message:error", {
        message:
          error instanceof Error ? error.message : "Failed to send message",
      });
    }
  });

  // ==========================================================
  // MESSAGE REACTION
  // ==========================================================

  socket.on("message:reaction", async (payload) => {
    try {
      const { messageId, emoji } = payload;

      if (!messageId || !emoji) {
        socket.emit("message:error", {
          message: "Message ID and emoji are required",
        });
        return;
      }

      const result = await addReaction(userId, messageId, emoji);
      const conversationId = result.message.conversationId.toString();

      const targetUserId =
        typeof result.message.senderId === "string"
          ? result.message.senderId
          : result.message.senderId.toString();

      const eventId =
        `${result.message._id.toString()}:${userId}:${Date.now()}`;

      const reactionPayload = {
        eventId,
        messageId: result.message._id.toString(),
        conversationId,
        action: result.action,
        reactorId: userId,
        targetUserId,
        reactionSummary: result.reactionSummary,
      };

      io.to(conversationId).emit(
        "message:reaction:update",
        reactionPayload,
      );

      if (targetUserId !== userId) {
        io.to(`user:${targetUserId}`).emit(
          "message:reaction:update",
          reactionPayload,
        );
      }

      console.log(
        `Reaction ${result.action}: ${emoji} on message ${messageId}`,
      );
    } catch (error) {
      console.error("message:reaction error:", error);

      socket.emit("message:error", {
        message:
          error instanceof Error
            ? error.message
            : "Failed to update reaction",
      });
    }
  });

  // ==========================================================
  // DELETE MESSAGE
  // ==========================================================

  socket.on("message:delete", async (payload) => {
    try {
      const { messageId } = payload;

      if (!messageId) {
        socket.emit("message:error", {
          message: "Message ID is required",
        });
        return;
      }

      const deletedMessage = await deleteMessage(userId, messageId);
      const conversationId = deletedMessage.conversationId.toString();

      const conversation = await ConversationModel.findById(
        conversationId,
      ).select("participants");

      if (conversation) {
        await invalidateUserConversationsCache(
          conversation.participants.map((id) => id.toString()),
        );
      }

      io.to(conversationId).emit("message:deleted", deletedMessage);

      console.log(`Message ${messageId} deleted`);
    } catch (error) {
      console.error("message:delete error:", error);

      socket.emit("message:error", {
        message:
          error instanceof Error ? error.message : "Failed to delete message",
      });
    }
  });

  // ==========================================================
  // EDIT MESSAGE
  // ==========================================================

  socket.on("message:edit", async (payload) => {
    try {
      const { messageId, text } = payload;

      if (!messageId) {
        socket.emit("message:error", {
          message: "Message ID is required",
        });
        return;
      }

      if (!text || !text.trim()) {
        socket.emit("message:error", {
          message: "Message text is required",
        });
        return;
      }

      const message = await editMessage(userId, messageId, text);
      const conversationId = message.conversationId.toString();

      const conversation = await ConversationModel.findById(
        conversationId,
      ).select("participants");

      if (conversation) {
        await invalidateUserConversationsCache(
          conversation.participants.map((id) => id.toString()),
        );
      }

      io.to(conversationId).emit("message:edited", message);
    } catch (error) {
      console.error("message:edit error:", error);

      socket.emit("message:error", {
        message:
          error instanceof Error ? error.message : "Failed to edit message",
      });
    }
  });

  // ==========================================================
  // MESSAGE DELIVERED
  // ==========================================================

  socket.on("message:delivered", async ({ messageId }) => {
    try {
      if (!messageId) {
        socket.emit("message:error", {
          message: "Message ID is required",
        });
        return;
      }

      const result = await markMessageAsDelivered(userId, messageId);

      io.to(`user:${result.senderId}`).emit("message:delivery:update", {
        messageId: result.messageId,
        conversationId: result.conversationId,
        userId: result.userId,
      });
    } catch (error) {
      console.error("message:delivered error:", error);

      socket.emit("message:error", {
        message:
          error instanceof Error
            ? error.message
            : "Failed to mark message as delivered",
      });
    }
  });

  // ==========================================================
  // SINGLE MESSAGE READ
  // ==========================================================

  socket.on("message:read", async ({ messageId }) => {
    try {
      if (!messageId) {
        socket.emit("message:error", {
          message: "Message ID is required",
        });
        return;
      }

      const message = await markMessageAsRead(userId, messageId);
      const conversationId = message.conversationId.toString();

      await invalidateUserConversationsCache([userId]);

      const senderId =
        typeof message.senderId === "string"
          ? message.senderId
          : message.senderId._id.toString();

      io.to(`user:${senderId}`).emit("message:read:update", {
        messageId: message._id.toString(),
        conversationId,
        userId,
      });
    } catch (error) {
      console.error("message:read error:", error);

      socket.emit("message:error", {
        message:
          error instanceof Error
            ? error.message
            : "Failed to mark message as read",
      });
    }
  });

  // ==========================================================
  // CONVERSATION READ
  // ==========================================================

  socket.on("conversation:read", async ({ conversationId }) => {
    try {
      if (
        !conversationId ||
        !Types.ObjectId.isValid(conversationId) ||
        !Types.ObjectId.isValid(userId)
      ) {
        socket.emit("conversation:error", {
          message: "Valid conversation ID and user ID are required",
          conversationId,
        });
        return;
      }

      const isMember = await isConversationMember(conversationId, userId);

      if (!isMember) {
        socket.emit("conversation:error", {
          message: "You are not a member of this conversation",
          conversationId,
        });
        return;
      }

      const conversationObjectId = new Types.ObjectId(conversationId);
      const userObjectId = new Types.ObjectId(userId);

      const unreadMessages = await MessageModel.find({
        conversationId: conversationObjectId,
        senderId: { $ne: userObjectId },
        type: { $ne: "system" },
        isDeleted: false,
        readBy: { $nin: [userObjectId] },
      })
        .select("_id senderId")
        .lean();

      const messageIds = unreadMessages.map((message) =>
        message._id.toString(),
      );

      if (unreadMessages.length > 0) {
        await MessageModel.updateMany(
          {
            _id: { $in: unreadMessages.map((message) => message._id) },
            readBy: { $nin: [userObjectId] },
          },
          { $addToSet: { readBy: userObjectId } },
        );
      }

      await invalidateUserConversationsCache([userId]);

      socket.emit("conversation:read:update", {
        conversationId,
        userId,
        messageIds,
      });

      const senderIds = [
        ...new Set(
          unreadMessages
            .map((message) => message.senderId?.toString())
            .filter(
              (senderId): senderId is string =>
                Boolean(senderId) && senderId !== userId,
            ),
        ),
      ];

      for (const senderId of senderIds) {
        io.to(`user:${senderId}`).emit("conversation:read:update", {
          conversationId,
          userId,
          messageIds,
        });
      }
    } catch (error) {
      console.error("conversation:read error:", error);

      socket.emit("conversation:error", {
        message:
          error instanceof Error
            ? error.message
            : "Failed to mark conversation as read",
        conversationId,
      });
    }
  });

  // ==========================================================
  // TYPING START / STOP
  // ==========================================================

  socket.on("typing:start", async ({ conversationId }) => {
    try {
      if (!conversationId || !Types.ObjectId.isValid(conversationId)) {
        socket.emit("message:error", {
          message: "Valid conversation ID is required",
        });
        return;
      }

      const isMember = await isConversationMember(conversationId, userId);
      if (!isMember) return;

      const blocked = await isDirectConversationBlocked(
        conversationId,
        userId,
      );

      if (blocked) return;

      socket.to(conversationId).emit("typing:start", {
        conversationId,
        userId,
      });
    } catch (error) {
      console.error("typing:start error:", error);
    }
  });

  socket.on("typing:stop", async ({ conversationId }) => {
    try {
      if (!conversationId || !Types.ObjectId.isValid(conversationId)) {
        socket.emit("message:error", {
          message: "Valid conversation ID is required",
        });
        return;
      }

      const isMember = await isConversationMember(conversationId, userId);
      if (!isMember) return;

      const blocked = await isDirectConversationBlocked(
        conversationId,
        userId,
      );

      if (blocked) return;

      socket.to(conversationId).emit("typing:stop", {
        conversationId,
        userId,
      });
    } catch (error) {
      console.error("typing:stop error:", error);
    }
  });

  // ==========================================================
  // WEBRTC CALL SIGNALING
  // ==========================================================

  // INITIATE CALL
  socket.on("call:initiate", async ({ receiverId, type }) => {
    try {
      if (!receiverId || !Types.ObjectId.isValid(receiverId)) {
        emitCallError("Valid receiver ID is required");
        return;
      }

      if (receiverId === userId) {
        emitCallError("You cannot call yourself");
        return;
      }

      if (type !== "audio" && type !== "video") {
        emitCallError("Call type must be audio or video");
        return;
      }

      if (!Types.ObjectId.isValid(userId)) {
        emitCallError("Invalid caller ID");
        return;
      }

      const blocked = await BlockModel.exists({
        $or: [
          {
            blockerId: new Types.ObjectId(userId),
            blockedId: new Types.ObjectId(receiverId),
          },
          {
            blockerId: new Types.ObjectId(receiverId),
            blockedId: new Types.ObjectId(userId),
          },
        ],
      });

      if (blocked) {
        emitCallError("You cannot call this user");
        return;
      }

      const call = await callService.createCall({
        caller: userId,
        receiver: receiverId,
        type,
      });

      const callId = call._id.toString();

      const payload = {
        callId,
        callerId: userId,
        receiverId,
        type,
        status: "ringing" as const,
      };

      io.to(`user:${receiverId}`).emit("call:incoming", payload);
      socket.emit("call:incoming", payload);

      // If the call is still ringing after 30 seconds, mark it missed.
      // updateCallStatus must atomically update only a ringing call.
      setTimeout(async () => {
        try {
          const missedCall = await callService.updateCallStatus(
            callId,
            "missed",
          );

          // If accepted, rejected or cancelled already, nothing is changed.
          if (!missedCall) return;

          await createCallHistoryMessage({
            callId,
            callerId: userId,
            receiverId,
            type,
            status: "missed",
            duration: 0,
          });

          const missedPayload = {
            callId,
            callerId: userId,
            receiverId,
            endedBy: "system",
            duration: 0,
          };

          io.to(`user:${userId}`).emit("call:ended", missedPayload);
          io.to(`user:${receiverId}`).emit("call:ended", missedPayload);

          console.log(`Call ${callId} marked as missed`);
        } catch (error) {
          console.error("Missed call timeout error:", error);
        }
      }, 30_000);

      console.log(`Call initiated: ${userId} -> ${receiverId} (${type})`);
    } catch (error) {
      console.error("call:initiate error:", error);

      emitCallError(
        error instanceof Error ? error.message : "Failed to initiate call",
      );
    }
  });

  // SEND WEBRTC OFFER
  socket.on("call:offer", async ({ callId, receiverId, offer }) => {
    try {
      if (!callId || !receiverId || !offer) {
        emitCallError("Call ID, receiver ID and offer are required");
        return;
      }

      const details = await getCallDetails(callId);

      if (!details) {
        emitCallError("Call not found");
        return;
      }

      if (details.callerId !== userId || details.receiverId !== receiverId) {
        emitCallError("You are not authorized to send this offer");
        return;
      }

      if (!isActiveCallStatus(details.status)) {
        emitCallError("This call is no longer active");
        return;
      }

      io.to(`user:${details.receiverId}`).emit("call:offer", {
        callId,
        callerId: userId,
        offer,
      });
    } catch (error) {
      console.error("call:offer error:", error);

      emitCallError(
        error instanceof Error ? error.message : "Failed to send call offer",
      );
    }
  });

  // SEND WEBRTC ANSWER
  socket.on("call:answer", async ({ callId, callerId, answer }) => {
    try {
      if (!callId || !callerId || !answer) {
        emitCallError("Call ID, caller ID and answer are required");
        return;
      }

      const details = await getCallDetails(callId);

      if (!details) {
        emitCallError("Call not found");
        return;
      }

      if (details.receiverId !== userId || details.callerId !== callerId) {
        emitCallError("You are not authorized to answer this call");
        return;
      }

      if (details.status !== "accepted") {
        emitCallError("The call must be accepted before answering");
        return;
      }

      io.to(`user:${details.callerId}`).emit("call:answer", {
        callId,
        receiverId: userId,
        answer,
      });
    } catch (error) {
      console.error("call:answer error:", error);

      emitCallError(
        error instanceof Error ? error.message : "Failed to send call answer",
      );
    }
  });

  // FORWARD ICE CANDIDATE
  socket.on(
    "call:ice-candidate",
    async ({ callId, targetUserId, candidate }) => {
      try {
        if (!callId || !targetUserId || !candidate) {
          emitCallError("Call ID, target user ID and candidate are required");
          return;
        }

        const details = await getCallDetails(callId);

        if (!details) {
          emitCallError("Call not found");
          return;
        }

        if (!isActiveCallStatus(details.status)) {
          emitCallError("This call is no longer active");
          return;
        }

        const otherParticipantId =
          details.callerId === userId
            ? details.receiverId
            : details.receiverId === userId
              ? details.callerId
              : null;

        if (!otherParticipantId) {
          emitCallError("You are not a participant in this call");
          return;
        }

        if (targetUserId !== otherParticipantId) {
          emitCallError("Invalid ICE candidate recipient");
          return;
        }

        io.to(`user:${otherParticipantId}`).emit("call:ice-candidate", {
          callId,
          senderId: userId,
          candidate,
        });
      } catch (error) {
        console.error("call:ice-candidate error:", error);

        emitCallError(
          error instanceof Error
            ? error.message
            : "Failed to send ICE candidate",
        );
      }
    },
  );

  // ACCEPT CALL
  socket.on("call:accept", async ({ callId, callerId }) => {
    try {
      if (!callId || !callerId) {
        emitCallError("Call ID and caller ID are required");
        return;
      }

      const details = await getCallDetails(callId);

      if (!details) {
        emitCallError("Call not found");
        return;
      }

      if (details.receiverId !== userId || details.callerId !== callerId) {
        emitCallError("You are not authorized to accept this call");
        return;
      }

      if (details.status !== "ringing") {
        emitCallError("This call is no longer ringing");
        return;
      }

      const call = await callService.updateCallStatus(callId, "accepted");

      if (!call) {
        emitCallError("This call can no longer be accepted");
        return;
      }

      const payload = {
        callId,
        callerId: details.callerId,
        receiverId: userId,
      };

      io.to(`user:${details.callerId}`).emit("call:accepted", payload);
      socket.emit("call:accepted", payload);

      console.log(`Call ${callId} accepted by ${userId}`);
    } catch (error) {
      console.error("call:accept error:", error);

      emitCallError(
        error instanceof Error ? error.message : "Failed to accept call",
      );
    }
  });

  // REJECT CALL
  socket.on("call:reject", async ({ callId, callerId }) => {
    try {
      if (!callId || !callerId) {
        emitCallError("Call ID and caller ID are required");
        return;
      }

      const details = await getCallDetails(callId);

      if (!details) {
        emitCallError("Call not found");
        return;
      }

      if (details.receiverId !== userId || details.callerId !== callerId) {
        emitCallError("You are not authorized to reject this call");
        return;
      }

      if (details.status !== "ringing") {
        emitCallError("Only a ringing call can be rejected");
        return;
      }

      const call = await callService.updateCallStatus(callId, "rejected");

      if (!call) {
        emitCallError("This call can no longer be rejected");
        return;
      }

      await createCallHistoryMessage({
        callId,
        callerId: details.callerId,
        receiverId: details.receiverId,
        type: details.type,
        status: "rejected",
        duration: 0,
      });

      const payload = {
        callId,
        callerId: details.callerId,
        receiverId: userId,
      };

      io.to(`user:${details.callerId}`).emit("call:rejected", payload);
      socket.emit("call:rejected", payload);

      console.log(`Call ${callId} rejected by ${userId}`);
    } catch (error) {
      console.error("call:reject error:", error);

      emitCallError(
        error instanceof Error ? error.message : "Failed to reject call",
      );
    }
  });

  // CANCEL OUTGOING CALL
  socket.on("call:cancel", async ({ callId, receiverId }) => {
    try {
      if (!callId || !receiverId) {
        emitCallError("Call ID and receiver ID are required");
        return;
      }

      const details = await getCallDetails(callId);

      if (!details) {
        emitCallError("Call not found");
        return;
      }

      if (details.callerId !== userId || details.receiverId !== receiverId) {
        emitCallError("You are not authorized to cancel this call");
        return;
      }

      if (details.status !== "ringing") {
        emitCallError("Only a ringing call can be cancelled");
        return;
      }

      const call = await callService.updateCallStatus(callId, "cancelled");

      if (!call) {
        emitCallError("This call can no longer be cancelled");
        return;
      }

      await createCallHistoryMessage({
        callId,
        callerId: details.callerId,
        receiverId: details.receiverId,
        type: details.type,
        status: "cancelled",
        duration: 0,
      });

      const payload = {
        callId,
        callerId: userId,
        receiverId: details.receiverId,
      };

      io.to(`user:${details.receiverId}`).emit("call:cancelled", payload);
      socket.emit("call:cancelled", payload);

      console.log(`Call ${callId} cancelled by ${userId}`);
    } catch (error) {
      console.error("call:cancel error:", error);

      emitCallError(
        error instanceof Error ? error.message : "Failed to cancel call",
      );
    }
  });

  // END CALL
  socket.on("call:end", async ({ callId, targetUserId }) => {
    try {
      if (!callId || !targetUserId) {
        emitCallError("Call ID and target user ID are required");
        return;
      }

      const details = await getCallDetails(callId);

      if (!details) {
        emitCallError("Call not found");
        return;
      }

      const otherParticipantId =
        details.callerId === userId
          ? details.receiverId
          : details.receiverId === userId
            ? details.callerId
            : null;

      if (!otherParticipantId) {
        emitCallError("You are not a participant in this call");
        return;
      }

      if (targetUserId !== otherParticipantId) {
        emitCallError("Invalid call recipient");
        return;
      }

      if (!isActiveCallStatus(details.status)) {
        emitCallError("This call has already ended");
        return;
      }

      const call = await callService.completeCall(callId, userId);

      if (!call) {
        emitCallError("This call has already ended");
        return;
      }

      await createCallHistoryMessage({
        callId,
        callerId: details.callerId,
        receiverId: details.receiverId,
        type: details.type,
        status: "completed",
        duration: call.duration ?? 0,
      });

      const payload = {
        callId,
        callerId: details.callerId,
        receiverId: details.receiverId,
        endedBy: userId,
        duration: call.duration ?? 0,
      };

      io.to(`user:${otherParticipantId}`).emit("call:ended", payload);
      socket.emit("call:ended", payload);

      console.log(`Call ${callId} ended by ${userId}`);
    } catch (error) {
      console.error("call:end error:", error);

      emitCallError(
        error instanceof Error ? error.message : "Failed to end call",
      );
    }
  });

  // ==========================================================
  // DISCONNECT
  // ==========================================================

  socket.on("disconnect", (reason) => {
    console.log(
      `Socket disconnected: ${socket.id}`,
      `userId: ${userId}`,
      `reason: ${reason}`,
    );

    setUserOffline(userId).catch((error) => {
      console.error("Failed to set user offline:", error);
    });
  });
};
