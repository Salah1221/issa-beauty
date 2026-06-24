import { request } from "@/common/data/ApiClient";
import { ApiResult } from "@/common/data/ApiResult";

export type Product = {
  _id: string;
  name: string;
  imageUrl: string;
  category: string;
  price: number;
  discountPercentage?: number;
  description: string;
  in_stock?: boolean;
};

export type Category = {
  name: string;
};

export type BannerImage = {
  imageUrl: string;
};

export type ProductsByCategory = {
  [category: string]: Product[];
};

export type ProductsPage = {
  products: Product[];
  pages: number;
};

export type ProductQuery = {
  page: number;
  limit?: number;
  search?: string;
  category?: string;
  sort?: string;
  minPrice?: number;
  maxPrice?: number;
};

export type PriceRange = {
  min: number;
  max: number;
};

export const getProductsByCategory = (
  signal?: AbortSignal,
): Promise<ApiResult<ProductsByCategory>> =>
  request<ProductsByCategory>({ url: "/api/products-by-category", signal });

export const getBannerImages = (
  signal?: AbortSignal,
): Promise<ApiResult<BannerImage[]>> =>
  request<BannerImage[]>({ url: "/api/banner-images", signal });

export const getCategories = (
  signal?: AbortSignal,
): Promise<ApiResult<Category[]>> =>
  request<Category[]>({ url: "/api/categories", signal });

export const getPriceRange = (
  params: { search?: string; category?: string },
  signal?: AbortSignal,
): Promise<ApiResult<PriceRange>> =>
  request<PriceRange>(
    {
      url: "/api/products-price-range",
      signal,
      params: {
        search: params.search || undefined,
        category:
          params.category && params.category !== "all"
            ? params.category
            : undefined,
      },
    },
    (body) => ({
      min: (body.min as number) ?? 0,
      max: (body.max as number) ?? 0,
    }),
  );

export const getProduct = (
  id: string,
  signal?: AbortSignal,
): Promise<ApiResult<Product>> =>
  request<Product>({ url: `/api/products/${id}`, signal });

export const getProducts = (
  query: ProductQuery,
  signal?: AbortSignal,
): Promise<ApiResult<ProductsPage>> =>
  request<ProductsPage>(
    {
      url: "/api/products",
      signal,
      params: {
        page: query.page,
        limit: query.limit ?? 12,
        search: query.search || undefined,
        category:
          query.category && query.category !== "all"
            ? query.category
            : undefined,
        sort: query.sort,
        minPrice: query.minPrice,
        maxPrice: query.maxPrice,
      },
    },
    (body) => ({
      products: (body.data as Product[]) ?? [],
      pages: (body.pages as number) ?? 1,
    }),
  );
