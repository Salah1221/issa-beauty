import axios from "axios";

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

export type HomeLoaderData = {
  [category: string]: Product[];
};

export const homeLoader = async (): Promise<HomeLoaderData> => {
  try {
    const response = await axios.get("/api/products-by-category");
    return response.data.data;
  } catch (error) {
    console.error("Error fetching products by category:", error);
    return {};
  }
};

export const bannerImagesLoader = async (): Promise<BannerImage[]> => {
  try {
    const response = await axios.get("/api/banner-images");
    if (response.data.success) return response.data.data;
    else throw new Error("Error fetching banner images!!!!!!!!!");
  } catch (error) {
    console.error("Error fetching banner images:", error);
    return [];
  }
};
