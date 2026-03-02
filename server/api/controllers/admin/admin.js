const adminService = require("../../../services/admin");
const { successResponse, errorResponse } = require("../../../shared/utils/response");
const logger = require("../../../shared/utils/logger");
const {
  buildRedirectUrl,
  renderDashboardView,
  renderUsersView,
  renderOrdersView,
  renderCategoriesView,
  renderTransactionsView,
  renderAddProductView,
  renderAdminRoleView,
  renderAdminViewError,
} = require("../../../views/admin/rendering");
const { ROLE_PERMISSIONS } = require("../../../config/permissions");

const renderDashboard = async (req, res) => {
  try {
    const dashboardData = await adminService.getOverview();
    return renderDashboardView(res, {
      user: req.user,
      dashboardData,
      query: req.query,
    });
  } catch (error) {
    logger.error("Failed to render admin dashboard", { error });
    return renderAdminViewError(res, "Failed to load admin dashboard");
  }
};

async function getDashboardStats(req, res) {
  try {
    const result = await adminService.getOverview();
    return successResponse(res, { data: result });
  } catch (err) {
    return errorResponse(res, { message: err });
  }
}

async function getUsers(req, res) {
  try {
    const result = await adminService.getUsers(req.query);
    return successResponse(res, { data: result.data, meta: result.pagination });
  } catch (err) {
    return errorResponse(res, { message: err });
  }
}

const renderUsers = async (req, res) => {
  try {
    const usersData = await adminService.getUsers(req.query);
    return renderUsersView(res, {
      user: req.user,
      usersData,
      query: req.query,
      originalUrl: req.originalUrl,
    });
  } catch (error) {
    logger.error("Failed to render admin users", { error });
    return renderAdminViewError(res, "Failed to load admin users");
  }
};

const postUserRoleUpdate = async (req, res) => {
  const returnTo = req.body.returnTo;

  try {
    await adminService.updateUserRole(req.params.userId, req.body.role);
    return res.redirect(
      buildRedirectUrl(
        "/users",
        returnTo,
        "success",
        "User role updated successfully",
      ),
    );
  } catch (error) {
    logger.error("Failed to update user role from SSR", { error });
    return res.redirect(
      buildRedirectUrl(
        "/users",
        returnTo,
        "error",
        error.message || "Failed to update user role",
      ),
    );
  }
};

async function updateUserRole(req, res) {
  try {
    const result = await adminService.updateUserRole(
      req.params.id,
      req.body.role,
    );
    return successResponse(res, {
      data: result,
      message: "User role updated successfully",
    });
  } catch (err) {
    return errorResponse(res, { message: err });
  }
}

async function deleteUser(req, res) {
  try {
    const result = await adminService.deleteUser(req.params.id, req.user?.id);
    return successResponse(res, {
      data: result,
      message: "User deleted successfully",
    });
  } catch (err) {
    return errorResponse(res, { message: err });
  }
}

const postUserDelete = async (req, res) => {
  const returnTo = req.body.returnTo;

  try {
    await adminService.deleteUser(req.params.userId, req.user?.id);
    return res.redirect(
      buildRedirectUrl(
        "/users",
        returnTo,
        "success",
        "User deleted successfully",
      ),
    );
  } catch (error) {
    logger.error("Failed to delete user from SSR", { error });
    return res.redirect(
      buildRedirectUrl(
        "/users",
        returnTo,
        "error",
        error.message || "Failed to delete user",
      ),
    );
  }
};

async function getOrders(req, res) {
  try {
    const result = await adminService.getOrders(req.query);
    return successResponse(res, { data: result.data, meta: result.pagination });
  } catch (err) {
    return errorResponse(res, { message: err });
  }
}

async function updateOrderStatus(req, res) {
  try {
    const result = await adminService.updateOrderStatus(
      req.params.id,
      req.body.status,
    );
    return successResponse(res, {
      data: result,
      message: "Order status updated successfully",
    });
  } catch (err) {
    return errorResponse(res, { message: err });
  }
}

