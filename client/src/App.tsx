import React, { useState, useEffect } from "react";
import {
  createBrowserRouter,
  RouterProvider,
  useNavigate,
  Outlet,
  useLocation,
} from "react-router-dom";
import Home from "./Home";
import Navbar from "./Navbar";
import ErrorPage from "./ErrorPage";
import Products from "./Products";
import Footer from "./Footer";
import ProductPage from "./ProductPage";

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
      <Navbar search={search} setSearch={setSearch} />
      <Outlet />
      <Footer />
    </>
  );
};

function App() {
  const [search, setSearch] = useState("");

  const router = createBrowserRouter([
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
      ],
    },
  ]);

  return <RouterProvider router={router} />;
}

export default App;
