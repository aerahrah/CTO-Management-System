// server.js (or app.js)

const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const path = require("path");
const cookieParser = require("cookie-parser");

// ✅ Security imports
const helmet = require("helmet");
const mongoSanitize = require("express-mongo-sanitize");
const rateLimit = require("express-rate-limit");
const morgan = require("morgan");

const connectDB = require("./db/connect");

const employeeRoutes = require("./routers/employeeRoutes");
const ctoSettingRoutes = require("./routers/ctoSettingRoute");
const designationRoutes = require("./routers/designationRoute");
const ctoRoutes = require("./routers/ctoRoutes");
const auditLogRoutes = require("./routers/auditLogRoute");
const ctoDashboardRoutes = require("./routers/ctoDashboardRoute");
const projectRoutes = require("./routers/projectRoute");
const ctoBackupRoutes = require("./routers/ctoBackupRoute.js");
const generalSettingRoutes = require("./routers/generalSettingsRoute");
const userPreferenceRoutes = require("./routers/userPreferencesRoutes");
const notificationRoutes = require("./routers/notificationRoutes");

// Email notification settings routes
const emailNotificationSettingRoutes = require("./routers/emailNotificationSettingsRoutes");

// Approval routes
const approvalRouteRoutes = require("./routers/approvalRouteRoute");

// Role routes
const roleRoutes = require("./routers/roleRoutes");

// Wellness routes
const wellnessRoutes = require("./routers/wellnessRoutes");

const auditLogger = require("./middlewares/auditLogMiddleware");
const initWellnessCron = require("./cron/wellnessCron");

dotenv.config();

const app = express();

const PORT = Number(process.env.PORT) || 3000;
const NODE_ENV = process.env.NODE_ENV || "development";

// ✅ Important for proxies/load balancers
app.set("trust proxy", 1);

/* ======================================================
   SECURITY HEADERS
====================================================== */
app.use(
  helmet({
    crossOriginResourcePolicy: {
      policy: "cross-origin",
    },
  }),
);

/* ======================================================
   BODY PARSERS
====================================================== */
app.use(express.json({ limit: process.env.JSON_LIMIT || "1mb" }));

app.use(
  express.urlencoded({
    extended: true,
  }),
);

app.use(cookieParser());

/* ======================================================
   EXPRESS 5 FIX FOR express-mongo-sanitize
====================================================== */
app.use((req, res, next) => {
  Object.defineProperty(req, "query", {
    value: { ...req.query },
    writable: true,
    configurable: true,
    enumerable: true,
  });

  next();
});

/* ======================================================
   NOSQL INJECTION PROTECTION
====================================================== */
app.use(mongoSanitize());

/* ======================================================
   STATIC FILES
====================================================== */
app.use(
  "/uploads/cto_memos",
  express.static(path.join(process.cwd(), "uploads", "cto_memos")),
);

/* ======================================================
   CORS
====================================================== */
const allowedOrigins = "http://localhost:5173"
  .split(",")
  .map((o) => o.trim().replace(/^"(.+)"$/, "$1"))
  .filter(Boolean);

const corsOptions =
  NODE_ENV !== "production"
    ? {
        origin: true,
        credentials: true,
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"],
        exposedHeaders: ["Content-Disposition", "Content-Length"],
      }
    : {
        origin: (origin, cb) => {
          if (!origin) return cb(null, true);

          if (allowedOrigins.includes(origin)) {
            return cb(null, true);
          }

          return cb(new Error(`CORS blocked for origin: ${origin}`), false);
        },

        credentials: true,
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"],
        exposedHeaders: ["Content-Disposition", "Content-Length"],
      };

app.use(cors(corsOptions));

// ✅ Express 5 safe wildcard
app.options(/.*/, cors(corsOptions));

/* ======================================================
   REQUEST LOGGER (MORGAN)
====================================================== */
if (NODE_ENV !== "production") {
  app.use(morgan("dev"));
}

/* ======================================================
   RATE LIMITERS (DYNAMIC)
====================================================== */