const postOrderStatusUpdate = async (req, res) => {
  const returnTo = req.body.returnTo;

  try {
    await adminService.updateOrderStatus(req.params.orderId, req.body.status);
    return res.redirect(
      buildRedirectUrl(
        "/orders",
        returnTo,
        "success",
        "Order status updated successfully",
      ),
    );
  } catch (error) {
    logger.error("Failed to update order status from SSR", { error });
    return res.redirect(
      buildRedirectUrl(
        "/orders",
        returnTo,
        "error",
        error.message || "Failed to update order status",
      ),
    );
  }
};

const renderOrders = async (req, res) => {
  try {
    const ordersData = await adminService.getOrders(req.query);
    return renderOrdersView(res, {
      user: req.user,
      ordersData,
      query: req.query,
      originalUrl: req.originalUrl,
    });
  } catch (error) {
    logger.error("Failed to render admin orders", { error });
    return renderAdminViewError(res, "Failed to load admin orders");
  }
};

const renderCategories = async (req, res) => {
  try {
    const categories = [
      {
        name: "Electronics",
        subtitle: "Smart devices",
        items: 128,
        status: "success",
        statusLabel: "Active",
        createdAt: "Feb 12, 2026",
        icon: "https://images.unsplash.com/flagged/photo-1558509509-d0f8f35bc1de?auto=format&fit=crop&w=64&q=80",
        tint: "#e8f5ee",
      },
      {
        name: "Fashion",
        subtitle: "Seasonal trends",
        items: 86,
        status: "pending",
        statusLabel: "Draft",
        createdAt: "Jan 29, 2026",
        icon: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=64&q=80",
        tint: "#fdf2f8",
      },
      {
        name: "Accessories",
        subtitle: "Daily essentials",
        items: 64,
        status: "success",
        statusLabel: "Active",
        createdAt: "Jan 10, 2026",
        icon: "https://images.unsplash.com/photo-1503602642458-232111445657?auto=format&fit=crop&w=64&q=80",
        tint: "#eff6ff",
      },
      {
        name: "Home & Kitchen",
        subtitle: "Lifestyle",
        items: 42,
        status: "success",
        statusLabel: "Active",
        createdAt: "Dec 28, 2025",
        icon: "https://images.unsplash.com/photo-1501045661006-fcebe0257c3f?auto=format&fit=crop&w=64&q=80",
        tint: "#fef3c7",
      },
    ];

    return renderCategoriesView(res, {
      user: req.user,
      categories,
      summary: { total: categories.length },
    });
  } catch (error) {
    logger.error("Failed to render admin categories", { error });
    return renderAdminViewError(res, "Failed to load categories");
  }
};

const buildPagination = (pagination, originalUrl) => {
  if (!pagination) {
    return { pagination: null, prevHref: "#", nextHref: "#" };
  }

  const totalPages = Math.max(1, Math.ceil(pagination.total / pagination.pageSize));
  const currentPage = pagination.page;
  const hasPrevious = currentPage > 1;
  const hasNext = currentPage < totalPages;
  const base = new URL(originalUrl || "/", "http://localhost");

  const buildUrl = (page) => {
    base.searchParams.set("page", page);
    return `${base.pathname}${base.search}`;
  };

  return {
    pagination: {
      page: currentPage,
      totalPages,
      total: pagination.total,
      hasPrevious,
      hasNext,
      pageSize: pagination.pageSize,
    },
    prevHref: hasPrevious ? buildUrl(currentPage - 1) : "#",
    nextHref: hasNext ? buildUrl(currentPage + 1) : "#",
  };
};

