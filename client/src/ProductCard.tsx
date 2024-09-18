import React, { useState } from "react";
import { Card, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";

type ProductCardProps = {
  id: string;
  name: string;
  price: number;
  imageUrl: string;
  discountPercentage?: number;
  category: string;
  in_stock?: boolean;
};

const ProductCard: React.FC<ProductCardProps> = ({
  id,
  name,
  price,
  imageUrl,
  discountPercentage,
  category,
  in_stock,
}) => {
  const [imageLoaded, setImageLoaded] = useState(false);

  if (discountPercentage === 0) discountPercentage = undefined;
  const discountedPrice =
    discountPercentage && discountPercentage > 0
      ? price * (1 - discountPercentage / 100)
      : null;

  return (
    <Card className="sm:max-w-[300px] overflow-hidden w-full sm:w-auto">
      <div className="relative">
        {!imageLoaded && (
          <div
            className="animate-pulse bg-muted h-[200px] w-full"
            style={{ aspectRatio: 300 / 200 }}
          ></div>
        )}
        <img
          src={imageUrl}
          alt={name}
          className={`h-[200px] w-full object-cover transition-opacity duration-500 ${
            imageLoaded ? "opacity-100" : "opacity-0"
          } ${imageLoaded ? "" : "hidden"}`}
          onLoad={() => setImageLoaded(true)}
          style={{ aspectRatio: 300 / 200 }}
        />
        {discountPercentage && (
          <Badge className="absolute top-2 right-2">
            {discountPercentage}% OFF
          </Badge>
        )}
        <Badge className="absolute top-2 left-2 bg-background text-foreground">
          {category}
        </Badge>
      </div>
      <CardFooter className="p-4 flex flex-col items-start">
        <Link
          to={`/products/${id}`}
          className="text-lg font-semibold hover:text-primary hover:underline transition-all duration-200"
        >
          {name}
        </Link>
        <div className="mt-2 flex justify-between items-end w-full">
          <div className="">
            {discountedPrice ? (
              <div className="flex items-center">
                <span className="text-lg font-bold">
                  ${discountedPrice.toFixed(2)}
                </span>
                <span className="ml-2 text-sm line-through text-gray-500">
                  ${price.toFixed(2)}
                </span>
              </div>
            ) : (
              <span className="text-lg font-bold">${price.toFixed(2)}</span>
            )}
          </div>
          {in_stock !== undefined && !in_stock && (
            <Badge variant="destructive">Out of stock</Badge>
          )}
        </div>
      </CardFooter>
    </Card>
  );
};

export default ProductCard;
