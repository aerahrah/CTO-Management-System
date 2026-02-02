import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as Yup from "yup";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Lock, User, Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "react-toastify";

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

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: yupResolver(schema),
    mode: "onTouched", // Validates fields when the user blurs/leaves the field
  });

  const { mutate, isPending } = useMutation({
    mutationFn: loginEmployee,
    onSuccess: (data) => {
      login(data);
      toast.dismiss("login-error"); // Clear any previous errors
      navigate("/app/cto/dashboard");
    },
    onError: (err) => {
      toast.error(
        err?.response?.data?.message || "Invalid username or password.",
        { toastId: "login-error" },
      );
    },
  });

  const onSubmit = (data) => mutate(data);

  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center bg-slate-50 px-4">
      {/* Background Decorative Map - Improved Responsiveness */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden flex items-center justify-center md:justify-end ">
        <img
          src="/loginSrc/phlogo.png"
          alt="Philippines Map Decoration"
          className="opacity-50 w-[120%] md:w-[60%] lg:w-[45%] max-w-none translate-x-1/4 md:translate-x-10 translate-y-20 md:translate-y-0"
        />
      </div>

      {/* Login Card */}
      <div className="z-10 relative w-full max-w-md bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden ring-1 ring-slate-900/5">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-900 to-blue-800 px-8 py-6 flex items-center gap-5">
          <div className="bg-white/10 p-2 rounded-full backdrop-blur-sm">
            <img
              src="/loginSrc/DICT-Logo.png"
              alt="DICT Logo"
              className="h-12 w-12 object-contain rounded-full"
            />
          </div>
          <div>
            <h1 className="text-white text-xl font-bold tracking-tight">
              Employee Portal
            </h1>
            <p className="text-blue-100 text-xs font-light mt-0.5">
              Dept. of Information and Communications Technology
            </p>
          </div>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="px-8 py-8 flex flex-col gap-5"
        >
          {/* Username Field */}
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
                {...register("username")}
                placeholder="Enter your username"
                className={`w-full pl-10 pr-4 py-2.5 rounded-lg text-sm border bg-slate-50 transition-all duration-200
                  ${
                    errors.username
                      ? "border-red-300 bg-red-50 focus:border-red-500 focus:ring-4 focus:ring-red-500/10"
                      : "border-slate-200 focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-600/10"
                  }
                  disabled:opacity-70 disabled:cursor-not-allowed outline-none`}
              />
            </div>
            {/* Error Message Container (Fixed height to prevent layout shift) */}
            <div className="min-h-[20px] mt-1">
              {errors.username && (
                <p className="text-xs font-medium text-red-600 flex items-center gap-1 animate-in fade-in slide-in-from-top-1 duration-200">
                  {errors.username.message}
                </p>
              )}
            </div>
          </div>

          {/* Password Field */}
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
                {...register("password")}
                placeholder="Enter your password"
                className={`w-full pl-10 pr-10 py-2.5 rounded-lg text-sm border bg-slate-50 transition-all duration-200
                  ${
                    errors.password
                      ? "border-red-300 bg-red-50 focus:border-red-500 focus:ring-4 focus:ring-red-500/10"
                      : "border-slate-200 focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-600/10"
                  }
                  disabled:opacity-70 disabled:cursor-not-allowed outline-none`}
              />

              {/* Show/Hide Password Toggle */}
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                disabled={isPending}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:text-blue-600 focus:outline-none transition-colors"
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
                <p className="text-xs font-medium text-red-600 flex items-center gap-1 animate-in fade-in slide-in-from-top-1 duration-200">
                  {errors.password.message}
                </p>
              )}
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isPending}
            className={`mt-2 w-full py-2.5 px-4 rounded-lg text-sm font-semibold text-white shadow-md flex items-center justify-center gap-2 transition-all duration-200
              ${
                isPending
                  ? "bg-blue-800/80 cursor-wait"
                  : "bg-blue-700 hover:bg-blue-800 hover:shadow-lg active:scale-[0.98] focus:ring-4 focus:ring-blue-700/20"
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
        <div className="bg-slate-50 border-t border-slate-100 p-4 text-center">
          <p className="text-[11px] text-slate-500 font-medium">
            © {new Date().getFullYear()} Department of Information and
            Communications Technology
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
