import React from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as Yup from "yup";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Lock, User } from "lucide-react";
import { toast } from "react-toastify";

import { loginEmployee } from "../api/employee";
import { useAuth } from "../store/authStore";

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
      navigate("/dashboard");
    },
    onError: (err) => {
      toast.error(
        err?.response?.data?.message || "Invalid username or password.",
        { toastId: "login-error" }
      );
    },
  });

  const onSubmit = (data) => mutate(data);

  return (
    <div className="h-screen relative overflow-hidden flex items-center justify-center bg-slate-100 px-4">
      <div className="z-20 relative w-full max-w-md bg-white rounded-lg shadow-md border border-slate-200 overflow-hidden">
        {/* Top Header with Logo */}
        <div className="bg-blue-800 gap-4 px-6 py-4 flex justify-center items-center">
          {/* Logo Placeholder */}
          <img
            src="/loginSrc/DICT-Logo.png" // replace with your logo path
            alt="DICT Logo"
            className="h-12 rounded-full w-auto"
          />
          <div>
            <h1 className="text-white text-lg font-semibold tracking-wide">
              Employee Management System
            </h1>
            <p className="text-blue-100 text-xs mt-1">
              Department of Information and Communications Technology
            </p>
          </div>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="px-8 py-6 flex flex-col gap-4"
        >
          {/* Username */}
          <div>
            <label className="text-sm font-medium text-slate-700">
              Username
            </label>

            <div className="relative mt-1">
              <User
                className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 transition
                  ${errors.username ? "text-red-500" : "text-slate-400"}`}
              />
              <input
                type="text"
                disabled={isPending}
                {...register("username")}
                placeholder="Enter your username"
                className={`w-full pl-9 pr-3 py-2.5 rounded-md text-sm border transition
                  ${
                    errors.username
                      ? "border-red-500 focus:ring-red-200"
                      : "border-slate-300 focus:ring-blue-200"
                  }
                  focus:outline-none focus:ring-2`}
              />
            </div>

            <div className="h-[8px] mt-1">
              <p
                className={`text-xs text-red-600 transition-opacity
                  ${errors.username ? "opacity-100" : "opacity-0"}`}
              >
                {errors.username?.message || "placeholder"}
              </p>
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="text-sm font-medium text-slate-700">
              Password
            </label>

            <div className="relative mt-1">
              <Lock
                className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 transition
                  ${errors.password ? "text-red-500" : "text-slate-400"}`}
              />
              <input
                type="password"
                disabled={isPending}
                {...register("password")}
                placeholder="Enter your password"
                className={`w-full pl-9 pr-3 py-2.5 rounded-md text-sm border transition
                  ${
                    errors.password
                      ? "border-red-500 focus:ring-red-200"
                      : "border-slate-300 focus:ring-blue-200"
                  }
                  focus:outline-none focus:ring-2`}
              />
            </div>

            <div className="h-[16px] mt-1">
              <p
                className={`text-xs text-red-600 transition-opacity
                  ${errors.password ? "opacity-100" : "opacity-0"}`}
              >
                {errors.password?.message || "placeholder"}
              </p>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isPending}
            className={`mt-2 w-full py-2.5 rounded-md text-sm font-medium text-white transition
              ${
                isPending
                  ? "bg-blue-400 cursor-not-allowed"
                  : "bg-blue-700 hover:bg-blue-800 active:scale-[0.99]"
              }`}
          >
            {isPending ? "Signing in..." : "Sign In"}
          </button>
        </form>

        {/* Footer */}
        <div className="bg-slate-50 border-t border-slate-200 text-center py-3 relative">
          <p className="text-xs text-slate-500">
            © {new Date().getFullYear()} Department of Information and
            Communications Technology
          </p>

          {/* Map Placeholder Bottom Left */}
        </div>
      </div>
      <img
        src="/loginSrc/phlogo.png" // replace with your map path
        alt="Philippines Map"
        className="absolute top-80 sm:top-48 md:top-24 right-[-16%] sm:right-[-8%] md:right-12  w-auto "
      />
    </div>
  );
};

export default Login;
