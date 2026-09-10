const path = require("path");
const { createDiskUpload } = require("./createDiskUpload");

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const uploadsDir = path.resolve(__dirname, "../../uploads/products");

const withProductImageUpload = createDiskUpload({
  destinationDir: uploadsDir,
  fieldName: "image",
  maxFileSizeBytes: MAX_FILE_SIZE_BYTES,
  maxFileCount: 1,
  allowedMimeTypes: ALLOWED_MIME_TYPES,
  fallbackExtension: ".jpg",
  invalidTypeMessage: "Only image files are allowed (jpeg, png, webp, gif)",
  tooLargeMessage: "Image must be 5MB or smaller",
  genericErrorMessage: "Invalid image upload request",
});

module.exports = {
  withProductImageUpload,
};
