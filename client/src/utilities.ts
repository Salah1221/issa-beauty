import axios from "axios";

export type Product = {
  _id: string;
  name: string;
  imageUrl: string;
  category: string;
  price: number;
  discountPercentage?: number;
  description: string;
};

export type Category = {
  name: string;
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
