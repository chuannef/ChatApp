import { io } from "socket.io-client";

let socketInstance = null;

function getSocketServerUrl() {
  const apiUrl =
    import.meta.env.MODE === "development" && import.meta.env.VITE_API_URL === "/api"
      ? undefined
      : import.meta.env.VITE_API_URL;

  // In production the backend is the same origin; axios uses '/api'
  if (!apiUrl && import.meta.env.MODE !== "development") {
    return window.location.origin;
  }

  const effectiveApiUrl = apiUrl || "http://localhost:5001/api";
  if (effectiveApiUrl === "/api") {
    return window.location.origin;
  }

  // Remove trailing '/api' if present
  return effectiveApiUrl.endsWith("/api") ? effectiveApiUrl.slice(0, -4) : effectiveApiUrl;
}

export function getSocket() {
  if (socketInstance) return socketInstance;

  socketInstance = io(getSocketServerUrl(), {
    withCredentials: true,
    autoConnect: false,
    transports: ["websocket", "polling"],
  });

  return socketInstance;
}
