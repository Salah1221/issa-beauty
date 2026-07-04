import React, { useState, useEffect } from "react";
import {
  createBrowserRouter,
  RouterProvider,
  useNavigate,
  Outlet,
  useLocation,
  ScrollRestoration,
} from "react-router-dom";
import Home from "@/features/products/ui/Home";
import Navbar from "@/layout/ui/Navbar";
import ErrorPage from "@/layout/ui/ErrorPage";
import Products from "@/features/products/ui/Products";
import Footer from "@/layout/ui/Footer";
import ProductPage from "@/features/products/ui/ProductPage";
import { CartProvider } from "@/features/cart/data/CartContext";
import { AuthProvider } from "@/features/auth/data/AuthContext";
import { Toaster } from "@/common/ui/components/sonner";
import CheckoutPage from "@/features/checkout/ui/CheckoutPage";
import OrderConfirmation from "@/features/checkout/ui/OrderConfirmation";
import MyOrdersPage from "@/features/orders/ui/MyOrdersPage";
import OrderDetail from "@/features/orders/ui/OrderDetail";
import LoginPage from "@/features/auth/ui/LoginPage";
import RegisterPage from "@/features/auth/ui/RegisterPage";
import RequireAuth from "@/features/auth/ui/RequireAuth";

type LayoutProps = {
  search: string;
  setSearch: (search: string) => void;
};

// Layout component to wrap the Navbar and content
const Layout: React.FC<LayoutProps> = ({ search, setSearch }) => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (location.pathname === "/") {
      setSearch("");
    }
  }, [location.pathname, setSearch]);

  useEffect(() => {
    if (search) {
      navigate("/products");
    }
  }, [search, navigate]);

  return (
    <>
      <ScrollRestoration />
      <Navbar search={search} setSearch={setSearch} />
      <Outlet />
      <Footer />
    </>
  );
};

function App() {
  const [search, setSearch] = useState("");

  const router = React.useMemo(() => createBrowserRouter([
    {
      path: "/",
      element: <Layout search={search} setSearch={setSearch} />,
      errorElement: <ErrorPage />,
      children: [
        {
          index: true,
          element: <Home />,
        },
        {
          path: "products",
          element: <Products search={search} />,
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
  ]), [search]);

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
