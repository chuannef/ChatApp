import axios from "axios";

const envApiUrl = import.meta.env.VITE_API_URL;

// In dev, the backend is a different origin (localhost:5001).
// If someone sets VITE_API_URL to "/api", requests will go to the Vite dev server
// (localhost:517x) and auth/token calls will fail.
const BASE_URL =
  (import.meta.env.MODE === "development" && envApiUrl === "/api"
    ? "http://localhost:5001/api"
    : envApiUrl) || (import.meta.env.MODE === "development" ? "http://localhost:5001/api" : "/api");

export const axiosInstance = axios.create({
  baseURL: BASE_URL,
  withCredentials: true, // send cookies with the request
});
