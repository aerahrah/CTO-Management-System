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
   RATE LIMITER
====================================================== */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,

  standardHeaders: true,
  legacyHeaders: false,

  message: {
    message:
      "Too many requests from this IP, please try again after 15 minutes",
  },
});

// Apply only to API routes
app.use("/api/", apiLimiter);

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

// Email Notification Settings
app.use("/api/email-notification-settings", emailNotificationSettingRoutes);

// Flexible Approval Routes
app.use("/api/approval-routes", approvalRouteRoutes);

// Roles
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
