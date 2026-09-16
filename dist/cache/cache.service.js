"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.invalidateUserConversationsCache = exports.clearCacheByPattern = exports.deleteManyCache = exports.deleteCache = exports.getCache = exports.setCache = void 0;
const redis_1 = require("../config/redis");
const setCache = async (key, value, ttl = 300) => {
    await redis_1.redisClient.setEx(key, ttl, JSON.stringify(value));
};
exports.setCache = setCache;
const getCache = async (key) => {
    const cachedValue = await redis_1.redisClient.get(key);
    if (!cachedValue) {
        return null;
    }
    return JSON.parse(cachedValue);
};
exports.getCache = getCache;
const deleteCache = async (key) => {
    await redis_1.redisClient.del(key);
};
exports.deleteCache = deleteCache;
const deleteManyCache = async (keys) => {
    if (keys.length === 0) {
        return;
    }
    await redis_1.redisClient.del(keys);
};
exports.deleteManyCache = deleteManyCache;
const clearCacheByPattern = async (pattern) => {
    let cursor = "0";
    const keys = [];
    do {
        const result = await redis_1.redisClient.scan(cursor, {
            MATCH: pattern,
            COUNT: 100,
        });
        cursor = result.cursor;
        keys.push(...result.keys);
    } while (cursor !== "0");
    if (keys.length > 0) {
        await redis_1.redisClient.del(keys);
    }
};
exports.clearCacheByPattern = clearCacheByPattern;
const invalidateUserConversationsCache = async (userIds) => {
    const uniqueUserIds = [
        ...new Set(userIds),
    ];
    const keys = uniqueUserIds.map((userId) => `user:conversations:${userId}`);
    if (keys.length === 0) {
        return;
    }
    await redis_1.redisClient.del(keys);
};
exports.invalidateUserConversationsCache = invalidateUserConversationsCache;
