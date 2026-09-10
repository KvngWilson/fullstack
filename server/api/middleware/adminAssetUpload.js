const path = require("path");
const { createDiskUpload } = require("./createDiskUpload");

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/csv",
]);
const uploadsDir = path.resolve(__dirname, "../../uploads/admin");

const withAdminAssetUpload = createDiskUpload({
  destinationDir: uploadsDir,
  fieldName: "files",
  maxFileSizeBytes: MAX_FILE_SIZE_BYTES,
  maxFileCount: 10,
  allowedMimeTypes: ALLOWED_MIME_TYPES,
  invalidTypeMessage:
    "Only images, PDFs, Word documents, text files, and CSV files are allowed",
  tooLargeMessage: "Each file must be 10MB or smaller",
  genericErrorMessage: "Invalid admin upload request",
});

module.exports = {
  withAdminAssetUpload,
};
