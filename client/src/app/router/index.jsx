import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { lazy, Suspense } from "react";
import RootLayout from "@/components/layout/RootLayout";
import ProtectedRoute from "./guards/ProtectedRoute";
import RoleBasedRoute from "./guards/RoleBasedRoute";
import VendorOnboardingRoute from "./guards/VendorOnboardingRoute";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import {
  ADMIN_ROLES,
  MANAGEMENT_ROLES,
  SUPPORT_ROLES,
  USER_ROLES,
  WAREHOUSE_ROLES,
} from "@/api/types/user";
import { PERMISSIONS } from "@/api/types/permissions";

const routeFallback = (
  <LoadingSpinner fullscreen={false} text="Loading page..." className="py-24" />
);

const Home = lazy(() => import("@/features/products/pages/Home"));
const ProductList = lazy(() => import("@/features/products/pages/ProductList"));
const ProductDetail = lazy(() => import("@/features/products/pages/ProductDetail"));
const CategoryPage = lazy(() => import("@/features/products/pages/CategoryPage"));
const SearchResults = lazy(() => import("@/features/products/pages/SearchResults"));

const Login = lazy(() => import("@/features/auth/pages/Login"));
const Register = lazy(() => import("@/features/auth/pages/Register"));
const ForgotPassword = lazy(() => import("@/features/auth/pages/ForgotPassword"));
const ResetPassword = lazy(() => import("@/features/auth/pages/ResetPassword"));

const Cart = lazy(() => import("@/features/cart/pages/Cart"));
const Checkout = lazy(() => import("@/features/checkout/pages/Checkout"));
const OrderConfirmation = lazy(() => import("@/features/checkout/pages/OrderConfirmation"));

const Profile = lazy(() => import("@/features/account/pages/Profile"));
const Dashboard = lazy(() => import("@/features/account/pages/Dashboard"));
const Orders = lazy(() => import("@/features/account/pages/Orders"));
const OrderDetail = lazy(() => import("@/features/account/pages/OrderDetail"));
const OrderTracking = lazy(() => import("@/features/account/pages/OrderTracking"));
const Wishlist = lazy(() => import("@/features/account/pages/Wishlist"));
const Addresses = lazy(() => import("@/features/account/pages/Addresses"));
const SavedCards = lazy(() => import("@/features/account/pages/SavedCards"));
const VendorApply = lazy(() => import("@/features/onboarding/pages/VendorApply"));
const EmployeeInvitationAccept = lazy(() => import("@/features/onboarding/pages/EmployeeInvitationAccept"));

const VendorDashboard = lazy(() => import("@/vendor/pages/Dashboard"));
const VendorOnboarding = lazy(() => import("@/vendor/pages/Onboarding"));
const VendorProducts = lazy(() => import("@/vendor/pages/Products"));
const VendorOrders = lazy(() => import("@/vendor/pages/Orders"));
const VendorInventory = lazy(() => import("@/vendor/pages/Inventory"));
const VendorAnalytics = lazy(() => import("@/vendor/pages/Analytics"));

const AdminDashboard = lazy(() => import("@/admin/pages/Dashboard"));
const AdminOrders = lazy(() => import("@/admin/pages/Orders"));
const AdminShipping = lazy(() => import("@/admin/pages/Shipping"));
const AdminVendors = lazy(() => import("@/admin/pages/Vendors"));
const AdminUsers = lazy(() => import("@/admin/pages/Users"));
const AdminSupport = lazy(() => import("@/admin/pages/Support"));
const AdminSettings = lazy(() => import("@/admin/pages/Settings"));
const AdminUploads = lazy(() => import("@/admin/pages/Uploads"));
const AdminProducts = lazy(() => import("@/admin/pages/Products"));

const NotFound = lazy(() => import("@/pages/error/NotFound"));
const Unauthorized = lazy(() => import("@/pages/error/Unauthorized"));

