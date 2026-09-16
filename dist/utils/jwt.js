"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyToken = exports.generateToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../config/env");
const generateToken = (payload) => {
    return jsonwebtoken_1.default.sign(payload, env_1.env.JWT_SECRET, {
        expiresIn: env_1.env.JWT_EXPIRES_IN || 1,
    });
};
exports.generateToken = generateToken;
const verifyToken = (token) => {
    return jsonwebtoken_1.default.verify(token, env_1.env.JWT_SECRET);
};
exports.verifyToken = verifyToken;
