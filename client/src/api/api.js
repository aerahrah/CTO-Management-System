import axios from "axios";
import { emitSessionExpired } from "./sessionEvents";
import { useAuth } from "../store/authStore";
const API = axios.create({
  baseURL: "http://localhost:3000/api",
});

API.interceptors.request.use((config) => {
  // ✅ pull token directly from zustand store (no hooks here)
  const token = useAuth.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

API.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err?.response?.status;
    if (status === 401 || status === 403) {
      const msg =
        err?.response?.data?.message ||
        "Your session has expired. Please sign in again.";

      emitSessionExpired({ reason: "unauthorized", message: msg });
    }
    return Promise.reject(err);
  },
);

export default API;
