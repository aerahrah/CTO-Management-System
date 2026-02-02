import React, { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Lock,
  ShieldCheck,
  ArrowLeft,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { resetMyPassword } from "../../api/employee";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";

/** Yup Schema */
const schema = yup.object().shape({
  oldPassword: yup.string().required("Current password is required"),
  newPassword: yup
    .string()
    .required("New password is required")
    .min(8, "Password must be at least 8 characters")
    .matches(/[A-Z]/, "Password must contain at least one uppercase letter")
    .matches(/[a-z]/, "Password must contain at least one lowercase letter")
    .matches(/[0-9]/, "Password must contain at least one number"),
  confirmPassword: yup
    .string()
    .required("Please confirm your new password")
    .oneOf([yup.ref("newPassword")], "Passwords must match"),
});

const ResetPassword = () => {
  const navigate = useNavigate();
  const [showPasswords, setShowPasswords] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: yupResolver(schema),
  });

  const mutation = useMutation({
    mutationFn: resetMyPassword,
    onSuccess: (data) => {
      toast.success(data.message || "Password updated successfully!", {
        position: "top-right",
        autoClose: 3000,
      });
      navigate("/app/my-profile");
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || "Failed to reset password", {
        position: "top-right",
        autoClose: 3000,
      });
    },
  });

  const onSubmit = (data) => {
    mutation.mutate({
      oldPassword: data.oldPassword,
      newPassword: data.newPassword,
    });
  };

  return (
    <div className="bg-white/70 rounded-xl h-[calc(100vh-3.5rem-1rem)] p-6">
      <ToastContainer />
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center text-sm font-medium text-blue-600 hover:text-blue-700 mb-2 group"
          >
            <ArrowLeft className="w-4 h-4 mr-1 transform group-hover:-translate-x-1 transition-transform" />
            Back to Profile
          </button>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            Reset Password
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Update your password to keep your account secure.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
          {/* Left: Guide */}
          <div className="md:col-span-2 space-y-4">
            <div className="bg-blue-600 rounded-2xl p-6 text-white shadow-lg shadow-blue-100">
              <ShieldCheck className="w-8 h-8 mb-4 text-blue-200" />
              <h3 className="font-bold text-lg mb-2">Password Guide</h3>
              <ul className="text-blue-100 text-sm space-y-3">
                <li className="flex items-start">
                  <CheckCircle2 className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
                  Must be at least 8 characters long.
                </li>
                <li className="flex items-start">
                  <CheckCircle2 className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
                  Include at least one uppercase letter.
                </li>
                <li className="flex items-start">
                  <CheckCircle2 className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
                  Avoid using your name or email.
                </li>
              </ul>
            </div>

            <div className="p-4 rounded-xl bg-amber-50 border border-amber-100 flex items-start">
              <AlertCircle className="w-5 h-5 text-amber-500 mr-3 mt-0.5" />
              <p className="text-xs text-amber-700 leading-relaxed">
                You will be required to log in again on all devices after
                changing your password.
              </p>
            </div>
          </div>

          {/* Right: Form */}
          <div className="md:col-span-3">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <form
                onSubmit={handleSubmit(onSubmit)}
                className="space-y-5"
                noValidate
              >
                {/* Old Password */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase">
                    Current Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type={showPasswords ? "text" : "password"}
                      placeholder="Enter current password"
                      {...register("oldPassword")}
                      className={`w-full pl-10 pr-4 py-2.5 bg-gray-50 border rounded-xl text-sm focus:ring-2 outline-none transition-all ${
                        errors.oldPassword
                          ? "border-red-300 focus:ring-red-500"
                          : "border-gray-200 focus:ring-blue-500"
                      }`}
                    />
                  </div>
                  {errors.oldPassword && (
                    <p className="text-[11px] text-red-500 font-medium">
                      {errors.oldPassword.message}
                    </p>
                  )}
                </div>

                <hr className="border-gray-100" />

                {/* New Password */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase">
                    New Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type={showPasswords ? "text" : "password"}
                      placeholder="Minimum 8 characters"
                      {...register("newPassword")}
                      className={`w-full pl-10 pr-4 py-2.5 bg-gray-50 border rounded-xl text-sm focus:ring-2 outline-none transition-all ${
                        errors.newPassword
                          ? "border-red-300 focus:ring-red-500"
                          : "border-gray-200 focus:ring-blue-500"
                      }`}
                    />
                  </div>
                  {errors.newPassword && (
                    <p className="text-[11px] text-red-500 font-medium">
                      {errors.newPassword.message}
                    </p>
                  )}
                </div>

                {/* Confirm Password */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type={showPasswords ? "text" : "password"}
                      placeholder="Repeat new password"
                      {...register("confirmPassword")}
                      className={`w-full pl-10 pr-4 py-2.5 bg-gray-50 border rounded-xl text-sm focus:ring-2 outline-none transition-all ${
                        errors.confirmPassword
                          ? "border-red-300 focus:ring-red-500"
                          : "border-gray-200 focus:ring-blue-500"
                      }`}
                    />
                  </div>
                  {errors.confirmPassword && (
                    <p className="text-[11px] text-red-500 font-medium">
                      {errors.confirmPassword.message}
                    </p>
                  )}
                </div>

                {/* Visibility Toggle */}
                <button
                  type="button"
                  onClick={() => setShowPasswords(!showPasswords)}
                  className="flex items-center text-xs font-semibold text-slate-500 hover:text-blue-600 transition-colors"
                >
                  {showPasswords ? (
                    <>
                      <EyeOff className="w-3.5 h-3.5 mr-1" /> Hide Passwords
                    </>
                  ) : (
                    <>
                      <Eye className="w-3.5 h-3.5 mr-1" /> Show Passwords
                    </>
                  )}
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting || mutation.isPending}
                  className="w-full py-3 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 disabled:opacity-50 disabled:shadow-none"
                >
                  {mutation.isPending
                    ? "Updating Security..."
                    : "Reset Password"}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
