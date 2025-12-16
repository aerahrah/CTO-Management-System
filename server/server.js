const express = require("express");
const bodyParser = require("body-parser");
const dotenv = require("dotenv");
const connectDB = require("./db/connect");
const employeeRoutes = require("./routers/employeeRoutes");
const ctoSettingRoutes = require("./routers/ctoSettingRoute");
const provincialOfficeRoutes = require("./routers/provincialOfficeRoute");
const ctoRoutes = require("./routers/ctoRoutes");
const cors = require("cors");
const path = require("path");

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(
  "/uploads/cto_memos",
  express.static(path.join(__dirname, "uploads/cto_memos"))
);
app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);

app.use(bodyParser.json());

app.use("/employee", employeeRoutes);
app.use("/cto", ctoRoutes);
app.use("/cto/settings", ctoSettingRoutes);
app.use("/settings/provincial-office", provincialOfficeRoutes);

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`✅ Server running at http://localhost:${PORT}`);
  });
});
