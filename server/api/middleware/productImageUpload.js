const fs = require("fs");
const path = require("path");
const multer = require("multer");

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const uploadsDir = path.resolve(__dirname, "../../uploads/products");

function ensureUploadsDir() {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    ensureUploadsDir();
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const extension = path.extname(file.originalname || "").toLowerCase() || ".jpg";
    const safeExt = extension.replace(/[^a-z0-9.]/gi, "") || ".jpg";
    const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${safeExt}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
  },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      return cb(new Error("Only image files are allowed (jpeg, png, webp, gif)"));
    }
    return cb(null, true);
  },
});

const productImageUpload = upload.single("image");

function withProductImageUpload(req, res, next) {
  productImageUpload(req, res, (error) => {
    if (!error) {
      return next();
    }

    if (error instanceof multer.MulterError) {
      if (error.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ message: "Image must be 5MB or smaller" });
      }
      return res.status(400).json({ message: "Invalid image upload request" });
    }

    return res.status(400).json({ message: error.message || "Image upload failed" });
  });
}

module.exports = {
  withProductImageUpload,
};
