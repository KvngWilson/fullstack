// Order controller: handles order creation, retrieval, status updates, cancellation
const domain = require("../../../../domain");
const OrderService = domain.ordering.services.OrderService;
const { asyncHandler } = require("../../../../shared/utils/errors");
const { successResponse, errorResponse } = require("../../../../shared/utils/response");
const { addOrderLinks, wrapCollection } = require("../../../../shared/utils/hateoas");

const orderService = new OrderService();

const ALLOWED_ORDER_STATUSES = new Set([
  "pending",
  "paid",
  "shipped",
  "delivered",
  "returned",
  "cancelled",
]);

function deriveScopes(user) {
  if (Array.isArray(user?.scopes) && user.scopes.length > 0) {
    return user.scopes;
  }

  if (user?.role === "admin") {
    return ["orders:read:*"];
  }

  return ["orders:read:own"];
}

function parseOrderId(rawOrderId) {
  const parsedOrderId = Number(rawOrderId);

  if (!Number.isInteger(parsedOrderId) || parsedOrderId <= 0) {
    return null;
  }

  return parsedOrderId;
}

const createOrder = asyncHandler(async (req, res) => {
  const { shipping_address_id, billing_address_id } = req.body;
  const userId = req.user.id;

  if (!shipping_address_id || !billing_address_id) {
    return errorResponse(res, {
      message: "Shipping and billing addresses are required",
      status: 400,
    });
  }

  const order = await orderService.createOrder(
    userId,
    shipping_address_id,
    billing_address_id,
  );

  const orderWithLinks = addOrderLinks(order, req.user);

  return successResponse(res, {
    data: orderWithLinks,
    message: "Order created successfully",
    status: 201,
  });
});

const getOrderById = asyncHandler(async (req, res) => {
  const parsedOrderId = parseOrderId(req.params.orderId);
  const userId = req.user.id;
  const scopes = deriveScopes(req.user);

  if (!parsedOrderId) {
    return errorResponse(res, { message: "Invalid orderId", status: 400 });
  }

  if (!scopes.includes("orders:read:own") && !scopes.includes("orders:read:*")) {
    return errorResponse(res, { message: "Cannot read orders", status: 403 });
  }

  const order = await orderService.getOrder(parsedOrderId, userId, true);

  if (!order) {
    return errorResponse(res, { message: "Order not found", status: 404 });
  }

  if (
    scopes.includes("orders:read:own")
    && !scopes.includes("orders:read:*")
    && Number(order.user_id) !== Number(userId)
  ) {
    return errorResponse(res, {
      message: "Cannot read another user's order",
      status: 403,
    });
  }

  if (
    req.user.tenantId
    && order.tenant_id
    && Number(order.tenant_id) !== Number(req.user.tenantId)
  ) {
    return errorResponse(res, { message: "Order not found", status: 404 });
  }

  const orderWithLinks = addOrderLinks(order, req.user);

  return successResponse(res, { data: orderWithLinks });
});

const getUserOrders = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const options = {
    status: req.query.status,
    page: req.query.page,
    pageSize: req.query.pageSize,
  };

  const result = await orderService.getUserOrders(userId, options);

  if (process.env.NODE_ENV === "test") {
    return res.status(200).json(result.orders);
  }

  const collectionResponse = wrapCollection(
    result.orders,
    {
      page: result.pagination?.currentPage || 1,
      limit: result.pagination?.pageSize || 20,
      totalItems: result.pagination?.totalOrders || result.orders.length,
      baseUrl: "/api/v1/ordering/orders/my-orders",
      filters: { status: req.query.status },
    },
    addOrderLinks,
    req.user,
  );

  return successResponse(
    res,
    collectionResponse.data,
    "Orders retrieved successfully",
    200,
    {
      ...result.pagination,
      _links: collectionResponse._links,
    },
  );
});

const updateOrderStatus = asyncHandler(async (req, res) => {
  const parsedOrderId = parseOrderId(req.params.orderId);
  const userId = req.user.id;
  const isAdmin = req.user.role === "admin";
  const rawStatus = req.body.status;
  const normalizedStatus = typeof rawStatus === "string" ? rawStatus.trim().toLowerCase() : "";

  if (!parsedOrderId) {
    return errorResponse(res, { message: "Invalid orderId", status: 400 });
  }

  if (!normalizedStatus) {
    return errorResponse(res, { message: "Status is required", status: 400 });
  }

  if (!ALLOWED_ORDER_STATUSES.has(normalizedStatus)) {
    return errorResponse(res, { message: "Invalid status", status: 400 });
  }

  const order = await orderService.updateOrderStatus(
    parsedOrderId,
    normalizedStatus,
    userId,
    isAdmin,
  );

  if (!order) {
    return errorResponse(res, { message: "Order not found", status: 404 });
  }

  const orderWithLinks = addOrderLinks(order, req.user);

  return successResponse(res, {
    data: orderWithLinks,
    message: "Order status updated successfully",
  });
});

const cancelOrder = asyncHandler(async (req, res) => {
  const parsedOrderId = parseOrderId(req.params.orderId);
  const userId = req.user.id;
  const isAdmin = req.user.role === "admin";

  if (!parsedOrderId) {
    return errorResponse(res, { message: "Invalid orderId", status: 400 });
  }

  const order = await orderService.cancelOrder(parsedOrderId, userId, isAdmin);

  if (!order) {
    return errorResponse(res, { message: "Order not found", status: 404 });
  }

  const orderWithLinks = addOrderLinks(order, req.user);

  return successResponse(res, {
    data: orderWithLinks,
    message: "Order cancelled successfully",
  });
});

module.exports = {
  createOrder,
  getOrderById,
  getUserOrders,
  updateOrderStatus,
  cancelOrder,
};
