import {
  Category,
  Product,
  getCategories,
  getProducts,
} from "@/features/products/data/products";
import React, { useCallback, useEffect, useRef, useState } from "react";
import ProductCard from "./ProductCard";
import { Button } from "@/common/ui/components/button";
import { Skeleton } from "@/common/ui/components/skeleton";
import { Card, CardFooter } from "@/common/ui/components/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/common/ui/components/select";
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
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchProducts = useCallback(
    async (page: number) => {
      const fetchId = ++fetchIdRef.current;
      setLoading(true);

      // Abort previous request if it exists
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Create a new controller for this request
      const controller = new AbortController();
      abortControllerRef.current = controller;

      const result = await getProducts(
        { page, search, category, sort: sortOrder },
        controller.signal,
      );

      // Ignore superseded or aborted requests.
      if (result.type === "canceled" || fetchId !== fetchIdRef.current) {
        return;
      }

      if (result.type === "error") {
        console.error("Error fetching products:", result.message);
        setProducts([]);
        setPage(1);
        setLoading(false);
        return;
      }

      setLoading(false);
      setProducts((prevProducts) =>
        page === 1
          ? result.data.products
          : [...prevProducts, ...result.data.products],
      );
      setTotalPages(result.data.pages);
    },
    [search, category, sortOrder],
  );

  useEffect(() => {
    const controller = new AbortController();

    getCategories(controller.signal).then((result) => {
      if (result.type === "success") setAllCategories(result.data);
      else if (result.type === "error")
        console.error("Error fetching categories:", result.message);
    });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    setProducts([]);
    setPage(1);
    // Don't call fetchProducts(1) here, let the page useEffect handle it
  }, [search, category, sortOrder]);

  useEffect(() => {
    fetchProducts(page);
  }, [page, fetchProducts]);

  const loaderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loading && page < totalPages) {
          setPage((prevPage) => prevPage + 1);
        }
      },
      { rootMargin: "100px" },
    );

    const currentLoader = loaderRef.current;
    if (currentLoader) {
      observer.observe(currentLoader);
    }

    return () => {
      if (currentLoader) {
        observer.unobserve(currentLoader);
      }
    };
  }, [loading, page, totalPages]);

  useEffect(() => {
    const category =
      new URLSearchParams(location.search).get("category") ?? "all";
    setCategory(category);
  }, [location.search]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid">
      <h1 className="text-2xl font-bold my-8">Our Products</h1>

      <div className="flex flex-col sm:flex-row justify-between gap-4 mb-6">
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-full sm:w-[180px]">
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
          <SelectTrigger className="w-full sm:w-[180px]">
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
                in_stock={product.in_stock}
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
      <div ref={loaderRef} className="h-1" />
    </div>
  );
};

export default Products;
