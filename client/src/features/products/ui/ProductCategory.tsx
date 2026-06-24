import React from "react";
import { Button } from "@/components/ui/button";
import ProductCard from "./ProductCard";
import { Product } from "./utilities";

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
      <div className="relative">
        <div className="flex overflow-x-auto pb-4 -mx-4 px-4">
          <div className="flex space-x-4 horizontal-container">
            {products.map((product, i) => (
              <div key={i} className="flex-none">
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
    </div>
  );
};

export default ProductCategory;
