"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteMultipleMessageAttachments = exports.deleteMessageAttachmentFromCloudinary = exports.uploadMultipleMessageFiles = exports.uploadMessageFileToCloudinary = void 0;
const stream_1 = require("stream");
const cloudinary_1 = require("cloudinary");
const getAttachmentType = (mimeType) => {
    if (mimeType.startsWith("image/")) {
        return "image";
    }
    if (mimeType.startsWith("video/")) {
        return "video";
    }
    if (mimeType.startsWith("audio/")) {
        return "audio";
    }
    return "file";
};
const getCloudinaryResourceType = (type) => {
    if (type === "image") {
        return "image";
    }
    if (type === "video") {
        return "video";
    }
    return "raw";
};
const getFolder = (type) => {
    return `chat-app/messages/${type}s`;
};
const uploadMessageFileToCloudinary = async (file) => {
    const type = getAttachmentType(file.mimetype);
    const resourceType = getCloudinaryResourceType(type);
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary_1.v2.uploader.upload_stream({
            folder: getFolder(type),
            resource_type: resourceType,
            use_filename: true,
            unique_filename: true,
        }, (error, result) => {
            if (error || !result) {
                return reject(error ?? new Error("Cloudinary upload failed"));
            }
            resolve({
                type,
                url: result.secure_url,
                publicId: result.public_id,
                fileName: file.originalname,
                mimeType: file.mimetype,
                size: file.size,
            });
        });
        stream_1.Readable.from(file.buffer).pipe(uploadStream).on("error", reject);
    });
};
exports.uploadMessageFileToCloudinary = uploadMessageFileToCloudinary;
const uploadMultipleMessageFiles = async (files) => {
    return Promise.all(files.map(exports.uploadMessageFileToCloudinary));
};
exports.uploadMultipleMessageFiles = uploadMultipleMessageFiles;
const deleteMessageAttachmentFromCloudinary = async (attachment) => {
    let resourceType;
    if (attachment.type === "image") {
        resourceType = "image";
    }
    else if (attachment.type === "video" || attachment.type === "audio") {
        resourceType = "video";
    }
    else {
        resourceType = "raw";
    }
    try {
        const result = await cloudinary_1.v2.uploader.destroy(attachment.publicId, {
            resource_type: resourceType,
        });
        console.log("Cloudinary delete result:", result);
        return result;
    }
    catch (error) {
        console.error(`Failed to delete Cloudinary file: ${attachment.publicId}`, error);
        throw error;
    }
};
exports.deleteMessageAttachmentFromCloudinary = deleteMessageAttachmentFromCloudinary;
const deleteMultipleMessageAttachments = async (attachments) => {
    if (!attachments.length) {
        return;
    }
    const results = await Promise.allSettled(attachments.map(exports.deleteMessageAttachmentFromCloudinary));
    const failed = results.filter((result) => result.status === "rejected");
    if (failed.length > 0) {
        console.error(`${failed.length} attachment(s) could not be deleted from Cloudinary`);
    }
    return results;
};
exports.deleteMultipleMessageAttachments = deleteMultipleMessageAttachments;
