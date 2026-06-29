import { BannerImg, Category, Product } from "./models/models.js";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
import fs from "fs";

const getAllCategories = async () => {
  return await Category.find();
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
  const minPrice = parseFloat(req.query.minPrice);
  const maxPrice = parseFloat(req.query.maxPrice);

  try {
    const match = {};
    if (search) {
      match.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { category: { $regex: search, $options: "i" } },
      ];
    }

    if (category && category !== "all") {
      match.category = category;
    }

    // Price after discount, used for both filtering and sorting.
    const finalPrice = {
      $multiply: [
        "$price",
        {
          $subtract: [
            1,
            { $divide: [{ $ifNull: ["$discountPercentage", 0] }, 100] },
          ],
        },
      ],
    };

    const priceMatch = {};
    if (!Number.isNaN(minPrice)) priceMatch.$gte = minPrice;
    if (!Number.isNaN(maxPrice)) priceMatch.$lte = maxPrice;

    // Sort by createdAt or by the discounted price; _id keeps paging stable on ties.
    let sort = { createdAt: -1, _id: -1 }; // Default to newest first
    if (sortOrder === "oldest") sort = { createdAt: 1, _id: 1 };
    else if (sortOrder === "price-asc") sort = { finalPrice: 1, _id: 1 };
    else if (sortOrder === "price-desc") sort = { finalPrice: -1, _id: -1 };

    const pipeline = [
      { $match: match },
      { $addFields: { finalPrice } },
    ];
    if (Object.keys(priceMatch).length) {
      pipeline.push({ $match: { finalPrice: priceMatch } });
    }
    pipeline.push({
      $facet: {
        data: [{ $sort: sort }, { $skip: skip }, { $limit: limit }],
        totalCount: [{ $count: "count" }],
      },
    });

    const [result] = await Product.aggregate(pipeline);
    const products = result.data;
    const total = result.totalCount[0]?.count || 0;

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

// Min/max discounted price for the current search + category, so the price
// slider can auto-scale to the catalog instead of using fixed buckets.
app.get("/api/products-price-range", async (req, res) => {
  const search = req.query.search || "";
  const category = req.query.category || "";

  try {
    const match = {};
    if (search) {
      match.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { category: { $regex: search, $options: "i" } },
      ];
    }
    if (category && category !== "all") {
      match.category = category;
    }

    const finalPrice = {
      $multiply: [
        "$price",
        {
          $subtract: [
            1,
            { $divide: [{ $ifNull: ["$discountPercentage", 0] }, 100] },
          ],
        },
      ],
    };

    const [result] = await Product.aggregate([
      { $match: match },
      { $group: { _id: null, min: { $min: finalPrice }, max: { $max: finalPrice } } },
    ]);

    res.status(200).json({
      success: true,
      min: result?.min ?? 0,
      max: result?.max ?? 0,
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

app.get("/api/banner-images", async (req, res) => {
  try {
    const bannerImages = await BannerImg.find();

    res.status(200).json({ success: true, data: bannerImages });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../client/dist")));

  app.get("*", (_, res) => {
    res.sendFile(path.resolve(__dirname, "../client/dist", "index.html"));
  });
}

export default app;
