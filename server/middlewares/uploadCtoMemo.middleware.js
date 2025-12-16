const multer = require("multer");
const path = require("path");
const fs = require("fs");

const uploadDir = "uploads/cto_memos";

// Ensure upload directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // TEMPORARY filename
    const tempName = `temp_${Date.now()}${path.extname(file.originalname)}`;
    cb(null, tempName);
  },
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype === "application/pdf") {
    cb(null, true);
  } else {
    cb(new Error("Only PDF files are allowed"), false);
  }
};

// Multer instance
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB
  },
});

// Middleware wrapper to handle errors
const uploadCtoMemo = (req, res, next) => {
  const singleUpload = upload.single("memoFile");

  singleUpload(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          message: "Uploaded PDF exceeds the 10MB limit",
        });
      }
      return res.status(400).json({ message: err.message });
    }
    next();
  });
};

module.exports = uploadCtoMemo;
