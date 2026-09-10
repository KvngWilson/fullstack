const buildUserProfile = (user) => {
  const email = user?.email || "Admin";

  return {
    name: email.split("@")[0] || "Admin",
    role: user?.role || "Administrator",
    avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(email)}`,
  };
};

const buildOperationsNavData = (currentRoute) => {
  const navItems = [
    {
      label: "Operations",
      href: "/dashboard",
      badge: null,
      icon:
        '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20V10" /><path d="M18 20V4" /><path d="M6 20v-4" /></svg>',
    },
    {
      label: "Detailed Health",
      href: "/health/detailed",
      badge: "JSON",
      icon:
        '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>',
    },
    {
      label: "Queue Health",
      href: "/health/jobs",
      badge: "JSON",
      icon:
        '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="4" rx="1" /><rect x="3" y="10" width="18" height="4" rx="1" /><rect x="3" y="16" width="18" height="4" rx="1" /></svg>',
    },
    {
      label: "Metrics",
      href: "/metrics",
      badge: "text",
      icon:
        '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>',
    },
  ];

  const secondaryNav = [
    {
      label: "CSR Admin",
      href: "#",
      icon:
        '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7" /><path d="M7 7h10v10" /></svg>',
    },
    {
      label: "Logout",
      href: "/auth/logout",
      method: "post",
      icon:
        '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>',
    },
  ];

  return { navItems, secondaryNav, currentRoute };
};

function renderAdminTemplate(res, view, locals) {
  return res.render(view, locals, (error, body) => {
    if (error) {
      return renderAdminViewError(res, error.message);
    }

    return res.render("admin/layouts/main", {
      ...locals,
      body,
    });
  });
}

function renderOperationsView(res, { user, operationsData, feedback }) {
  const { navItems, secondaryNav, currentRoute } =
    buildOperationsNavData("/dashboard");
  secondaryNav[0].href = operationsData.csrAdminUrl;

  return renderAdminTemplate(res, "admin/operations-dashboard", {
    title: "Platform Operations",
    pageTitle: "Platform Operations",
    currentRoute,
    user: buildUserProfile(user),
    navItems,
    secondaryNav,
    operationsData,
    feedback: feedback || { success: "", error: "" },
  });
}

function renderAdminViewError(res, message) {
  return res.status(500).render("404", { message });
}

module.exports = {
  renderOperationsView,
  renderAdminViewError,
};
