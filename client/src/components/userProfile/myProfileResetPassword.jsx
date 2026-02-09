import React, { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import Breadcrumbs from "../breadCrumbs";
import {
  Lock,
  ShieldCheck,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  Loader2,
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

/* =========================
   Minimal UI Primitives (match MyProfile style)
========================= */
const Card = ({ title, subtitle, children, className = "" }) => (
  <div
    className={[
      "bg-white rounded-3xl border border-zinc-100 shadow-sm",
      className,
    ].join(" ")}
  >
    {(title || subtitle) && (
      <div className="px-6 pt-6 pb-2">
        {title && (
          <h3 className="text-sm font-medium text-zinc-900 tracking-tight">
            {title}
          </h3>
        )}
        {subtitle && <p className="text-xs text-zinc-500 mt-1">{subtitle}</p>}
      </div>
    )}
    <div className="p-6">{children}</div>
  </div>
);

const Field = ({
  label,
  icon: Icon,
  type,
  placeholder,
  error,
  registerProps,
  showPassword,
  onToggle,
}) => (
  <div className="space-y-1.5">
    <label className="text-xs font-medium text-zinc-600">{label}</label>

    <div className="relative">
      <div className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-zinc-50 border border-zinc-100 flex items-center justify-center text-zinc-500">
        <Icon className="w-4 h-4" strokeWidth={1.8} />
      </div>

      <input
        type={type}
        placeholder={placeholder}
        {...registerProps}
        className={[
          "w-full h-11 pl-12 pr-11",
          "bg-white",
          "border rounded-xl text-sm text-zinc-900",
          "outline-none transition",
          error
            ? "border-rose-300 focus:ring-2 focus:ring-rose-200 focus:border-rose-300"
            : "border-zinc-200 focus:ring-2 focus:ring-blue-200/70 focus:border-blue-300",
        ].join(" ")}
      />

      <button
        type="button"
        onClick={onToggle}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50 border border-transparent hover:border-zinc-200 transition"
        aria-label={showPassword ? "Hide password" : "Show password"}
        title={showPassword ? "Hide password" : "Show password"}
      >
        {showPassword ? (
          <EyeOff className="w-4 h-4" />
        ) : (
          <Eye className="w-4 h-4" />
        )}
      </button>
    </div>

    {error && (
      <p className="text-xs text-rose-600 flex items-center gap-2">
        <AlertCircle className="w-4 h-4" />
        {error}
      </p>
    )}
  </div>
);

const Tip = ({ children, tone = "blue" }) => {
  const tones = {
    blue: "bg-blue-50/50 border-blue-100/50 text-blue-700",
    amber: "bg-amber-50/50 border-amber-100/50 text-amber-800",
  };
  return (
    <div className={`rounded-2xl p-5 border ${tones[tone]}`}>
      <div className="flex gap-3">
        <AlertCircle className="w-5 h-5 shrink-0 opacity-90 mt-0.5" />
        <p className="text-xs leading-relaxed font-semibold">{children}</p>
      </div>
    </div>
  );
};

const GuideItem = ({ children }) => (
  <li className="flex items-start gap-2 text-sm text-blue-100">
    <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
    <span className="leading-snug">{children}</span>
  </li>
);

/* =========================
   Main
========================= */
const ResetPassword = () => {
  const navigate = useNavigate();
  const [showPasswords, setShowPasswords] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: yupResolver(schema),
  });

  const mutation = useMutation({
    mutationFn: resetMyPassword,
    onSuccess: (data) => {
      toast.success(data?.message || "Password updated successfully!", {
        position: "top-right",
        autoClose: 2500,
      });
      navigate("/app/my-profile");
    },
    onError: (err) => {
      toast.error(err?.response?.data?.error || "Failed to reset password", {
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

  const busy = isSubmitting || mutation.isPending;

  return (
    <div className=" px-1 py-2">
      <ToastContainer />

      <div className="">
        {/* Breadcrumbs + Header */}
        <div className="space-y-4">
          <Breadcrumbs rootLabel="Home" rootTo="/app" />

          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 max-w-6xl mx-auto">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-gray-900">
                Reset Password
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Update your password to keep your account secure.
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start max-w-6xl mx-auto ">
          {/* Left: Guide */}
          <div className="lg:col-span-4 lg:sticky lg:top-8 space-y-4">
            <div className="rounded-3xl overflow-hidden shadow-sm border border-zinc-100">
              <div className="p-6 bg-blue-600 text-white">
                <ShieldCheck className="w-8 h-8 text-blue-200" />
                <h3 className="mt-4 text-lg font-semibold">Password Guide</h3>
                <p className="text-sm text-blue-100 mt-1">
                  Simple rules to keep your account safe.
                </p>
              </div>
              <div className="p-6 bg-blue-600">
                <ul className="space-y-3">
                  <GuideItem>Must be at least 8 characters long.</GuideItem>
                  <GuideItem>Include at least one uppercase letter.</GuideItem>
                  <GuideItem>Include at least one lowercase letter.</GuideItem>
                  <GuideItem>Include at least one number.</GuideItem>
                </ul>
              </div>
            </div>

            <Tip tone="amber">
              You may be required to log in again on all devices after changing
              your password.
            </Tip>
          </div>

          {/* Right: Form */}
          <div className="lg:col-span-8">
            <Card
              title="Change Password"
              subtitle="Enter your current password, then choose a new one."
            >
              <form
                id="resetPwForm"
                onSubmit={handleSubmit(onSubmit)}
                className="space-y-5"
                noValidate
              >
                <Field
                  label="Current Password"
                  icon={Lock}
                  type={showPasswords ? "text" : "password"}
                  placeholder="Enter current password"
                  error={errors.oldPassword?.message}
                  registerProps={register("oldPassword")}
                  showPassword={showPasswords}
                  onToggle={() => setShowPasswords((s) => !s)}
                />

                <div className="h-px bg-zinc-100 my-1" />

                <Field
                  label="New Password"
                  icon={Lock}
                  type={showPasswords ? "text" : "password"}
                  placeholder="Minimum 8 characters"
                  error={errors.newPassword?.message}
                  registerProps={register("newPassword")}
                  showPassword={showPasswords}
                  onToggle={() => setShowPasswords((s) => !s)}
                />

                <Field
                  label="Confirm New Password"
                  icon={Lock}
                  type={showPasswords ? "text" : "password"}
                  placeholder="Repeat new password"
                  error={errors.confirmPassword?.message}
                  registerProps={register("confirmPassword")}
                  showPassword={showPasswords}
                  onToggle={() => setShowPasswords((s) => !s)}
                />

                <div className="pt-2 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
                  <button
                    type="button"
                    onClick={() => setShowPasswords((s) => !s)}
                    className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-500 hover:text-zinc-900 transition w-fit"
                  >
                    {showPasswords ? (
                      <>
                        <EyeOff className="w-4 h-4" />
                        Hide passwords
                      </>
                    ) : (
                      <>
                        <Eye className="w-4 h-4" />
                        Show passwords
                      </>
                    )}
                  </button>

                  <button
                    type="submit"
                    disabled={busy}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 shadow-sm hover:shadow-md transition disabled:opacity-50"
                  >
                    {busy ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Updating...
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4" />
                        Reset Password
                      </>
                    )}
                  </button>
                </div>
              </form>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
