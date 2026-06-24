import React, { useEffect, useRef, useState } from "react";
import { Card, CardFooter } from "@/common/ui/components/card";
import { Badge } from "@/common/ui/components/badge";
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
  const imgRef = useRef<HTMLImageElement>(null);

  // A cached image can finish loading before React attaches onLoad, so the
  // event never fires. Reconcile against the element's actual state on mount.
  useEffect(() => {
    if (imgRef.current?.complete) setImageLoaded(true);
  }, []);

  if (discountPercentage === 0) discountPercentage = undefined;
  const discountedPrice =
    discountPercentage && discountPercentage > 0
      ? price * (1 - discountPercentage / 100)
      : null;

  return (
    <Card className="sm:max-w-[300px] overflow-hidden w-full sm:w-auto">
      <div className="relative h-[200px] w-full">
        {!imageLoaded && (
          <div className="animate-pulse bg-muted absolute inset-0"></div>
        )}
        <img
          ref={imgRef}
          src={imageUrl}
          alt={name}
          loading="lazy"
          className={`h-[200px] w-full object-cover transition-opacity duration-500 ${
            imageLoaded ? "opacity-100" : "opacity-0"
          }`}
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
