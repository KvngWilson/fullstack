const fs = require("fs");
const path = require("path");
const multer = require("multer");

function sanitizeExtension(originalName, fallbackExtension = "") {
  const extension = path.extname(originalName || "").toLowerCase();
  const safeExtension = extension.replace(/[^a-z0-9.]/gi, "");

  if (safeExtension) {
    return safeExtension;
  }

  return fallbackExtension;
}

function buildUniqueFilename(originalName, fallbackExtension = "") {
  const extension = sanitizeExtension(originalName, fallbackExtension);
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${extension}`;
}

function ensureUploadsDir(destinationDir) {
  fs.mkdirSync(destinationDir, { recursive: true });
}

function createDiskUpload({
  destinationDir,
  fieldName,
  maxFileSizeBytes,
  maxFileCount = 1,
  allowedMimeTypes,
  fallbackExtension = "",
  invalidTypeMessage = "Unsupported file type",
  tooLargeMessage = "Uploaded file is too large",
  genericErrorMessage = "Upload failed",
}) {
  const normalizedMimeTypes = new Set(allowedMimeTypes);

  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
      ensureUploadsDir(destinationDir);
      cb(null, destinationDir);
    },
    filename: (_req, file, cb) => {
      cb(
        null,
        buildUniqueFilename(file.originalname, fallbackExtension),
      );
    },
  });

  const upload = multer({
    storage,
    limits: {
      fileSize: maxFileSizeBytes,
      files: maxFileCount,
    },
    fileFilter: (_req, file, cb) => {
      if (!normalizedMimeTypes.has(file.mimetype)) {
        return cb(new Error(invalidTypeMessage));
      }

      return cb(null, true);
    },
  });

  const middleware =
    maxFileCount === 1
      ? upload.single(fieldName)
      : upload.array(fieldName, maxFileCount);

  return (req, res, next) => {
    middleware(req, res, (error) => {
      if (!error) {
        return next();
      }

      if (error instanceof multer.MulterError) {
        if (error.code === "LIMIT_FILE_SIZE") {
          return res.status(400).json({ message: tooLargeMessage });
        }

        if (error.code === "LIMIT_FILE_COUNT") {
          return res
            .status(400)
            .json({ message: `You can upload up to ${maxFileCount} file(s) at a time` });
        }

        return res.status(400).json({ message: genericErrorMessage });
      }

      return res.status(400).json({ message: error.message || genericErrorMessage });
    });
  };
}

module.exports = {
  createDiskUpload,
};
