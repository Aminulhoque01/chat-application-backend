"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadMessageFiles = void 0;
const multer_1 = __importDefault(require("multer"));
const storage = multer_1.default.memoryStorage();
const fileFilter = (_req, file, cb) => {
    const allowedMimeTypes = [
        // Images
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif",
        // Videos
        "video/mp4",
        "video/webm",
        "video/quicktime",
        // Audio
        "audio/mpeg",
        "audio/wav",
        "audio/webm",
        "audio/ogg",
        // Documents
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "text/plain",
    ];
    if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
    }
    else {
        cb(new Error("Unsupported file type"));
    }
};
exports.uploadMessageFiles = (0, multer_1.default)({
    storage,
    fileFilter,
    limits: {
        fileSize: 100 * 1024 * 1024,
        files: 10,
    },
});
