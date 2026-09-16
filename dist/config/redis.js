"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.disconnectRedis = exports.connectRedis = exports.redisClient = void 0;
const redis_1 = require("redis");
const env_1 = require("./env");
exports.redisClient = (0, redis_1.createClient)({
    url: env_1.env.REDIS_URL,
});
exports.redisClient.on("error", (error) => {
    console.error("Redis Client Error:", error);
});
exports.redisClient.on("connect", () => {
    console.log("Redis connecting...");
});
exports.redisClient.on("ready", () => {
    console.log("Redis ready");
});
exports.redisClient.on("reconnecting", () => {
    console.log("Redis reconnecting...");
});
const connectRedis = async () => {
    if (exports.redisClient.isOpen) {
        return;
    }
    await exports.redisClient.connect();
    console.log("Redis connected");
};
exports.connectRedis = connectRedis;
const disconnectRedis = async () => {
    if (!exports.redisClient.isOpen) {
        return;
    }
    await exports.redisClient.quit();
    console.log("Redis disconnected");
};
exports.disconnectRedis = disconnectRedis;
