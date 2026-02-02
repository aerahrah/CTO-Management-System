import React, { useState } from "react";
import {
  ShieldAlert,
  ArrowLeft,
  Home,
  Lock,
  Copy,
  CheckCircle,
  LogOut,
} from "lucide-react";

const ForbiddenPage = () => {
  const [copied, setCopied] = useState(false);
  const requestId =
    "REQ-" + Math.random().toString(36).substr(2, 9).toUpperCase();

  const handleGoBack = () => window.history.back();

  const handleCopyCode = () => {
    navigator.clipboard.writeText(requestId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative flex flex-col items-center justify-center h-[calc(100vh-3.5rem-1rem)] w-full overflow-hidden bg-slate-50 text-slate-600">
      {/* 1. Background Decoration (Mesh Gradients) */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
        <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-indigo-200 rounded-full blur-3xl opacity-30 animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-red-100 rounded-full blur-3xl opacity-30 animate-pulse delay-1000"></div>
      </div>

      <div className="relative z-10 max-w-2xl w-full px-4 text-center">
        {/* 2. Floating Icon with Glow */}
        <div className="relative inline-block mb-10 group">
          <div className="absolute inset-0 bg-red-500 rounded-full blur-2xl opacity-20 group-hover:opacity-30 transition-opacity duration-500"></div>
          <div className="relative bg-white p-6 rounded-3xl shadow-2xl border border-slate-100 animate-[bounce_3s_infinite]">
            <Lock size={64} className="text-red-500" />
            <div className="absolute -top-3 -right-3 bg-red-100 p-2 rounded-full border-4 border-white">
              <ShieldAlert size={20} className="text-red-600" />
            </div>
          </div>
        </div>

        {/* 3. Typography & Hierarchy */}
        <h1 className="text-8xl font-black text-slate-900 mb-2 tracking-tighter">
          4<span className="text-red-500">0</span>3
        </h1>
        <h2 className="text-2xl md:text-3xl font-bold text-slate-800 mb-4">
          Access Restricted
        </h2>
        <p className="text-slate-500 mb-8 max-w-md mx-auto text-lg leading-relaxed">
          You don't have permission to access this page. This might be because
          you are logged in with an account that lacks the necessary privileges.
        </p>

        {/* 4. Action Grid */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-10">
          <button
            onClick={handleGoBack}
            className="flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-3 bg-white border border-slate-200 text-slate-700 font-medium rounded-xl shadow-sm hover:bg-slate-50 hover:border-slate-300 transition-all hover:-translate-y-0.5"
          >
            <ArrowLeft size={18} />
            Go Back
          </button>

          <button
            onClick={() => (window.location.href = "/")}
            className="flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-3 bg-slate-900 text-white font-medium rounded-xl shadow-lg shadow-slate-200 hover:bg-slate-800 transition-all hover:-translate-y-0.5"
          >
            <Home size={18} />
            Dashboard
          </button>

          {/* New: Switch Account Option */}
          <button
            onClick={() => console.log("Trigger logout logic")}
            className="flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-3 bg-red-50 text-red-600 border border-red-100 font-medium rounded-xl hover:bg-red-100 transition-all hover:-translate-y-0.5"
          >
            <LogOut size={18} />
            Switch Account
          </button>
        </div>

        {/* 5. Support / Error ID Section */}
        <div className="bg-white/60 backdrop-blur-sm border border-slate-200 rounded-lg p-4 inline-flex flex-col sm:flex-row items-center gap-3 text-sm text-slate-500 max-w-full">
          <span>
            Error Code: <strong>403_FORBIDDEN</strong>
          </span>
          <span className="hidden sm:inline w-px h-4 bg-slate-300"></span>
          <div className="flex items-center gap-2">
            <span>
              Request ID:{" "}
              <code className="font-mono text-xs bg-slate-100 px-1 py-0.5 rounded">
                {requestId}
              </code>
            </span>
            <button
              onClick={handleCopyCode}
              className="hover:text-slate-800 transition-colors"
              title="Copy Request ID"
            >
              {copied ? (
                <CheckCircle size={14} className="text-green-500" />
              ) : (
                <Copy size={14} />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForbiddenPage;
