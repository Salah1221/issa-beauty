import mongoose from "mongoose";

const { Schema, model } = mongoose;

// Define the Product schema
const productSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
      required: true,
    },
    discountPercentage: {
      type: Number,
      required: false,
    },
    imageUrl: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    inStock: {
      type: Boolean,
      required: false,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Define the Category schema
const categorySchema = new Schema(
  {
    name: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const BannerImgSchema = new Schema(
  {
    imageUrl: {
      type: String,
      required: true,
    },
    imageFileId: {
      type: String,
      required: false,
    },
  },
  {
    timestamps: true,
  }
);

// Create models for Product and Category
const Product = model("Product", productSchema);
const Category = model("Category", categorySchema);
const BannerImg = model("BannerImg", BannerImgSchema, "bannerImages");

// Export the models
export { Product, Category, BannerImg };
