import axios from "axios";
import { toast } from "react-toastify";
import { emitSessionExpired } from "./sessionEvents";

// Create the Axios instance
const API = axios.create({
  baseURL: "http://localhost:3000/api",
  withCredentials: true,
});

// Add the Response Interceptor
API.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err?.response?.status;

    // 1. Handle Auth Errors (Session Expiration)
    if (status === 401 || status === 403) {
      const msg =
        err?.response?.data?.message ||
        "Your session has expired. Please sign in again.";

      emitSessionExpired({ reason: "unauthorized", message: msg });
    }

    // 2. Handle Rate Limit Errors (429 Too Many Requests)
    if (status === 429) {
      // Grab the backend API URL that triggered the error
      const requestUrl = err.config?.url || "";

      // Look specifically for the backend login endpoint
      const isLoginRequest = requestUrl.includes("/employee/login");

      // Only show the global toast if this was NOT a login request
      if (!isLoginRequest) {
        const msg =
          err?.response?.data?.message ||
          "Too many requests. Please wait and try again.";

        // Fire the global toast, using toastId to prevent duplicate spam
        toast.error(msg, {
          toastId: "rate-limit-error",
          position: "top-right",
          autoClose: 5000,
        });
      }
    }

    return Promise.reject(err);
  },
);

export default API;
