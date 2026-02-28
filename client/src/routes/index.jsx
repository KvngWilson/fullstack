import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import RootLayout from '@/components/layout/RootLayout';
import ProtectedRoute from './ProtectedRoute';
import RoleBasedRoute from './RoleBasedRoute';
import LoadingSpinner from '@/components/common/LoadingSpinner';

// Lazy load pages for code splitting
const Home = lazy(() => import('@/pages/shop/Home'));
const ProductList = lazy(() => import('@/pages/shop/ProductList'));
const ProductDetail = lazy(() => import('@/pages/shop/ProductDetail'));
const CategoryPage = lazy(() => import('@/pages/shop/CategoryPage'));
const SearchResults = lazy(() => import('@/pages/shop/SearchResults'));

const Login = lazy(() => import('@/pages/auth/Login'));
const Register = lazy(() => import('@/pages/auth/Register'));
const ForgotPassword = lazy(() => import('@/pages/auth/ForgotPassword'));
const ResetPassword = lazy(() => import('@/pages/auth/ResetPassword'));

const Cart = lazy(() => import('@/pages/cart/Cart'));
const Checkout = lazy(() => import('@/pages/cart/Checkout'));

const Profile = lazy(() => import('@/pages/account/Profile'));
const Orders = lazy(() => import('@/pages/account/Orders'));
const OrderDetail = lazy(() => import('@/pages/account/OrderDetail'));
const Wishlist = lazy(() => import('@/pages/account/Wishlist'));
const Addresses = lazy(() => import('@/pages/account/Addresses'));
const SavedCards = lazy(() => import('@/pages/account/SavedCards'));

const VendorDashboard = lazy(() => import('@/pages/vendor/Dashboard'));
const VendorProducts = lazy(() => import('@/pages/vendor/Products'));
const VendorOrders = lazy(() => import('@/pages/vendor/Orders'));
const VendorInventory = lazy(() => import('@/pages/vendor/Inventory'));
const VendorAnalytics = lazy(() => import('@/pages/vendor/Analytics'));

const AdminDashboard = lazy(() => import('@/pages/admin/Dashboard'));
const AdminVendors = lazy(() => import('@/pages/admin/Vendors'));
const AdminUsers = lazy(() => import('@/pages/admin/Users'));
const AdminSupport = lazy(() => import('@/pages/admin/Support'));
const AdminSettings = lazy(() => import('@/pages/admin/Settings'));

const NotFound = lazy(() => import('@/pages/error/NotFound'));
const Unauthorized = lazy(() => import('@/pages/error/Unauthorized'));

