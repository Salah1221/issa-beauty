import React from "react";
import { Button } from "@/common/ui/components/button";
import ProductCard from "./ProductCard";
import { Product } from "@/features/products/data/products";

type ProductCategoryProps = {
  title: string;
  products: Product[];
  onMoreClick: () => void;
};

const ProductCategory: React.FC<ProductCategoryProps> = ({
  title,
  products,
  onMoreClick,
}) => {
  return (
    <div className="my-8">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">{title}</h2>
        <Button variant="outline" onClick={onMoreClick}>
          More
        </Button>
      </div>
      {/* Horizontal strip: the partially-visible next card cues scrollability. */}
      <div className="flex overflow-x-auto pb-4 -mx-4 px-4">
        <div className="flex space-x-4 horizontal-container">
          {products.map((product) => (
            <div key={product._id} className="flex-none w-[260px] sm:w-[280px]">
              <ProductCard
                id={product._id}
                name={product.name}
                imageUrl={product.imageUrl}
                price={product.price}
                discountPercentage={product.discountPercentage}
                category={product.category}
                in_stock={product.in_stock}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ProductCategory;
