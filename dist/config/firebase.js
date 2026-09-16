"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.firebaseMessaging = void 0;
const app_1 = require("firebase-admin/app");
const messaging_1 = require("firebase-admin/messaging");
const firebase_service_account_json_1 = __importDefault(require("./firebase-service-account.json"));
const firebaseApp = (0, app_1.getApps)().length === 0
    ? (0, app_1.initializeApp)({
        credential: (0, app_1.cert)({
            projectId: firebase_service_account_json_1.default.project_id,
            clientEmail: firebase_service_account_json_1.default.client_email,
            privateKey: firebase_service_account_json_1.default.private_key,
        }),
    })
    : (0, app_1.getApps)()[0];
exports.firebaseMessaging = (0, messaging_1.getMessaging)(firebaseApp);