const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    errorElement: <NotFound />,
    children: [
      // Public routes
      {
        index: true,
        element: (
          <Suspense fallback={<LoadingSpinner />}>
            <Home />
          </Suspense>
        ),
      },
      {
        path: 'products',
        element: (
          <Suspense fallback={<LoadingSpinner />}>
            <ProductList />
          </Suspense>
        ),
      },
      {
        path: 'products/:id',
        element: (
          <Suspense fallback={<LoadingSpinner />}>
            <ProductDetail />
          </Suspense>
        ),
      },
      {
        path: 'category/:slug',
        element: (
          <Suspense fallback={<LoadingSpinner />}>
            <CategoryPage />
          </Suspense>
        ),
      },
      {
        path: 'search',
        element: (
          <Suspense fallback={<LoadingSpinner />}>
            <SearchResults />
          </Suspense>
        ),
      },

      // Auth routes
      {
        path: 'login',
        element: (
          <Suspense fallback={<LoadingSpinner />}>
            <Login />
          </Suspense>
        ),
      },
      {
        path: 'register',
        element: (
          <Suspense fallback={<LoadingSpinner />}>
            <Register />
          </Suspense>
        ),
      },
      {
        path: 'forgot-password',
        element: (
          <Suspense fallback={<LoadingSpinner />}>
            <ForgotPassword />
          </Suspense>
        ),
      },
      {
        path: 'reset-password/:token',
        element: (
          <Suspense fallback={<LoadingSpinner />}>
            <ResetPassword />
          </Suspense>
        ),
      },

      // Protected customer routes
      {
        path: 'cart',
        element: (
          <ProtectedRoute>
            <Suspense fallback={<LoadingSpinner />}>
              <Cart />
            </Suspense>
          </ProtectedRoute>
        ),
      },
      {
        path: 'checkout',
        element: (
          <ProtectedRoute>
            <Suspense fallback={<LoadingSpinner />}>
              <Checkout />
            </Suspense>
          </ProtectedRoute>
        ),
      },

      // Account routes
      {
        path: 'account',
        element: <ProtectedRoute />,
        children: [
          {
            path: 'profile',
            element: (
              <Suspense fallback={<LoadingSpinner />}>
                <Profile />
              </Suspense>
            ),
          },
          {
            path: 'orders',
            element: (
              <Suspense fallback={<LoadingSpinner />}>
                <Orders />
              </Suspense>
            ),
          },
          {
            path: 'orders/:id',
            element: (
              <Suspense fallback={<LoadingSpinner />}>
                <OrderDetail />
              </Suspense>
            ),
          },
          {
            path: 'wishlist',
            element: (
              <Suspense fallback={<LoadingSpinner />}>
                <Wishlist />
              </Suspense>
            ),
          },
          {
            path: 'addresses',
            element: (
              <Suspense fallback={<LoadingSpinner />}>
                <Addresses />
              </Suspense>
            ),
          },
          {
            path: 'saved-cards',
            element: (
              <Suspense fallback={<LoadingSpinner />}>
                <SavedCards />
              </Suspense>
            ),
          },
        ],
      },

      // Vendor routes
      {
        path: 'vendor',
        element: <RoleBasedRoute allowedRoles={['vendor', 'admin']} />,
        children: [
          {
            index: true,
            element: (
              <Suspense fallback={<LoadingSpinner />}>
                <VendorDashboard />
              </Suspense>
            ),
          },
          {
            path: 'products',
            element: (
              <Suspense fallback={<LoadingSpinner />}>
                <VendorProducts />
              </Suspense>
            ),
          },
          {
            path: 'orders',
            element: (
              <Suspense fallback={<LoadingSpinner />}>
                <VendorOrders />
              </Suspense>
            ),
          },
          {
            path: 'inventory',
            element: (
              <Suspense fallback={<LoadingSpinner />}>
                <VendorInventory />
              </Suspense>
            ),
          },
          {
            path: 'analytics',
            element: (
              <Suspense fallback={<LoadingSpinner />}>
                <VendorAnalytics />
              </Suspense>
            ),
          },
        ],
      },

      // Admin routes
      {
        path: 'admin',
        element: <RoleBasedRoute allowedRoles={['admin']} />,
        children: [
          {
            index: true,
            element: (
              <Suspense fallback={<LoadingSpinner />}>
                <AdminDashboard />
              </Suspense>
            ),
          },
          {
            path: 'vendors',
            element: (
              <Suspense fallback={<LoadingSpinner />}>
                <AdminVendors />
              </Suspense>
            ),
          },
          {
            path: 'users',
            element: (
              <Suspense fallback={<LoadingSpinner />}>
                <AdminUsers />
              </Suspense>
            ),
          },
          {
            path: 'support',
            element: (
              <Suspense fallback={<LoadingSpinner />}>
                <AdminSupport />
              </Suspense>
            ),
          },
          {
            path: 'settings',
            element: (
              <Suspense fallback={<LoadingSpinner />}>
                <AdminSettings />
              </Suspense>
            ),
          },
        ],
      },

      {
        path: 'unauthorized',
        element: (
          <Suspense fallback={<LoadingSpinner />}>
            <Unauthorized />
          </Suspense>
        ),
      },

      // Catch-all 404
      {
        path: '*',
        element: (
          <Suspense fallback={<LoadingSpinner />}>
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
