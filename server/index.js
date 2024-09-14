import { Category, Product } from "./models.js";
import express from "express";
import dotenv from "dotenv";
import { connectDB } from "./db.js";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
import fs from "fs";

const getAllCategories = async () => {
  return await Category.find();
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// if (process.env.NODE_ENV !== "production") {
//   dotenv.config({ path: path.resolve(__dirname, "../.env") });
// }

const app = express();
app.use(express.json());

const deleteImage = (imageUrl) => {
  const imagePath = path.join(__dirname, "uploads", path.basename(imageUrl));
  if (!fs.existsSync(imagePath)) {
    return;
  }
  fs.unlink(imagePath, (err) => {
    if (err) {
      console.error(err);
    }
  });
};

const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({ storage: storage });

app.post("/api/upload", upload.single("image"), (req, res) => {
  if (!req.file) {
    return res
      .status(400)
      .json({ success: false, message: "No file uploaded" });
  }
  res
    .status(201)
    .json({ success: true, imageUrl: `/uploads/${req.file.filename}` });
});

app.use(express.static(path.join(__dirname, "uploads")));

app.get("/api/products", async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;
  const search = req.query.search || "";
  const category = req.query.category || "";
  const sortOrder = req.query.sort || "newest";

  try {
    let query = {};
    if (search) {
      query = {
        $or: [
          { name: { $regex: search, $options: "i" } },
          { description: { $regex: search, $options: "i" } },
          { category: { $regex: search, $options: "i" } },
        ],
      };
    }

    if (category && category !== "all") {
      query.category = category;
    }

    let sort = { createdAt: -1 }; // Default to newest first
    if (sortOrder === "oldest") {
      sort = { createdAt: 1 };
    }

    const products = await Product.find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit);
    const total = await Product.countDocuments(query);

    res.status(200).json({
      success: true,
      data: products,
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get("/api/products-by-category", async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    const productsByCategory = {};

    products.forEach((product) => {
      if (!productsByCategory[product.category]) {
        productsByCategory[product.category] = [];
      }
      if (productsByCategory[product.category].length < 8) {
        productsByCategory[product.category].push(product);
      }
    });

    res.status(200).json({
      success: true,
      data: productsByCategory,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get("/api/products/:id", async (req, res) => {
  const id = req.params.id;
  try {
    const product = await Product.findById(id);
    res.status(201).json({ success: true, data: product });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

app.get("/api/categories", async (req, res) => {
  try {
    const categories = await getAllCategories();
    res.status(200).json({ success: true, data: categories });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

const PORT = process.env.PORT || 5173;

if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../client/dist")));

  app.get("*", (_, res) => {
    res.sendFile(path.resolve(__dirname, "../client/dist", "index.html"));
  });
}

connectDB().then(() => {
  app.listen(PORT, () => {});
});

module.exports = app;
