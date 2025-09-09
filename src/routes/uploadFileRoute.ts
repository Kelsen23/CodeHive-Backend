import express from "express";

import multer from "multer";
import { changeProfilePicture } from "../controllers/uploadFileController.js";

import isAuthenticated, { isTerminated, isVerified } from "../middlewares/authMiddleware.js";

import { uploadProfilePictureLimiterMiddleware } from "../middlewares/rateLimiters/uploadFileLimiters.js";

const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

router
  .route("/profilePicture")
  .post(
    uploadProfilePictureLimiterMiddleware,
    isAuthenticated,
    isVerified,
    isTerminated,
    upload.single("profilePicture"),
    changeProfilePicture,
  );

export default router;
