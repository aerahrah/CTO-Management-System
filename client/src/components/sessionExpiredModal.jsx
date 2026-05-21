// src/components/session/SessionGuard.jsx
import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Clock, LogIn } from "lucide-react";
import Modal from "./modal";
import { useAuth } from "../store/authStore";

export default function SessionGuard() {
  const navigate = useNavigate();
  const logout = useAuth((s) => s.logout);
  const sessionExpiresAt = useAuth((s) => s.sessionExpiresAt);

  const [open, setOpen] = useState(false);

  // ✅ 1. Add state to hold the dynamic expiration message
  const [expireMessage, setExpireMessage] = useState(
    "Your session has ended for security reasons. Please sign in again to continue.",
  );

  const timerRef = useRef(null);

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const relogin = () => {
    logout();
    setOpen(false);
    navigate("/", { replace: true });
  };

  // 1. Proactive Timer
  useEffect(() => {
    clearTimer();
    setOpen(false);

    if (!sessionExpiresAt) return;

    const msLeft = sessionExpiresAt - Date.now();
    if (msLeft <= 0) {
      setOpen(true);
      return;
    }

    timerRef.current = setTimeout(() => setOpen(true), msLeft);
    return clearTimer;
  }, [sessionExpiresAt]);

  // ✅ 2. Update to listen for your custom event and grab the message
  useEffect(() => {
    const handleSessionExpired = (event) => {
      // If emitSessionExpired passed a custom message, update the state
      if (event.detail?.message) {
        setExpireMessage(event.detail.message);
      }
      setOpen(true);
    };

    // IMPORTANT: Make sure "onSessionExpired" matches exactly what is
    // being dispatched in your src/api/sessionEvents.js file
    window.addEventListener("onSessionExpired", handleSessionExpired);

    return () =>
      window.removeEventListener("onSessionExpired", handleSessionExpired);
  }, []);

  // 3. Check Expiration on Window Focus / Visibility Change
  useEffect(() => {
    const recheck = () => {
      if (sessionExpiresAt && Date.now() >= sessionExpiresAt) {
        setOpen(true);
      }
    };

    window.addEventListener("focus", recheck);
    document.addEventListener("visibilitychange", recheck);

    return () => {
      window.removeEventListener("focus", recheck);
      document.removeEventListener("visibilitychange", recheck);
    };
  }, [sessionExpiresAt]);

  return (
    <Modal
      isOpen={open}
      onClose={() => {}}
      title={null}
      maxWidth="max-w-md"
      showFooter={false}
      closeLabel={null}
      canClose={false}
      preventCloseWhenBusy={true}
    >
      <div className="flex flex-col items-center text-center">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-gray-200 bg-gray-50">
          <Clock className="h-5 w-5 text-gray-500" />
        </div>

        <div className="mt-4 text-lg font-semibold text-gray-900">
          Session expired
        </div>

        {/* ✅ 3. Render the dynamic message here */}
        <p className="mt-1 max-w-sm text-sm leading-relaxed text-gray-500">
          {expireMessage}
        </p>

        <div className="my-5 h-px w-full bg-gray-100" />

        <div className="flex w-full flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={relogin}
            className="inline-flex w-full items-center justify-center gap-2 rounded bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            <LogIn className="h-4 w-4" />
            Login again
          </button>
        </div>
      </div>
    </Modal>
  );
}
