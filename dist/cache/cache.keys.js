"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cacheKeys = void 0;
exports.cacheKeys = {
    userProfile: (userId) => `user:profile:${userId}`,
    userSearch: (query) => `user:search:${query.toLowerCase()}`,
    userConversations: (userId) => `user:conversations:${userId}`,
    conversation: (conversationId) => `conversation:${conversationId}`,
};
