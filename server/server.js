const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const path = require("path");

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

const auditLogger = require("./middlewares/auditLogMiddleware");

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const NODE_ENV = process.env.NODE_ENV || "development";

app.set("trust proxy", 1);

// Parsers
app.use(express.json({ limit: process.env.JSON_LIMIT || "1mb" }));
app.use(express.urlencoded({ extended: true }));

// Static uploads
app.use(
  "/uploads/cto_memos",
  express.static(path.join(process.cwd(), "uploads", "cto_memos")),
);

// ---- CORS ----
const allowedOrigins = (process.env.CORS_ORIGINS || "http://localhost:5173")
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
        exposedHeaders: ["Content-Disposition", "Content-Length"], // ✅ add
      }
    : {
        origin: (origin, cb) => {
          if (!origin) return cb(null, true);
          if (allowedOrigins.includes(origin)) return cb(null, true);
          return cb(new Error(`CORS blocked for origin: ${origin}`), false);
        },
        credentials: true,
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"],
        exposedHeaders: ["Content-Disposition", "Content-Length"], // ✅ add
      };

app.use(cors(corsOptions));
// ✅ Express 5 safe: RegExp catch-all, NOT "*"
app.options(/.*/, cors(corsOptions));

// Health
app.get("/health", (req, res) => res.json({ status: "ok", env: NODE_ENV }));

// Audit (safe, won’t block OPTIONS)
app.use(auditLogger);

// Routes
app.use("/employee", employeeRoutes);
app.use("/cto", ctoRoutes);
app.use("/cto", ctoDashboardRoutes);
app.use("/cto/settings", ctoSettingRoutes);
app.use("/settings/designation", designationRoutes);
app.use("/audit-logs", auditLogRoutes);
app.use("/settings/projects", projectRoutes);
app.use("/settings/mongodb", ctoBackupRoutes);
app.use("/settings/general", generalSettingRoutes);

// 404
app.use((req, res) => res.status(404).json({ message: "Not found" }));

// Error handler
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err?.message || err);
  res.status(err.statusCode || err.status || 500).json({
    message: err.message || "Internal server error",
  });
});

async function start() {
  try {
    await connectDB();
    app.listen(PORT, () =>
      console.log(`✅ Server running on port ${PORT} (${NODE_ENV})`),
    );
  } catch (err) {
    console.error("❌ Failed to start server:", err);
    process.exit(1);
  }
}

start();
