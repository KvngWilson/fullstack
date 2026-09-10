import { INTERNAL_ADMIN_ROLES, USER_ROLES } from "@/api/types/user";

export function getPostLoginPath(role) {
  const normalizedRole = String(role || "").toLowerCase();

  if (normalizedRole === USER_ROLES.VENDOR) {
    return "/vendor";
  }

  if (INTERNAL_ADMIN_ROLES.includes(normalizedRole)) {
    return "/admin";
  }

  return "/dashboard";
}

export default getPostLoginPath;
