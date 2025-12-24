import express from "express";
import "dotenv/config";
import cookieParser from "cookie-parser";
import cors from "cors";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";

import authRoutes from "./routes/auth.route.js";
import userRoutes from "./routes/user.route.js";
import chatRoutes from "./routes/chat.route.js";
import groupRoutes from "./routes/group.route.js";
import messageRoutes from "./routes/message.route.js";

import { initSocket } from "./socket.js";

import { connectDB } from "./lib/db.js";

const app = express();
// Use Render's PORT or fallback to 5001 for local dev
const PORT = process.env.PORT || 5001;

// Get __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// CORS configuration
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "https://chatapp-ab.onrender.com",
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (same origin requests, mobile apps, curl, etc.)
      if (!origin) return callback(null, true);

      // Dev convenience: allow any localhost/127.0.0.1 port for Vite
      if (process.env.NODE_ENV !== "production") {
        if (origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:")) {
          return callback(null, true);
        }
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      console.log("CORS blocked origin:", origin);
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true, // allow frontend to send cookies
  })
);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cookieParser());

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/groups", groupRoutes);
app.use("/api/messages", messageRoutes);

// Serve frontend in production
console.log("NODE_ENV:", process.env.NODE_ENV);
console.log("__dirname:", __dirname);

if (process.env.NODE_ENV === "production") {
  // __dirname is /opt/render/project/src/backend/src
  // frontend/dist is at /opt/render/project/src/frontend/dist
  const frontendPath = path.join(__dirname, "../../frontend/dist");
  console.log("Serving frontend from:", frontendPath);
  
  app.use(express.static(frontendPath));

  app.get("*", (req, res) => {
    res.sendFile(path.join(frontendPath, "index.html"));
  });
}

const server = http.createServer(app);
initSocket(server, allowedOrigins);

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  connectDB();
});
