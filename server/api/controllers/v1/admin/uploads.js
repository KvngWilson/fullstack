const { successResponse, errorResponse } = require("../../../../shared/utils/response");
const { logger } = require("../../../../shared/utils/logger");

function classifyAsset(file) {
  if (file.mimetype.startsWith("image/")) {
    return "image";
  }

  return "document";
}

function mapUploadedFile(file) {
  return {
    filename: file.filename,
    originalName: file.originalname,
    mimeType: file.mimetype,
    size: file.size,
    kind: classifyAsset(file),
    url: `/uploads/admin/${file.filename}`,
  };
}

exports.uploadAssets = async (req, res) => {
  try {
    const files = Array.isArray(req.files) ? req.files : [];

    if (!files.length) {
      return errorResponse(res, {
        message: "Select at least one file to upload",
        status: 400,
      });
    }

    const uploadedFiles = files.map(mapUploadedFile);

    logger.info("Admin assets uploaded", {
      userId: req.user?.id,
      fileCount: uploadedFiles.length,
      filenames: uploadedFiles.map((file) => file.filename),
    });

    return successResponse(res, {
      data: uploadedFiles,
      message: "Files uploaded successfully",
      status: 201,
    });
  } catch (error) {
    logger.error("Admin asset upload failed", {
      userId: req.user?.id,
      error: error.message,
    });

    return errorResponse(res, {
      message: "Failed to upload files",
      status: 500,
    });
  }
};
