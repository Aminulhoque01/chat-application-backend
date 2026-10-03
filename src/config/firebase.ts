import {
  cert,
  getApps,
  initializeApp,
} from "firebase-admin/app";

import { getMessaging } from "firebase-admin/messaging";

const privateKey =
  process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

if (
  !process.env.FIREBASE_PROJECT_ID ||
  !process.env.FIREBASE_CLIENT_EMAIL ||
  !privateKey
) {
  throw new Error(
    "Firebase environment variables are not configured",
  );
}

const firebaseApp =
  getApps().length === 0
    ? initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey,
        }),
      })
    : getApps()[0];

export const firebaseMessaging =
  getMessaging(firebaseApp);