import mongoose from "mongoose";
import { Product } from "./models.js";

export const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.DB_URI);
    console.log("Connected to MongoDB " + conn.connection.host);
    // await Product.deleteMany({});
  } catch (e) {
    console.error("Error connecting to MongoDB");
    console.error(e);
    process.exit(1);
  }
};