const renderTransactions = async (req, res) => {
  try {
    const ordersData = await adminService.getOrders(req.query);
    const transactions = ordersData.data.map((entry) => ({
      customer: entry.user_email || "Guest",
      avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(entry.user_email || "Guest")}`,
      reference: `#${entry.id}`,
      date: entry.created_at ? new Date(entry.created_at).toLocaleDateString() : "-",
      method: entry.payment_method || "Card",
      amount: Number(entry.total_amount || 0).toFixed(2),
      status: entry.status || "pending",
      statusLabel: entry.status ? entry.status.charAt(0).toUpperCase() + entry.status.slice(1) : "Pending",
    }));

    const totalRevenue = ordersData.data.reduce(
      (sum, entry) => sum + Number(entry.total_amount || 0),
      0,
    );

    const summary = {
      balance: `$${totalRevenue.toFixed(2)}`,
      cards: [
        {
          label: "Total Revenue",
          value: `$${totalRevenue.toFixed(2)}`,
          sub: "Last 30 days",
          icon:
            '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1v22" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7H14a3.5 3.5 0 0 1 0 7H6" /></svg>',
        },
        {
          label: "Completed",
          value: ordersData.data.filter((entry) => entry.status === "paid").length,
          sub: "Paid orders",
          icon:
            '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>',
        },
        {
          label: "Failed",
          value: ordersData.data.filter((entry) => entry.status === "cancelled").length,
          sub: "Cancelled",
          icon:
            '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>',
        },
        {
          label: "Pending",
          value: ordersData.data.filter((entry) => entry.status === "pending").length,
          sub: "Awaiting",
          icon:
            '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>',
        },
      ],
    };

    const { pagination, prevHref, nextHref } = buildPagination(
      ordersData.pagination,
      req.originalUrl,
    );

    return renderTransactionsView(res, {
      user: req.user,
      transactions,
      summary,
      pagination,
      prevHref,
      nextHref,
    });
  } catch (error) {
    logger.error("Failed to render admin transactions", { error });
    return renderAdminViewError(res, "Failed to load transactions");
  }
};

const renderAddProduct = async (req, res) => {
  try {
    const categories = [
      { name: "Electronics" },
      { name: "Fashion" },
      { name: "Accessories" },
      { name: "Home & Kitchen" },
    ];

    return renderAddProductView(res, {
      user: req.user,
      categories,
    });
  } catch (error) {
    logger.error("Failed to render admin add product", { error });
    return renderAdminViewError(res, "Failed to load add product");
  }
};

const renderAdminRole = async (req, res) => {
  try {
    const profile = {
      name: req.user?.email?.split("@")[0] || "Admin User",
      firstName: req.user?.first_name || "Admin",
      lastName: req.user?.last_name || "User",
      email: req.user?.email || "admin@example.com",
      phone: req.user?.phone || "+1 555-0134",
      country: req.user?.country || "United States",
      city: req.user?.city || "New York",
      avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(req.user?.email || "Admin")}`,
    };

    const rolePermissions = ROLE_PERMISSIONS[req.user?.role || "admin"] || [];
    const permissions = rolePermissions.map((perm) => ({
      label: perm.replace(/:/g, " "),
    }));

    return renderAdminRoleView(res, {
      user: req.user,
      profile,
      permissions,
    });
  } catch (error) {
    logger.error("Failed to render admin role", { error });
    return renderAdminViewError(res, "Failed to load admin role");
  }
};

async function getProductStats(req, res) {
  try {
    const overview = await adminService.getOverview();
    return successResponse(res, {
      data: {
        activeProducts: overview.totals?.active_products ?? 0,
      },
    });
  } catch (err) {
    return errorResponse(res, { message: err });
  }
}

module.exports = {
  // API endpoints
  getDashboardStats,
  getUsers,
  updateUserRole,
  deleteUser,
  getOrders,
  updateOrderStatus,
  getProductStats,
  // SSR render functions
  renderDashboard,
  renderUsers,
  renderOrders,
  renderCategories,
  renderTransactions,
  renderAddProduct,
  renderAdminRole,
  // SSR form handlers
  postUserRoleUpdate,
  postUserDelete,
  postOrderStatusUpdate,
};