const router = createBrowserRouter([
  {
    path: "/",
    element: <RootLayout />,
    errorElement: <NotFound />,
    children: [
      {
        index: true,
        element: (
          <Suspense fallback={routeFallback}>
            <Home />
          </Suspense>
        ),
      },
      {
        path: "products",
        element: (
          <Suspense fallback={routeFallback}>
            <ProductList />
          </Suspense>
        ),
      },
      {
        path: "products/:id",
        element: (
          <Suspense fallback={routeFallback}>
            <ProductDetail />
          </Suspense>
        ),
      },
      {
        path: "category/:slug",
        element: (
          <Suspense fallback={routeFallback}>
            <CategoryPage />
          </Suspense>
        ),
      },
      {
        path: "search",
        element: (
          <Suspense fallback={routeFallback}>
            <SearchResults />
          </Suspense>
        ),
      },
      {
        path: "login",
        element: (
          <Suspense fallback={routeFallback}>
            <Login />
          </Suspense>
        ),
      },
      {
        path: "register",
        element: (
          <Suspense fallback={routeFallback}>
            <Register />
          </Suspense>
        ),
      },
      {
        path: "vendor/apply",
        element: (
          <Suspense fallback={routeFallback}>
            <VendorApply />
          </Suspense>
        ),
      },
      {
        path: "accept-invitation",
        element: (
          <Suspense fallback={routeFallback}>
            <EmployeeInvitationAccept />
          </Suspense>
        ),
      },
      {
        path: "forgot-password",
        element: (
          <Suspense fallback={routeFallback}>
            <ForgotPassword />
          </Suspense>
        ),
      },
      {
        path: "reset-password/:token",
        element: (
          <Suspense fallback={routeFallback}>
            <ResetPassword />
          </Suspense>
        ),
      },
      {
        path: "dashboard",
        element: (
          <ProtectedRoute>
            <Suspense fallback={routeFallback}>
              <Dashboard />
            </Suspense>
          </ProtectedRoute>
        ),
      },
      {
        path: "cart",
        element: (
          <Suspense fallback={routeFallback}>
            <Cart />
          </Suspense>
        ),
      },
      {
        path: "checkout",
        element: (
          <Suspense fallback={routeFallback}>
            <Checkout />
          </Suspense>
        ),
      },
      {
        path: "order-confirmation",
        element: (
          <Suspense fallback={routeFallback}>
            <OrderConfirmation />
          </Suspense>
        ),
      },
      {
        path: "account",
        element: <ProtectedRoute />,
        children: [
          {
            path: "profile",
            element: (
              <Suspense fallback={routeFallback}>
                <Profile />
              </Suspense>
            ),
          },
          {
            path: "orders",
            element: (
              <Suspense fallback={routeFallback}>
                <Orders />
              </Suspense>
            ),
          },
          {
            path: "orders/:id",
            element: (
              <Suspense fallback={routeFallback}>
                <OrderDetail />
              </Suspense>
            ),
          },
          {
            path: "orders/:id/tracking",
            element: (
              <Suspense fallback={routeFallback}>
                <OrderTracking />
              </Suspense>
            ),
          },
          {
            path: "wishlist",
            element: (
              <Suspense fallback={routeFallback}>
                <Wishlist />
              </Suspense>
            ),
          },
          {
            path: "addresses",
            element: (
              <Suspense fallback={routeFallback}>
                <Addresses />
              </Suspense>
            ),
          },
          {
            path: "saved-cards",
            element: (
              <Suspense fallback={routeFallback}>
                <SavedCards />
              </Suspense>
            ),
          },
        ],
      },
      {
        path: "vendor",
        element: (
          <RoleBasedRoute
            allowedRoles={[USER_ROLES.VENDOR, ...MANAGEMENT_ROLES]}
          >
            <VendorOnboardingRoute />
          </RoleBasedRoute>
        ),
        children: [
          {
            path: "onboarding",
            element: (
              <RoleBasedRoute allowedRoles={[USER_ROLES.VENDOR]}>
                <Suspense fallback={routeFallback}>
                  <VendorOnboarding />
                </Suspense>
              </RoleBasedRoute>
            ),
          },
          {
            index: true,
            element: (
              <Suspense fallback={routeFallback}>
                <VendorDashboard />
              </Suspense>
            ),
          },
          {
            path: "products",
            element: (
              <Suspense fallback={routeFallback}>
                <VendorProducts />
              </Suspense>
            ),
          },
          {
            path: "orders",
            element: (
              <RoleBasedRoute
                allowedRoles={[
                  USER_ROLES.VENDOR,
                  ...MANAGEMENT_ROLES,
                  USER_ROLES.SUPPORT,
                ]}
              >
                <Suspense fallback={routeFallback}>
                  <VendorOrders />
                </Suspense>
              </RoleBasedRoute>
            ),
          },
          {
            path: "inventory",
            element: (
              <RoleBasedRoute
                allowedRoles={[
                  USER_ROLES.VENDOR,
                  ...MANAGEMENT_ROLES,
                  USER_ROLES.WAREHOUSE,
                ]}
              >
                <Suspense fallback={routeFallback}>
                  <VendorInventory />
                </Suspense>
              </RoleBasedRoute>
            ),
          },
          {
            path: "analytics",
            element: (
              <Suspense fallback={routeFallback}>
                <VendorAnalytics />
              </Suspense>
            ),
          },
        ],
      },
      {
        path: "admin",
        element: (
          <RoleBasedRoute
            allowedRoles={[
              ...ADMIN_ROLES,
              USER_ROLES.MANAGER,
              USER_ROLES.SUPPORT,
              USER_ROLES.WAREHOUSE,
            ]}
          />
        ),
        children: [
          {
            index: true,
            element: (
              <RoleBasedRoute
                allowedRoles={[
                  ...ADMIN_ROLES,
                  USER_ROLES.MANAGER,
                  USER_ROLES.SUPPORT,
                  USER_ROLES.WAREHOUSE,
                ]}
                requiredPermissions={[PERMISSIONS.ADMIN.DASHBOARD_READ]}
              >
                <Suspense fallback={routeFallback}>
                  <AdminDashboard />
                </Suspense>
              </RoleBasedRoute>
            ),
          },
          {
            path: "orders",
            element: (
              <RoleBasedRoute
                allowedRoles={[
                  ...ADMIN_ROLES,
                  USER_ROLES.MANAGER,
                  USER_ROLES.SUPPORT,
                ]}
                requiredPermissions={[PERMISSIONS.ORDER.READ]}
              >
                <Suspense fallback={routeFallback}>
                  <AdminOrders />
                </Suspense>
              </RoleBasedRoute>
            ),
          },
          {
            path: "shipping",
            element: (
              <RoleBasedRoute
                allowedRoles={[...WAREHOUSE_ROLES, USER_ROLES.MANAGER]}
                requiredPermissions={[
                  PERMISSIONS.ORDER.READ,
                  PERMISSIONS.INVENTORY.READ,
                ]}
              >
                <Suspense fallback={routeFallback}>
                  <AdminShipping />
                </Suspense>
              </RoleBasedRoute>
            ),
          },
          {
            path: "vendors",
            element: (
              <RoleBasedRoute allowedRoles={ADMIN_ROLES}>
                <Suspense fallback={routeFallback}>
                  <AdminVendors />
                </Suspense>
              </RoleBasedRoute>
            ),
          },
          {
            path: "users",
            element: (
              <RoleBasedRoute
                allowedRoles={ADMIN_ROLES}
                requiredPermissions={[PERMISSIONS.ADMIN.USERS_READ]}
              >
                <Suspense fallback={routeFallback}>
                  <AdminUsers />
                </Suspense>
              </RoleBasedRoute>
            ),
          },
          {
            path: "products",
            element: (
              <RoleBasedRoute
                allowedRoles={ADMIN_ROLES}
                requiredPermissions={[
                  PERMISSIONS.PRODUCT.CREATE,
                  PERMISSIONS.PRODUCT.UPDATE,
                ]}
                permissionMode="any"
              >
                <Suspense fallback={routeFallback}>
                  <AdminProducts />
                </Suspense>
              </RoleBasedRoute>
            ),
          },
          {
            path: "support",
            element: (
              <RoleBasedRoute
                allowedRoles={SUPPORT_ROLES}
                requiredPermissions={[
                  PERMISSIONS.ADMIN.USERS_READ,
                  PERMISSIONS.ORDER.READ,
                ]}
                permissionMode="any"
              >
                <Suspense fallback={routeFallback}>
                  <AdminSupport />
                </Suspense>
              </RoleBasedRoute>
            ),
          },
          {
            path: "settings",
            element: (
              <RoleBasedRoute
                allowedRoles={ADMIN_ROLES}
                requiredPermissions={[PERMISSIONS.ADMIN.DASHBOARD_READ]}
              >
                <Suspense fallback={routeFallback}>
                  <AdminSettings />
                </Suspense>
              </RoleBasedRoute>
            ),
          },
          {
            path: "uploads",
            element: (
              <RoleBasedRoute
                allowedRoles={ADMIN_ROLES}
                requiredPermissions={[
                  PERMISSIONS.PRODUCT.CREATE,
                  PERMISSIONS.PRODUCT.UPDATE,
                ]}
                permissionMode="any"
              >
                <Suspense fallback={routeFallback}>
                  <AdminUploads />
                </Suspense>
              </RoleBasedRoute>
            ),
          },
          ],
        },
        {
          path: "unauthorized",
          element: (
            <Suspense fallback={routeFallback}>
              <Unauthorized />
            </Suspense>
          ),
        },
        {
          path: "*",
          element: (
            <Suspense fallback={routeFallback}>
              <NotFound />
            </Suspense>
          ),
        },
      ],
    },
]);

export default function AppRouter() {
  return <RouterProvider router={router} />;
}
