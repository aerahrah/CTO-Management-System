const express = require("express");
const bodyParser = require("body-parser");
const dotenv = require("dotenv");
const connectDB = require("./db/connect");
const employeeRoutes = require("./routers/employeeRoutes");
const ctoSettingRoutes = require("./routers/ctoSettingRoute");
const designationRoutes = require("./routers/designationRoute");
const ctoRoutes = require("./routers/ctoRoutes");
const auditLogRoutes = require("./routers/auditLogRoute");
const ctoDashboardRoutes = require("./routers/ctoDashboardRoute");
const cors = require("cors");
const path = require("path");
const auditLogger = require("./middlewares/auditLogMiddleware");
const projectRoutes = require("./routers/projectRoute");

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(
  "/uploads/cto_memos",
  express.static(path.join(__dirname, "uploads/cto_memos")),
);
app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  }),
);

app.use(bodyParser.json());

// ✅ Apply audit logger to all API routes
app.use(auditLogger);

// Routes
app.use("/employee", employeeRoutes);
app.use("/cto", ctoRoutes);
app.use("/cto", ctoDashboardRoutes);
app.use("/cto/settings", ctoSettingRoutes);
app.use("/settings/designation", designationRoutes);
app.use("/audit-logs", auditLogRoutes);
app.use("/settings/projects", projectRoutes);

// Connect to DB and start server
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`✅ Server running at http://localhost:${PORT}`);
  });
});
