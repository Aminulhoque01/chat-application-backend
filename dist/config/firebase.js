"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.firebaseMessaging = void 0;
const app_1 = require("firebase-admin/app");
const messaging_1 = require("firebase-admin/messaging");
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
if (!process.env.FIREBASE_PROJECT_ID ||
    !process.env.FIREBASE_CLIENT_EMAIL ||
    !privateKey) {
    throw new Error("Firebase environment variables are not configured");
}
const firebaseApp = (0, app_1.getApps)().length === 0
    ? (0, app_1.initializeApp)({
        credential: (0, app_1.cert)({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey,
        }),
    })
    : (0, app_1.getApps)()[0];
exports.firebaseMessaging = (0, messaging_1.getMessaging)(firebaseApp);
