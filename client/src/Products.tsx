import { Category, Product } from "./utilities";
import React, { useCallback, useEffect, useRef, useState } from "react";
import ProductCard from "./ProductCard";
import axios from "axios";
import { Button } from "./components/ui/button";
import { Skeleton } from "./components/ui/skeleton";
import { Card, CardFooter } from "./components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./components/ui/select";
import { useLocation } from "react-router-dom";

type ProductsProps = {
  search: string;
};

const ProductSkeleton = () => (
  <Card className="space-y-4">
    <Skeleton className="h-48 w-full rounded-b-none" />
    <CardFooter className="p-4 flex flex-col items-start">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-1/2 mt-4" />
    </CardFooter>
  </Card>
);

const Products: React.FC<ProductsProps> = ({ search }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const fetchIdRef = useRef(0);
  const [category, setCategory] = useState<string>("all");
  const [sortOrder, setSortOrder] = useState<string>("newest");
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const location = useLocation();

  const fetchProducts = useCallback(
    async (page: number) => {
      const fetchId = ++fetchIdRef.current;
      setLoading(true);
      try {
        const response = await axios.get(`/api/products`, {
          params: {
            page,
            limit: 12,
            search: search || undefined,
            category: category !== "all" ? category : undefined,
            sort: sortOrder,
          },
        });
        const data = response.data;
        if (!data.success) throw new Error("Error in server");
        if (fetchId === fetchIdRef.current) {
          setLoading(false);
          setProducts((prevProducts) =>
            page === 1 ? data.data : [...prevProducts, ...data.data]
          );
          setTotalPages(data.pages);
        }
      } catch (error) {
        console.error("Error fetching products:", error);
        setProducts([]);
        setPage(1);
      }
    },
    [search, category, sortOrder]
  );

  useEffect(() => {
    setProducts([]);
    setPage(1);
    fetchProducts(1);
  }, [fetchProducts, search, category, sortOrder]);

  useEffect(() => {
    fetchProducts(page);
  }, [page, fetchProducts]);

  useEffect(() => {
    axios.get("/api/categories").then((response) => {
      const data = response.data;
      if (data.success) {
        setAllCategories(data.data);
      }
    });
  }, [allCategories]);

  const handleScroll = useCallback(() => {
    if (
      window.innerHeight + document.documentElement.scrollTop !==
      document.documentElement.offsetHeight
    ) {
      return;
    }
    if (page < totalPages) {
      setPage((prevPage) => prevPage + 1);
    }
  }, [page, totalPages]);

  useEffect(() => {
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  useEffect(() => {
    const category =
      new URLSearchParams(location.search).get("category") ?? "all";
    setCategory(category);
  }, [location.search]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid">
      <h1 className="text-2xl font-bold my-8">Our Products</h1>

      <div className="flex justify-between mb-6">
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {allCategories.map((category, i) => (
              <SelectItem key={i} value={category.name}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sortOrder} onValueChange={setSortOrder}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest First</SelectItem>
            <SelectItem value="oldest">Oldest First</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 mb-10">
        {products.length > 0
          ? products.map((product: Product, i) => (
              <ProductCard
                key={i}
                id={product._id}
                name={product.name}
                price={product.price}
                imageUrl={product.imageUrl}
                discountPercentage={product.discountPercentage}
                category={product.category}
              />
            ))
          : !loading &&
            products.length === 0 && (
              <div className="font-bold justify-self-center text-4xl col-span-full text-muted-foreground">
                No Products
              </div>
            )}
        {loading &&
          Array.from({ length: 12 }).map((_, index) => (
            <ProductSkeleton key={`skeleton-${index}`} />
          ))}
      </div>
      {!loading && page < totalPages && (
        <Button
          onClick={() => setPage((prevPage) => prevPage + 1)}
          className="my-6 justify-self-center"
        >
          Load More
        </Button>
      )}
    </div>
  );
};

export default Products;
