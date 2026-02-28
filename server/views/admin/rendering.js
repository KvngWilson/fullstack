function buildRedirectUrl(fallbackPath, returnTo, messageType, message) {
  const safeReturn =
    typeof returnTo === "string" && returnTo.startsWith("/")
      ? returnTo
      : fallbackPath;

  const separator = safeReturn.includes("?") ? "&" : "?";
  return `${safeReturn}${separator}${messageType}=${encodeURIComponent(message)}`;
}

const buildUserProfile = (user) => {
  const email = user?.email || "Admin";
  return {
    name: email.split("@")[0] || "Admin",
    role: user?.role || "Administrator",
    avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(email)}`,
  };
};

const buildNavData = (currentRoute) => {
  const navItems = [
    {
      label: "Dashboard",
      href: "/dashboard",
      badge: null,
      icon:
        '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3h7v7H3z" /><path d="M14 3h7v4h-7z" /><path d="M14 9h7v12h-7z" /><path d="M3 12h7v9H3z" /></svg>',
    },
    {
      label: "Orders",
      href: "/orders",
      badge: null,
      icon:
        '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.6a2 2 0 0 0 2-1.6L23 6H6" /></svg>',
    },
    {
      label: "Customers",
      href: "/users",
      badge: null,
      icon:
        '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>',
    },
    {
      label: "Categories",
      href: "/categories",
      badge: null,
      icon:
        '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h7v7H4z" /><path d="M13 4h7v7h-7z" /><path d="M4 13h7v7H4z" /><path d="M13 13h7v7h-7z" /></svg>',
    },
    {
      label: "Transactions",
      href: "/transactions",
      badge: null,
      icon:
        '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1v22" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7H14a3.5 3.5 0 0 1 0 7H6" /></svg>',
    },
    {
      label: "Add Product",
      href: "/products/add",
      badge: null,
      icon:
        '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14" /><path d="M5 12h14" /></svg>',
    },
    {
      label: "Admin Role",
      href: "/admin-role",
      badge: null,
      icon:
        '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l7 4v6c0 5-3 9-7 10-4-1-7-5-7-10V6l7-4z" /></svg>',
    },
  ];

  const secondaryNav = [
    {
      label: "Settings",
      href: "/settings",
      icon:
        '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c0 .66.26 1.3.73 1.77.47.47 1.1.73 1.77.73H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>',
    },
    {
      label: "Logout",
      href: "/auth/logout",
      icon:
        '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>',
    },
  ];

  return { navItems, secondaryNav, currentRoute };
};

const buildPagination = (pagination, originalUrl) => {
  if (!pagination) {
    return {
      pagination: null,
      prevHref: "#",
      nextHref: "#",
    };
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

function renderDashboardView(res, { user, dashboardData, query }) {
  // Map service data to template expectations
  const stats = [
    {
      title: "Total Users",
      value: dashboardData.totals.total_users,
      trend: 12,
      icon:
        '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>',
    },
    {
      title: "Active Products",
      value: dashboardData.totals.active_products,
      trend: 8,
      icon:
        '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /></svg>',
    },
    {
      title: "Total Orders",
      value: dashboardData.totals.total_orders,
      trend: -3,
      icon:
        '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.6a2 2 0 0 0 2-1.6L23 6H6" /></svg>',
    },
    {
      title: "Total Revenue",
      value: `$${dashboardData.totals.total_revenue}`,
      trend: 25,
      icon:
        '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1v22" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7H14a3.5 3.5 0 0 1 0 7H6" /></svg>',
    },
  ];

  const topProducts = dashboardData.recentOrders.slice(0, 4).map((order) => ({
    name: `Order #${order.id}`,
    price: Number(order.total_amount || 0).toFixed(2),
    revenue: Number(order.total_amount || 0).toFixed(2),
    initials: `#${order.id}`,
  }));

  const orders = dashboardData.recentOrders.map(order => ({
    id: order.id,
    status: order.status,
    amount: order.total_amount,
    date: new Date(order.created_at).toLocaleDateString(),
    customer: order.user_email || 'Guest',
    avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(order.user_email || 'Guest')}`,
    product: 'N/A', // Orders don't have single product in this schema
  }));

  const today = new Date();
  const salesLabels = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (6 - index));
    return date.toLocaleDateString("en-US", { weekday: "short" });
  });
  const salesSeries = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (6 - index));
    const key = date.toISOString().slice(0, 10);
    return dashboardData.recentOrders
      .filter((order) => {
        if (!order.created_at) {
          return false;
        }
        const orderDate = new Date(order.created_at);
        if (Number.isNaN(orderDate.getTime())) {
          return false;
        }
        return orderDate.toISOString().slice(0, 10) === key;
      })
      .reduce((sum, order) => sum + Number(order.total_amount || 0), 0);
  });

  const pagination = {
    page: 1,
    totalPages: 1,
    total: orders.length,
    hasPrevious: false,
    hasNext: false,
  };

  const { navItems, secondaryNav, currentRoute } = buildNavData("/dashboard");

  return res.render("admin/dashboard", {
    title: "Admin Dashboard",
    pageTitle: "Dashboard Overview",
    currentRoute,
    user: buildUserProfile(user),
    navItems,
    secondaryNav,
    cartCount: 0,
    stats,
    topProducts,
    orders,
    pagination,
    label: "orders",
    prevHref: "#",
    nextHref: "#",
    salesLabels,
    salesSeries,
    totals: dashboardData.totals,
    orderStatusBreakdown: dashboardData.orderStatusBreakdown,
    recentOrders: dashboardData.recentOrders,
    recentUsers: dashboardData.recentUsers,
    feedback: {
      success: query.success || "",
      error: query.error || "",
    },
  });
}

function renderUsersView(res, { user, usersData, query, originalUrl }) {
  const now = Date.now();
  const activeWindow = 7 * 24 * 60 * 60 * 1000;
  const newWindow = 30 * 24 * 60 * 60 * 1000;
  const userSummary = {
    total: usersData.pagination.total,
    active: usersData.data.filter((entry) => entry.last_login && now - new Date(entry.last_login).getTime() <= activeWindow).length,
    newLast30: usersData.data.filter((entry) => entry.created_at && now - new Date(entry.created_at).getTime() <= newWindow).length,
    admins: usersData.data.filter((entry) => entry.role === "admin").length,
  };
  const { pagination, prevHref, nextHref } = buildPagination(usersData.pagination, originalUrl);
  const { navItems, secondaryNav, currentRoute } = buildNavData("/users");

  return res.render("admin/users", {
    title: "Admin Users",
    pageTitle: "Customers",
    currentRoute,
    user: buildUserProfile(user),
    navItems,
    secondaryNav,
    cartCount: 0,
    users: usersData.data,
    pagination,
    label: "customers",
    prevHref,
    nextHref,
    userSummary,
    feedback: {
      success: query.success || "",
      error: query.error || "",
    },
    currentUrl: originalUrl,
  });
}

function renderOrdersView(res, { user, ordersData, query, originalUrl }) {
  const orderSummary = {
    total: ordersData.pagination.total,
    pending: ordersData.data.filter((entry) => entry.status === "pending").length,
    paid: ordersData.data.filter((entry) => entry.status === "paid").length,
    cancelled: ordersData.data.filter((entry) => entry.status === "cancelled").length,
  };
  const { pagination, prevHref, nextHref } = buildPagination(ordersData.pagination, originalUrl);
  const { navItems, secondaryNav, currentRoute } = buildNavData("/orders");

  return res.render("admin/orders", {
    title: "Admin Orders",
    pageTitle: "Orders",
    currentRoute,
    user: buildUserProfile(user),
    navItems,
    secondaryNav,
    cartCount: 0,
    orders: ordersData.data,
    pagination,
    label: "orders",
    prevHref,
    nextHref,
    orderSummary,
    filter: ordersData.filter,
    feedback: {
      success: query.success || "",
      error: query.error || "",
    },
    currentUrl: originalUrl,
  });
}

function renderCategoriesView(res, { user, categories, summary }) {
  const { navItems, secondaryNav, currentRoute } = buildNavData("/categories");

  return res.render("admin/categories", {
    title: "Admin Categories",
    pageTitle: "Categories",
    currentRoute,
    user: buildUserProfile(user),
    navItems,
    secondaryNav,
    categories,
    summary,
  });
}

function renderTransactionsView(res, { user, transactions, summary, pagination, prevHref, nextHref }) {
  const { navItems, secondaryNav, currentRoute } = buildNavData("/transactions");

  return res.render("admin/transactions", {
    title: "Admin Transactions",
    pageTitle: "Transactions",
    currentRoute,
    user: buildUserProfile(user),
    navItems,
    secondaryNav,
    transactions,
    summary,
    pagination,
    label: "transactions",
    prevHref,
    nextHref,
  });
}

function renderAddProductView(res, { user, categories }) {
  const { navItems, secondaryNav, currentRoute } = buildNavData("/products/add");

  return res.render("admin/products-add", {
    title: "Add Product",
    pageTitle: "Add Product",
    currentRoute,
    user: buildUserProfile(user),
    navItems,
    secondaryNav,
    categories,
  });
}

function renderAdminRoleView(res, { user, profile, permissions }) {
  const { navItems, secondaryNav, currentRoute } = buildNavData("/admin-role");

  return res.render("admin/admin-role", {
    title: "Admin Role",
    pageTitle: "Admin Role",
    currentRoute,
    user: buildUserProfile(user),
    navItems,
    secondaryNav,
    profile,
    permissions,
  });
}

function renderAdminViewError(res, message) {
  return res.status(500).render("/404", { message });
}

module.exports = {
  buildRedirectUrl,
  renderDashboardView,
  renderUsersView,
  renderOrdersView,
  renderCategoriesView,
  renderTransactionsView,
  renderAddProductView,
  renderAdminRoleView,
  renderAdminViewError,
};
