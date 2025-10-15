import React from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as Yup from "yup";
import { useMutation } from "@tanstack/react-query";
import { loginEmployee } from "../api/employee";
import { useAuth } from "../store/authStore";
import { useNavigate } from "react-router-dom";
import { Lock, User } from "lucide-react";

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

  const { mutate, isPending, isError, error } = useMutation({
    mutationFn: loginEmployee,
    onSuccess: (data) => {
      login(data);
      navigate("/dashboard");
    },
  });

  const onSubmit = (data) => mutate(data);

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-200 px-4">
      <div className="w-full max-w-md bg-neutral-50 shadow-md rounded-md border border-neutral-300 p-8">
        {/* Header */}
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold text-neutral-800">
            Employee Management System
          </h1>
          <p className="text-neutral-500 text-sm mt-1">
            Department of Information and Communications Technology
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-1">
          <div className="flex flex-col gap-1 relative pb-5">
            <label
              htmlFor="username"
              className="text-sm font-medium text-neutral-700"
            >
              Username
            </label>
            <div className="relative">
              <User
                className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400"
                strokeWidth={1.5}
              />
              <input
                id="username"
                type="text"
                placeholder="Enter your username"
                disabled={isPending}
                {...register("username")}
                className={`w-full pl-9 pr-3 py-2.5 rounded-sm border ${
                  errors.username ? "border-red-500" : "border-neutral-300"
                } text-neutral-800 placeholder-neutral-400 focus:ring-2 focus:ring-neutral-400 focus:border-neutral-500 disabled:opacity-70 disabled:cursor-not-allowed transition-all`}
              />
            </div>
            {errors.username && (
              <p className="absolute text-red-600 text-xs mt-1 bottom-0 left-0">
                {errors.username.message}
              </p>
            )}
          </div>

          {/* Password */}
          <div className="flex flex-col gap-1 relative pb-5">
            <label
              htmlFor="password"
              className="text-sm font-medium text-neutral-700"
            >
              Password
            </label>
            <div className="relative">
              <Lock
                className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400"
                strokeWidth={1.5}
              />
              <input
                id="password"
                type="password"
                placeholder="Enter your password"
                disabled={isPending}
                {...register("password")}
                className={`w-full pl-9 pr-3 py-2.5 rounded-sm border ${
                  errors.password ? "border-red-500" : "border-neutral-300"
                } text-neutral-800 placeholder-neutral-400 focus:ring-2 focus:ring-neutral-400 focus:border-neutral-500 disabled:opacity-70 disabled:cursor-not-allowed transition-all`}
              />
            </div>
            {errors.password && (
              <p className="absolute text-red-600 text-xs mt-1 bottom-0 left-0">
                {errors.password.message}
              </p>
            )}
          </div>

          {/* Error Feedback from API */}
          {isError && (
            <p className="text-red-600 text-sm text-center">
              {error?.response?.data?.message ||
                "Invalid username or password."}
            </p>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isPending}
            className={`w-full mt-4 py-2.5 rounded-sm font-medium text-neutral-50 transition-all shadow-sm
              ${
                isPending
                  ? "bg-neutral-500 cursor-not-allowed"
                  : "bg-neutral-700 hover:bg-neutral-800 active:scale-[0.98]"
              }`}
          >
            {isPending ? "Logging in..." : "Login"}
          </button>
        </form>

        {/* Footer */}
        <p className="text-xs text-neutral-500 text-center mt-6">
          © {new Date().getFullYear()} Department of Information and
          Communications Technology
        </p>
      </div>
    </div>
  );
};

export default Login;
