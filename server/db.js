import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

export const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB " + conn.connection.host);
  } catch (e) {
    console.error("Error connecting to MongoDB");
    console.error(e);
    process.exit(1);
  }
};
