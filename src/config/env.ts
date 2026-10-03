import dotenv from "dotenv";
dotenv.config({
  override: false,
});

const getRequiredEnv = (
  key: string
): string => {
  const value = process.env[key];

  if (!value) {
    throw new Error(
      `Missing required environment variable: ${key}`
    );
  }

  return value;
};



export const env = {
  NODE_ENV:
    process.env.NODE_ENV ?? "development",

  PORT: Number(
    process.env.PORT ?? 5000
  ),

  MONGO_URI:
    getRequiredEnv("MONGO_URI"),

  REDIS_URL:
    getRequiredEnv("REDIS_URL"),

  JWT_SECRET:
    getRequiredEnv("JWT_SECRET"),

  JWT_EXPIRES_IN:
    process.env.JWT_EXPIRES_IN ?? "7d",

  CLIENT_URL:
    process.env.CLIENT_URL ??
    "http://localhost:3000",

  // Cloudinary
  CLOUDINARY_CLOUD_NAME:
    getRequiredEnv(
      "CLOUDINARY_CLOUD_NAME"
    ),

  CLOUDINARY_API_KEY:
    getRequiredEnv(
      "CLOUDINARY_API_KEY"
    ),

  CLOUDINARY_API_SECRET:
    getRequiredEnv(
      "CLOUDINARY_API_SECRET"
    ),

  // Firebase
  FIREBASE_PROJECT_ID:
    getRequiredEnv(
      "FIREBASE_PROJECT_ID"
    ),

  FIREBASE_CLIENT_EMAIL:
    getRequiredEnv(
      "FIREBASE_CLIENT_EMAIL"
    ),

  FIREBASE_PRIVATE_KEY:
    getRequiredEnv(
      "FIREBASE_PRIVATE_KEY"
    ),
};