// config/loadEnv.js
const dotenv = require("dotenv");
const path = require("path");

const envFile =
  process.env.NODE_ENV === "production"
    ? ".env.production"
    : ".env.development";

// process.cwd() points to the root directory where you launched Node
dotenv.config({ path: path.join(process.cwd(), envFile) });
