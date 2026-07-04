import {
  Category,
  PriceRange,
  Product,
  getCategories,
  getPriceRange,
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
import { Badge } from "@/common/ui/components/badge";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/common/ui/components/drawer";
import { Slider } from "@/common/ui/components/slider";
import { SlidersHorizontal } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

type ProductsProps = {
  search: string;
};

const ProductSkeleton = () => (
  <Card className="h-full space-y-4 overflow-hidden">
    <Skeleton className="h-[200px] w-full rounded-none" />
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
  // Slider bounds come from the catalog so the control auto-scales to real prices.
  const [priceBounds, setPriceBounds] = useState<PriceRange | null>(null);
  // Live slider position (drives the labels); committed value drives the fetch.
  const [priceValue, setPriceValue] = useState<[number, number]>([0, 0]);
  const [appliedPrice, setAppliedPrice] = useState<[number, number] | null>(
    null,
  );
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const location = useLocation();
  const navigate = useNavigate();
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
        {
          page,
          search,
          category,
          sort: sortOrder,
          minPrice: appliedPrice?.[0],
          maxPrice: appliedPrice?.[1],
        },
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
    [search, category, sortOrder, appliedPrice],
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

  // Load slider bounds for the current search + category and clear any applied
  // price filter so it never carries over to a different result set.
  useEffect(() => {
    const controller = new AbortController();

    getPriceRange({ search, category }, controller.signal).then((result) => {
      if (result.type === "success") {
        const min = Math.floor(result.data.min);
        const max = Math.ceil(result.data.max);
        setPriceBounds({ min, max });
        setPriceValue([min, max]);
      } else if (result.type === "error") {
        console.error("Error fetching price range:", result.message);
      }
    });

    setAppliedPrice(null);

    return () => controller.abort();
  }, [search, category]);

  useEffect(() => {
    setProducts([]);
    setPage(1);
    // Don't call fetchProducts(1) here, let the page useEffect handle it
  }, [search, category, sortOrder, appliedPrice]);

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

  // Filters considered "active" for the mobile badge (sort is excluded).
  const activeFilterCount =
    (category !== "all" ? 1 : 0) + (appliedPrice ? 1 : 0);

  const priceSpan = priceBounds ? priceBounds.max - priceBounds.min : 0;
  const priceStep = priceSpan <= 10 ? 0.5 : priceSpan <= 100 ? 1 : 5;
  const priceDisabled = !priceBounds || priceBounds.min >= priceBounds.max;

  // Shared between the desktop toolbar and the mobile filter sheet so both stay
  // in sync. Responsive widths only kick in inside the desktop (sm+) toolbar;
  // inside the mobile sheet the base full-width classes apply.
  const filterFields = (
    <>
      <Select value={category} onValueChange={setCategory}>
        <SelectTrigger className="w-full sm:w-[180px]">
          <SelectValue placeholder="Category" />
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

      <div className="w-full sm:w-[240px] space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Price</span>
          <span className="font-medium tabular-nums">
            {priceBounds
              ? `$${priceValue[0].toFixed(2)} – $${priceValue[1].toFixed(2)}`
              : "—"}
          </span>
        </div>
        <Slider
          min={priceBounds?.min ?? 0}
          max={priceBounds?.max ?? 0}
          step={priceStep}
          value={priceValue}
          onValueChange={(v) => setPriceValue(v as [number, number])}
          onValueCommit={(v) => {
            const next = v as [number, number];
            const isFullRange =
              !priceBounds ||
              (next[0] <= priceBounds.min && next[1] >= priceBounds.max);
            setAppliedPrice(isFullRange ? null : next);
          }}
          disabled={priceDisabled}
          aria-label="Filter by price range"
        />
      </div>

      <Select value={sortOrder} onValueChange={setSortOrder}>
        <SelectTrigger className="w-full sm:w-[180px]">
          <SelectValue placeholder="Sort by" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="newest">Newest First</SelectItem>
          <SelectItem value="oldest">Oldest First</SelectItem>
          <SelectItem value="price-asc">Price: Low to High</SelectItem>
          <SelectItem value="price-desc">Price: High to Low</SelectItem>
        </SelectContent>
      </Select>
    </>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid">
      <h1 className="text-2xl font-bold my-8">Our Products</h1>

      {/* Desktop: inline filter toolbar */}
      <div className="hidden sm:flex flex-wrap items-end gap-4 mb-6">
        {filterFields}
      </div>

      {/* Mobile: collapse filters behind a sheet to keep the toolbar tidy */}
      <div className="sm:hidden mb-6">
        <Drawer>
          <DrawerTrigger asChild>
            <Button variant="outline" className="w-full justify-between">
              <span className="flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4" />
                Filters &amp; Sort
              </span>
              {activeFilterCount > 0 && (
                <Badge className="ml-2">{activeFilterCount}</Badge>
              )}
            </Button>
          </DrawerTrigger>
          <DrawerContent>
            <DrawerHeader className="text-left">
              <DrawerTitle>Filters &amp; Sort</DrawerTitle>
              <DrawerDescription className="sr-only">
                Filter and sort the product list
              </DrawerDescription>
            </DrawerHeader>
            <div className="flex flex-col gap-5 px-4 pb-8">
              {filterFields}
            </div>
          </DrawerContent>
        </Drawer>
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
              <div className="col-span-full flex flex-col items-center justify-center gap-3 py-16 text-center">
                <p className="text-xl font-semibold text-muted-foreground">
                  No products found
                </p>
                <p className="text-sm text-muted-foreground">
                  Try adjusting your filters or browse our full catalog.
                </p>
                <Button
                  variant="outline"
                  onClick={() => {
                    setCategory("all");
                    setAppliedPrice(null);
                    navigate("/products");
                  }}
                >
                  Browse all products
                </Button>
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
