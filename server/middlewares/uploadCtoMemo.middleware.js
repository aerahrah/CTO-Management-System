// middlewares/uploadCtoMemo.js
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const uploadDir = path.join(process.cwd(), "uploads", "cto_memos");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeExt = ext === ".pdf" ? ".pdf" : ext; // force lower

    const tempName = `temp_${Date.now()}_${Math.round(Math.random() * 1e9)}${safeExt}`;
    cb(null, tempName);
  },
});

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const isPdfMime = file.mimetype === "application/pdf";
  const isPdfExt = ext === ".pdf";

  if (isPdfMime && isPdfExt) return cb(null, true);
  return cb(new Error("Only PDF files are allowed"), false);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

const uploadCtoMemo = (req, res, next) => {
  // ✅ allow preflight
  if (req.method === "OPTIONS") return next();

  upload.single("memoFile")(req, res, (err) => {
    if (!err) return next();

    if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
      return res
        .status(400)
        .json({ message: "Uploaded PDF exceeds the 10MB limit" });
    }
    return res.status(400).json({ message: err.message });
  });
};

module.exports = uploadCtoMemo;
