/**
 * Standard API response utilities
 */

const DEFAULT_SUCCESS_STATUS = 200;
const DEFAULT_ERROR_STATUS = 500;

// Build consistent API response structure
function buildResponse({ success, data, message, meta, error, details }) {
  const response = { success };

  if (data !== undefined) response.data = data;
  if (message) response.message = message;
  if (meta) response.meta = meta;
  if (error) response.error = error;
  if (details) response.details = details;

  return response;
}

// Success response
function successResponse(
  res,
  { data, message, status = DEFAULT_SUCCESS_STATUS, meta } = {},
) {
  return res
    .status(status)
    .json(buildResponse({ success: true, data, message, meta }));
}

// Error response
function errorResponse(
  res,
  {
    message = "An error occurred",
    status = DEFAULT_ERROR_STATUS,
    details,
  } = {},
) {
  const normalizedMessage =
    message instanceof Error ? message.message : String(message);

  return res.status(status).json(
    buildResponse({
      success: false,
      error: normalizedMessage,
      message: normalizedMessage,
      details,
    }),
  );
}

// Pagination metadata builder
function buildPagination({ page = 1, pageSize = 20, total = 0 }) {
  const normalizedPage = Math.max(1, parseInt(page, 10) || 1);
  const normalizedSize = Math.max(1, parseInt(pageSize, 10) || 20);
  const normalizedTotal = Math.max(0, parseInt(total, 10) || 0);

  const totalPages =
    normalizedTotal === 0 ? 0 : Math.ceil(normalizedTotal / normalizedSize);

  return {
    page: normalizedPage,
    pageSize: normalizedSize,
    total: normalizedTotal,
    totalPages,
    hasNext: normalizedPage < totalPages,
    hasPrev: normalizedPage > 1,
  };
}

// Paginated response
function paginatedResponse(
  res,
  {
    data,
    page,
    pageSize,
    total,
    message,
    status = DEFAULT_SUCCESS_STATUS,
  } = {},
) {
  const pagination = buildPagination({ page, pageSize, total });

  return res.status(status).json(
    buildResponse({
      success: true,
      data,
      message,
      meta: pagination,
    }),
  );
}

module.exports = {
  successResponse,
  errorResponse,
  paginatedResponse,
  buildPagination,
};
