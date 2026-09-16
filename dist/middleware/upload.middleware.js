"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadAvatar = void 0;
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const storage = multer_1.default.memoryStorage();
const allowedExtensions = [
    ".jpg",
    ".jpeg",
    ".jfif",
    ".png",
    ".webp",
    ".gif",
    ".bmp",
    ".tif",
    ".tiff",
    ".avif",
    ".heic",
    ".heif",
];
exports.uploadAvatar = (0, multer_1.default)({
    storage,
    limits: {
        fileSize: 5 * 1024 * 1024,
    },
    fileFilter: (req, file, callback) => {
        console.log("Uploaded file:", {
            originalname: file.originalname,
            mimetype: file.mimetype,
        });
        const extension = path_1.default
            .extname(file.originalname)
            .toLowerCase();
        const isImageMime = file.mimetype.startsWith("image/");
        const isImageExtension = allowedExtensions.includes(extension);
        if (isImageMime ||
            isImageExtension) {
            callback(null, true);
            return;
        }
        callback(new Error("Only image files are allowed"));
    },
});