// Pull from environment variables, or use your defaults
const RATE_LIMIT_WINDOW_MINS = Number(process.env.RATE_LIMIT_WINDOW_MINS) || 10;
const RATE_LIMIT_WINDOW_MS = RATE_LIMIT_WINDOW_MINS * 60 * 1000;
const GLOBAL_RATE_LIMIT_MAX =
  Number(process.env.GLOBAL_RATE_LIMIT_MAX) || 30000;
const ACCOUNT_RATE_LIMIT_MAX =
  Number(process.env.ACCOUNT_RATE_LIMIT_MAX) || 750;

// ✅ Helper function to calculate exact time remaining
const dynamicRateLimitHandler = (messagePrefix) => (req, res) => {
  // express-rate-limit injects req.rateLimit which contains the resetTime
  const resetTime = req.rateLimit?.resetTime;

  if (!resetTime) {
    return res
      .status(429)
      .json({ message: `${messagePrefix}. Please try again later.` });
  }

  const retryAfter = Math.ceil((resetTime - Date.now()) / 1000);
  const minutes = Math.floor(retryAfter / 60);
  const seconds = retryAfter % 60;

  res.status(429).json({
    message: `${messagePrefix}. Try again in ${minutes}m ${seconds}s.`,
    retryAfterSeconds: retryAfter,
  });
};

// 1. GLOBAL IP LIMITER
const globalIpLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: GLOBAL_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `ip_${req.ip}`,
  skip: (req) => req.path === "/employee/login",
  // ✅ Use the dynamic handler
  handler: dynamicRateLimitHandler("Too many requests from this network"),
});

// 2. INDIVIDUAL ACCOUNT LIMITER
const accountLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: ACCOUNT_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    if (req.path === "/employee/login") return true;
    if (!req.user?.id && !req.cookies?.token) return true;
    return false;
  },
  keyGenerator: (req) => {
    if (req.user && req.user.id) return `user_${req.user.id}`;
    if (req.cookies && req.cookies.token) return `token_${req.cookies.token}`;
  },
  // ✅ Use the dynamic handler
  handler: dynamicRateLimitHandler("Too many requests from this account"),
});

// ✅ Apply both limiters to API routes
app.use("/api/", globalIpLimiter);
app.use("/api/", accountLimiter);

/* ======================================================
   HEALTH CHECK
====================================================== */
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    env: NODE_ENV,
  });
});

/* ======================================================
   AUDIT LOGGER
====================================================== */
app.use(auditLogger);

/* ======================================================
   API ROUTES
====================================================== */
app.use("/api/employee", employeeRoutes);
app.use("/api/cto", ctoRoutes);
app.use("/api/wellness", wellnessRoutes);
app.use("/api/cto", ctoDashboardRoutes);
app.use("/api/cto/settings", ctoSettingRoutes);
app.use("/api/settings/designation", designationRoutes);
app.use("/api/audit-logs", auditLogRoutes);
app.use("/api/settings/projects", projectRoutes);
app.use("/api/settings/mongodb", ctoBackupRoutes);
app.use("/api/settings/general", generalSettingRoutes);
app.use("/api/settings/preferences", userPreferenceRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/email-notification-settings", emailNotificationSettingRoutes);
app.use("/api/approval-routes", approvalRouteRoutes);
app.use("/api/roles", roleRoutes);

/* ======================================================
   404 HANDLER
====================================================== */
app.use((req, res) => {
  res.status(404).json({
    message: "Not found",
  });
});

/* ======================================================
   GLOBAL ERROR HANDLER
====================================================== */
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);

  const statusCode = err.statusCode || err.status || 500;

  res.status(statusCode).json({
    message:
      NODE_ENV === "production"
        ? "Internal server error"
        : err.message || "Internal server error",
  });
});

/* ======================================================
   SERVER START
====================================================== */
async function start() {
  try {
    await connectDB();
    initWellnessCron();

    app.listen(PORT, () => {
      console.log(`✅ Server running on port ${PORT} (${NODE_ENV})`);
    });
  } catch (err) {
    console.error("❌ Failed to start server:", err);
    process.exit(1);
  }
}

start();
