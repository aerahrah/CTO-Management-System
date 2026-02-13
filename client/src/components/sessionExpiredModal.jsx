// src/components/session/SessionGuard.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Clock, LogIn } from "lucide-react";
import Modal from "./modal";
import { getJwtExpMs } from "../utils/jwt";
import { useAuth } from "../store/authStore";

export default function SessionGuard() {
  const navigate = useNavigate();
  const token = useAuth((s) => s.token);
  const logout = useAuth((s) => s.logout);

  const [open, setOpen] = useState(false);
  const timerRef = useRef(null);

  const expMs = useMemo(() => {
    if (!token) return null;
    return getJwtExpMs(token); // null if token has no exp
  }, [token]);

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

  useEffect(() => {
    clearTimer();
    setOpen(false);

    if (!token) return;
    if (!expMs) return; // non-expiring token → do nothing

    const msLeft = expMs - Date.now();
    if (msLeft <= 0) {
      setOpen(true);
      return;
    }

    timerRef.current = setTimeout(() => setOpen(true), msLeft);
    return clearTimer;
  }, [token, expMs]);

  useEffect(() => {
    const recheck = () => {
      if (!token || !expMs) return;
      if (Date.now() >= expMs) setOpen(true);
    };

    window.addEventListener("focus", recheck);
    document.addEventListener("visibilitychange", recheck);

    return () => {
      window.removeEventListener("focus", recheck);
      document.removeEventListener("visibilitychange", recheck);
    };
  }, [token, expMs]);

  return (
    <Modal
      isOpen={open}
      onClose={() => {}}
      title={null} // ✅ we'll render a custom minimalist header
      maxWidth="max-w-md"
      showFooter={false} // ✅ custom footer
      closeLabel={null}
      canClose={false}
      preventCloseWhenBusy={true}
    >
      {/* Minimal, premium-style content */}
      <div className="flex flex-col items-center text-center">
        {/* icon */}
        <div className="h-11 w-11 rounded-2xl border border-gray-200 bg-gray-50 flex items-center justify-center">
          <Clock className="h-5 w-5 text-gray-500" />
        </div>

        {/* title */}
        <div className="mt-4 text-lg font-semibold text-gray-900">
          Session expired
        </div>

        {/* description */}
        <p className="mt-1 text-sm text-gray-500 leading-relaxed max-w-sm">
          Your session has ended for security reasons. Please sign in again to
          continue.
        </p>

        {/* subtle divider */}
        <div className="my-5 w-full h-px bg-gray-100" />

        {/* actions */}
        <div className="w-full flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            onClick={relogin}
            className="inline-flex w-full items-center justify-center gap-2 rounded px-4 py-2.5 text-sm font-semibold
                       bg-blue-600 text-white hover:bg-blue-700 transition"
          >
            <LogIn className="h-4 w-4" />
            Login again
          </button>
        </div>
      </div>
    </Modal>
  );
}
