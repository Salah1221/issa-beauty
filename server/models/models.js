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
    in_stock: {
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

const orderItemSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    name: { type: String, required: true },
    unitPrice: { type: Number, required: true },
    discountPercentage: { type: Number, default: 0 },
    quantity: { type: Number, required: true, min: 1 },
    lineTotal: { type: Number, required: true },
    imageUrl: { type: String, required: true },
  },
  { _id: false }
);

const orderSchema = new Schema(
  {
    orderNumber: { type: String, required: true, unique: true },
    items: { type: [orderItemSchema], required: true },
    subtotal: { type: Number, required: true },
    deliveryFee: { type: Number, required: true, default: 3 },
    total: { type: Number, required: true },
    customer: {
      fullName: { type: String, required: true },
      phone: { type: String, required: true },
      email: { type: String, required: false },
    },
    shipping: {
      address: { type: String, required: true },
      city: { type: String, required: true },
      area: { type: String, required: false },
      notes: { type: String, required: false },
    },
    paymentMethod: { type: String, required: true, default: "cod" },
    status: {
      type: String,
      enum: ["pending", "confirmed", "delivered", "cancelled"],
      default: "pending",
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: false,
      default: null,
    },
  },
  { timestamps: true }
);

// Create models for Product and Category
const Product = model("Product", productSchema);
const Category = model("Category", categorySchema);
const BannerImg = model("BannerImg", BannerImgSchema, "bannerImages");
const Order = model("Order", orderSchema, "orders");

// Export the models
export { Product, Category, BannerImg, Order };
