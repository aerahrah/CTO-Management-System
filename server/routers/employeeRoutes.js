const express = require("express");
const rateLimit = require("express-rate-limit");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// ✅ Imported Role model for the security guard
const Role = require("../models/roleModel");

const router = express.Router();

const {
  createEmployee,
  getEmployees,
  getEmployeeById,
  logoutEmployee,
  signInEmployee,
  updateEmployee,
  getEmployeeCtoMemosById,
  getMyCtoMemos,
  updateRole,
  getMyProfile,
  updateMyProfile,
  resetMyPassword,
  adminResetEmployeePassword,
  getEmployeeWellnessBalanceById,
  getMyWellnessBalance,
  uploadSignature,
} = require("../controllers/employeeController");

// ✅ Imported Salary Grade Controller
const salaryGradeController = require("../controllers/salaryGradeController");

const {
  authenticateToken,
  authorize,
} = require("../middlewares/authMiddleware");

// =============================
// ROLE ESCALATION GUARD
// =============================
const preventRoleEscalation = async (req, res, next) => {
  try {
    const targetRoleId = req.body.role;

    if (!targetRoleId) return next();

    const targetRole = await Role.findById(targetRoleId).lean();
    if (!targetRole) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid role selected." });
    }

    const isTargetAdmin = targetRole.permissions.includes("*");

    if (isTargetAdmin) {
      const requesterRoleId = req.user?.role?._id || req.user?.role;
      if (!requesterRoleId) {
        return res.status(403).json({
          success: false,
          message: "Unauthorized to verify role permissions.",
        });
      }

      const requesterRole = await Role.findById(requesterRoleId).lean();
      const requesterIsAdmin =
        requesterRole && requesterRole.permissions.includes("*");

      if (!requesterIsAdmin) {
        return res.status(403).json({
          success: false,
          message: "Forbidden: Only an Administrator can assign an Admin role.",
        });
      }
    }

    next();
  } catch (error) {
    console.error("[ROLE ESCALATION GUARD] Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error during role validation.",
    });
  }
};

// =============================
// MULTER UPLOAD CONFIGURATION
// =============================
const signatureUploadDir = path.join(process.cwd(), "uploads", "signatures");

if (!fs.existsSync(signatureUploadDir)) {
  fs.mkdirSync(signatureUploadDir, { recursive: true });
}

const allowedMimeTypes = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
};

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, signatureUploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const safeExtension = allowedMimeTypes[file.mimetype] || ".bin";
    cb(null, `${req.user?.id || "unauth"}-${uniqueSuffix}${safeExtension}`);
  },
});

const fileFilter = (req, file, cb) => {
  if (allowedMimeTypes[file.mimetype]) {
    cb(null, true);
  } else {
    cb(new Error("Invalid file type. Only JPEG and PNG are allowed."), false);
  }
};

const upload = multer({
  storage: storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // Strict 2MB limit
  fileFilter: fileFilter,
});

const handleSignatureUpload = (req, res, next) => {
  upload.single("signature")(req, res, function (err) {
    if (err instanceof multer.MulterError) {
      return res
        .status(400)
        .json({ success: false, message: `Upload error: ${err.message}` });
    } else if (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
    next();
  });
};

// =============================
// LOGIN RATE LIMITER
// =============================
const loginLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.body.email.toLowerCase().trim();
  },
  skipSuccessfulRequests: true,
  handler: (req, res) => {
    const retryAfter = Math.ceil((req.rateLimit.resetTime - Date.now()) / 1000);
    const minutes = Math.floor(retryAfter / 60);
    const seconds = retryAfter % 60;

    res.status(429).json({
      message: `Too many login attempts for this account. Try again in ${minutes}m ${seconds}s.`,
      retryAfterSeconds: retryAfter,
    });
  },
});

// =============================
// ADMIN PASSWORD RESET RATE LIMITER
// =============================
// Runs after authentication, so it is keyed per admin account.
const adminResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `admin-reset-${req.user?.id}`,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message:
        "Too many password resets. Please wait a few minutes and try again.",
    });
  },
});

// =============================
// HELPERS
// =============================
const requirePerm = (perm) => [authenticateToken, authorize(perm)];

/* =======================
   PUBLIC ROUTES
   ======================= */

router.post("/login", loginLimiter, signInEmployee);
router.post("/logout", authenticateToken, logoutEmployee);

/* =======================
   SELF-SERVICE ROUTES
   ======================= */

router.get("/my-profile", ...requirePerm("employees.view_self"), getMyProfile);
router.put(
  "/my-profile",
  ...requirePerm("employees.edit_self"),
  updateMyProfile,
);

router.post(
  "/my-profile/signature",
  ...requirePerm("employees.upload_signature"),
  handleSignatureUpload,
  uploadSignature,
);

router.put(
  "/my-profile/reset-password",
  ...requirePerm("employees.reset_password_self"),
  resetMyPassword,
);

router.get("/memos/me", ...requirePerm("cto.view_self"), getMyCtoMemos);

router.get(
  "/my-wellness-balance",
  ...requirePerm("wellness.view_self"),
  getMyWellnessBalance,
);

/* =======================
   ADMIN / HR ROUTES
   ======================= */

router.get("/", ...requirePerm("employees.view"), getEmployees);

router.post(
  "/",
  ...requirePerm("employees.create"),
  preventRoleEscalation,
  createEmployee,
);

// ✅ Reset another employee's password by email (must be above /:id routes)
// Body: { "email": "employee@example.com", "notify": true }
router.post(
  "/reset-password",
  ...requirePerm("employees.reset_password"),
  adminResetLimiter,
  adminResetEmployeePassword,
);

// ==========================================
// SALARY GRADE ROUTES (Must be above /:id)
// ==========================================
router.get(
  "/salary-grades",
  ...requirePerm("salary_grades.view"),
  salaryGradeController.getAllGrades,
);
router.get(
  "/salary-grades/:id",
  ...requirePerm("salary_grades.view"),
  salaryGradeController.getGradeById,
);
router.put(
  "/salary-grades/:id",
  ...requirePerm("salary_grades.manage"),
  salaryGradeController.updateGrade,
);

// ==========================================
// EMPLOYEE ID ROUTES
// ==========================================
router.get("/:id", ...requirePerm("employees.view"), getEmployeeById);

router.put(
  "/:id",
  ...requirePerm("employees.edit"),
  preventRoleEscalation,
  updateEmployee,
);

router.post(
  "/:id/role",
  ...requirePerm("employees.change_role"),
  preventRoleEscalation,
  updateRole,
);

router.get(
  "/memos/:id",
  ...requirePerm("cto.records_view"),
  getEmployeeCtoMemosById,
);
router.get(
  "/:id/wellness-balance",
  ...requirePerm("employees.view"),
  getEmployeeWellnessBalanceById,
);

module.exports = router;
