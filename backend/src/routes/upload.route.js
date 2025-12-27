import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import multer from "multer";
import { fileURLToPath } from "url";

import { protectRoute } from "../middleware/auth.middleware.js";

const router = express.Router();

const MAX_UPLOAD_BYTES = 100 * 1024 * 1024; // 100MB

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// backend/src/routes -> backend/src/uploads/chat
const chatUploadsDir = path.join(__dirname, "..", "uploads", "chat");
try {
  if (!fs.existsSync(chatUploadsDir)) {
    fs.mkdirSync(chatUploadsDir, { recursive: true });
  }
} catch {
  // ignore
}

function maybeDecodeLatin1ToUtf8(name) {
  const s = String(name || "");
  // Heuristic: common UTF-8-as-latin1 mojibake patterns from multipart filenames
  // e.g. "BÃ i BÃ¡o cÃ¡o ..."
  if (!/[ÃÂ]/.test(s)) return s;
  try {
    const converted = Buffer.from(s, "latin1").toString("utf8");
    if (!converted || /\uFFFD/.test(converted)) return s;
    return converted;
  } catch {
    return s;
  }
}

function safeOriginalName(originalName) {
  const decoded = maybeDecodeLatin1ToUtf8(originalName);
  const base = path.basename(String(decoded || "file"));

  // Windows reserved characters + path separators + control chars
  const cleaned = base
    .replace(/[\\/]/g, "_")
    .replace(/[<>:"|?*]/g, "_")
    .replace(/[\x00-\x1F\x7F]/g, "_")
    .trim();

  // Avoid empty names and overly long filenames
  const finalName = cleaned || "file";
  return finalName.length > 180 ? finalName.slice(0, 180) : finalName;
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, chatUploadsDir);
  },
  filename: (req, file, cb) => {
    const original = safeOriginalName(file.originalname);
    const ext = path.extname(original);
    const base = path.basename(original, ext);
    const id = crypto.randomBytes(16).toString("hex");
    const safeBase = base.length > 120 ? base.slice(0, 120) : base;
    cb(null, `${safeBase}-${id}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_UPLOAD_BYTES,
  },
});

router.use(protectRoute);

router.post("/", upload.single("file"), async (req, res) => {
  try {
    const f = req.file;
    if (!f) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const originalName = maybeDecodeLatin1ToUtf8(f.originalname);

    // Public path served by express.static in server.js
    const publicPath = `/uploads/chat/${f.filename}`;
    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const encodedUrl = `${baseUrl}${encodeURI(publicPath)}`;

    return res.status(200).json({
      url: encodedUrl,
      path: publicPath,
      name: originalName,
      size: f.size,
      type: f.mimetype,
    });
  } catch (err) {
    return res.status(500).json({ message: "Failed to upload file" });
  }
});

export default router;
