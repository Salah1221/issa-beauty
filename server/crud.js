import { Product, Category } from "./models.js";

// CRUD operations for Product

// Create a new product
export async function createProduct(productData) {
  const product = new Product(productData);
  await product.save();
  return product;
}

// Read a product by ID
export async function getAllProducts() {
  return await Product.find();
}

// Update a product by ID
export async function updateProduct(productId, updateData) {
  return await Product.findByIdAndUpdate(productId, updateData, { new: true });
}

// Delete a product by ID
export async function deleteProduct(productId) {
  return await Product.findByIdAndDelete(productId);
}

// CRUD operations for Category

// Create a new category
export async function createCategory(categoryData) {
  const category = new Category(categoryData);
  await category.save();
  return category;
}

// Read a category by ID

// Update a category by ID
export async function updateCategory(categoryId, updateData) {
  return await Category.findByIdAndUpdate(categoryId, updateData, {
    new: true,
  });
}

// Delete a category by ID
export async function deleteCategory(categoryId) {
  return await Category.findByIdAndDelete(categoryId);
}
