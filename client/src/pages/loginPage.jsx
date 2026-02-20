import React, { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as Yup from "yup";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Lock, User, Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "react-toastify";

import PhilippinesDotWaveLogo from "./PhilippinesDotWaveLogo";

// Assuming these exist in your project structure
import { loginEmployee } from "../api/employee";
import { useAuth } from "../store/authStore";

// Validation Schema
const schema = Yup.object({
  username: Yup.string()
    .trim()
    .required("Username is required")
    .min(3, "Username must be at least 3 characters"),
  password: Yup.string()
    .trim()
    .required("Password is required")
    .min(4, "Password must be at least 4 characters"),
});

const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);

  const year = useMemo(() => new Date().getFullYear(), []);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: yupResolver(schema),
    mode: "onTouched",
  });

  const { mutate, isPending } = useMutation({
    mutationFn: loginEmployee,
    onSuccess: (data) => {
      login(data);
      toast.dismiss("login-error");
      navigate("/app");
    },
    onError: (err) => {
      toast.error(
        err?.response?.data?.message || "Invalid username or password.",
        {
          toastId: "login-error",
        },
      );
    },
  });

  const onSubmit = (data) => mutate(data);

  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center bg-slate-50 px-4">
      {/* Background: soft blobs + subtle grid */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-40 -left-40 h-[520px] w-[520px] rounded-full bg-blue-700/15 blur-3xl" />
        <div className="absolute -bottom-44 -right-44 h-[620px] w-[620px] rounded-full bg-indigo-700/15 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(37,99,235,0.12),transparent_45%),radial-gradient(circle_at_85%_55%,rgba(29,78,216,0.14),transparent_45%)]" />
        <div className="absolute inset-0 opacity-[0.22] [background-image:linear-gradient(to_right,rgba(15,23,42,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(15,23,42,0.06)_1px,transparent_1px)] [background-size:48px_48px]" />
      </div>

      {/* Animated Philippines dotted SVG (right side) */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-y-0 right-0 w-[120%] md:w-[68%] lg:w-[52%] translate-x-[22%] md:translate-x-[12%] lg:translate-x-[14%]">
          {/* mask layer so it blends nicely */}
          <div className="h-full w-full scale-[1.15] blur-[0.2px]">
            <PhilippinesDotWaveLogo
              className="h-full w-full"
              speed={0.9}
              intensity={0.7}
              breathe={0.15}
            />
          </div>

          {/* subtle fade so dots don’t look “cut off” */}
          <div className="absolute inset-0 bg-gradient-to-l from-slate-50 via-slate-50/40 to-transparent" />
        </div>
      </div>

      {/* Card */}
      <div className="z-10 relative w-full max-w-md overflow-hidden rounded-2xl border border-slate-100 bg-white/85 backdrop-blur-xl shadow-[0_22px_70px_-25px_rgba(2,6,23,0.30)] ring-1 ring-slate-900/5">
        {/* Top shine */}
        <div className="pointer-events-none absolute inset-x-0 -top-24 h-40 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.70),transparent_60%)]" />

        {/* Header */}
        <div className="relative px-8 py-6 flex items-center gap-5 bg-gradient-to-r from-blue-950 via-blue-900 to-blue-800">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_0%,rgba(255,255,255,0.16),transparent_55%)]" />

          <div className="relative bg-white/10 p-2 rounded-full backdrop-blur-sm ring-1 ring-white/15">
            <img
              src="/loginSrc/DICT-Logo.png"
              alt="DICT Logo"
              className="h-12 w-12 object-contain rounded-full"
              draggable="false"
            />
          </div>

          <div className="relative">
            <h1 className="text-white text-xl font-bold tracking-tight">
              Employee CTO Portal
            </h1>
            <p className="text-blue-100/90 text-xs font-light mt-0.5 leading-snug">
              Department of Information and Communications Technology
            </p>
          </div>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="px-8 py-8 flex flex-col gap-5"
        >
          {/* Username */}
          <div>
            <label
              htmlFor="username"
              className="block text-sm font-semibold text-slate-700 mb-1.5"
            >
              Username
            </label>

            <div className="relative group">
              <User
                className={`absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 transition-colors duration-200
                ${errors.username ? "text-red-500" : "text-slate-400 group-focus-within:text-blue-600"}`}
              />

              <input
                id="username"
                type="text"
                autoFocus
                disabled={isPending}
                placeholder="Enter your username"
                {...register("username")}
                aria-invalid={!!errors.username}
                aria-describedby={
                  errors.username ? "username-error" : undefined
                }
                className={`w-full pl-10 pr-4 py-2.5 rounded-xl text-sm border bg-slate-50 transition-all duration-200
                  ${
                    errors.username
                      ? "border-red-300 bg-red-50 focus:border-red-500 focus:ring-4 focus:ring-red-500/10"
                      : "border-slate-200 focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-600/10"
                  }
                  disabled:opacity-70 disabled:cursor-not-allowed outline-none`}
              />
            </div>

            <div className="min-h-[20px] mt-1">
              {errors.username && (
                <p
                  id="username-error"
                  className="text-xs font-medium text-red-600 animate-in fade-in slide-in-from-top-1 duration-200"
                >
                  {errors.username.message}
                </p>
              )}
            </div>
          </div>

          {/* Password */}
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-semibold text-slate-700 mb-1.5"
            >
              Password
            </label>

            <div className="relative group">
              <Lock
                className={`absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 transition-colors duration-200
                ${errors.password ? "text-red-500" : "text-slate-400 group-focus-within:text-blue-600"}`}
              />

              <input
                id="password"
                type={showPassword ? "text" : "password"}
                disabled={isPending}
                placeholder="Enter your password"
                {...register("password")}
                aria-invalid={!!errors.password}
                aria-describedby={
                  errors.password ? "password-error" : undefined
                }
                className={`w-full pl-10 pr-10 py-2.5 rounded-xl text-sm border bg-slate-50 transition-all duration-200
                  ${
                    errors.password
                      ? "border-red-300 bg-red-50 focus:border-red-500 focus:ring-4 focus:ring-red-500/10"
                      : "border-slate-200 focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-600/10"
                  }
                  disabled:opacity-70 disabled:cursor-not-allowed outline-none`}
              />

              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                disabled={isPending}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:text-blue-600 focus:outline-none transition-colors disabled:opacity-50"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>

            <div className="min-h-[20px] mt-1">
              {errors.password && (
                <p
                  id="password-error"
                  className="text-xs font-medium text-red-600 animate-in fade-in slide-in-from-top-1 duration-200"
                >
                  {errors.password.message}
                </p>
              )}
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isPending}
            className={`mt-2 w-full py-2.5 px-4 rounded-xl text-sm font-semibold text-white shadow-md flex items-center justify-center gap-2 transition-all duration-200
              ${
                isPending
                  ? "bg-blue-800/80 cursor-wait"
                  : "bg-gradient-to-r from-blue-700 via-blue-700 to-blue-800 hover:from-blue-800 hover:via-blue-800 hover:to-blue-900 hover:shadow-lg active:scale-[0.99] focus:ring-4 focus:ring-blue-700/20"
              }`}
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Signing In...</span>
              </>
            ) : (
              "Sign In"
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="bg-slate-50/80 border-t border-slate-100 p-4 text-center">
          <p className="text-[11px] text-slate-500 font-medium">
            © {year} Department of Information and Communications Technology
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
