import React, { Suspense } from "react";
import {
  createBrowserRouter,
  RouterProvider,
  Outlet,
  ScrollRestoration,
} from "react-router-dom";
import Navbar from "@/layout/ui/Navbar";
import ErrorPage from "@/layout/ui/ErrorPage";
import Footer from "@/layout/ui/Footer";
import { CartProvider } from "@/features/cart/data/CartContext";
import { AuthProvider } from "@/features/auth/data/AuthContext";
import { Toaster } from "@/common/ui/components/sonner";
import { Skeleton } from "@/common/ui/components/skeleton";
import RequireAuth from "@/features/auth/ui/RequireAuth";
// Home is the landing page — load it eagerly (not lazy) so there is no
// Suspense-fallback→content swap that shoves the whole page down (CLS).
import Home from "@/features/products/ui/Home";

const Products = React.lazy(() => import("@/features/products/ui/Products"));
const ProductPage = React.lazy(() => import("@/features/products/ui/ProductPage"));
const CheckoutPage = React.lazy(() => import("@/features/checkout/ui/CheckoutPage"));
const OrderConfirmation = React.lazy(() => import("@/features/checkout/ui/OrderConfirmation"));
const MyOrdersPage = React.lazy(() => import("@/features/orders/ui/MyOrdersPage"));
const OrderDetail = React.lazy(() => import("@/features/orders/ui/OrderDetail"));
const LoginPage = React.lazy(() => import("@/features/auth/ui/LoginPage"));
const RegisterPage = React.lazy(() => import("@/features/auth/ui/RegisterPage"));

// Layout component to wrap the Navbar and content
const Layout: React.FC = () => {
  return (
    <>
      <ScrollRestoration />
      <Navbar />
      <main>
        <Suspense
          fallback={
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 min-h-[60vh]">
              <Skeleton className="h-64 w-full" />
            </div>
          }
        >
          <Outlet />
        </Suspense>
      </main>
      <Footer />
    </>
  );
};

const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    errorElement: <ErrorPage />,
    children: [
      {
        index: true,
        element: <Home />,
      },
      {
        path: "products",
        element: <Products />,
      },
      {
        path: "products/:productId",
        element: <ProductPage />,
      },
      {
        path: "checkout",
        element: <CheckoutPage />,
      },
      {
        path: "checkout/success",
        element: <OrderConfirmation />,
      },
      { path: "orders", element: <RequireAuth><MyOrdersPage /></RequireAuth> },
      { path: "orders/:orderNumber", element: <RequireAuth><OrderDetail /></RequireAuth> },
      { path: "login", element: <LoginPage /> },
      { path: "register", element: <RegisterPage /> },
    ],
  },
]);

function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <RouterProvider router={router} />
        <Toaster />
      </CartProvider>
    </AuthProvider>
  );
}

export default App;
