import React, { useEffect, useRef, useState } from "react";
import { Card, CardFooter } from "@/common/ui/components/card";
import { Badge } from "@/common/ui/components/badge";
import { Link } from "react-router-dom";
import { ikUrl } from "@/common/utils/utils";

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
    <Card className="group relative flex h-full w-full flex-col overflow-hidden transition-shadow duration-200 hover:shadow-lg focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
      <div className="relative h-[200px] w-full overflow-hidden bg-muted">
        {!imageLoaded && (
          <div className="animate-pulse bg-muted absolute inset-0"></div>
        )}
        <img
          ref={imgRef}
          src={ikUrl(imageUrl, "w-600,q-80,f-auto")}
          alt={name}
          loading="lazy"
          className={`h-[200px] w-full object-cover transition-all duration-500 group-hover:scale-105 ${
            imageLoaded ? "opacity-100" : "opacity-0"
          }`}
          onLoad={() => setImageLoaded(true)}
          style={{ aspectRatio: 300 / 200 }}
        />
        {discountPercentage && (
          <Badge className="absolute top-2 right-2 shadow-sm">
            {discountPercentage}% OFF
          </Badge>
        )}
        <Badge className="absolute top-2 left-2 border-border bg-background/85 text-foreground shadow-sm backdrop-blur-sm">
          {category}
        </Badge>
      </div>
      <CardFooter className="flex w-full flex-1 flex-col items-start p-4">
        <Link
          to={`/products/${id}`}
          className="text-lg font-semibold transition-colors duration-200 outline-none after:absolute after:inset-0 after:rounded-xl group-hover:text-primary"
        >
          <span className="line-clamp-2">{name}</span>
        </Link>
        <div className="mt-auto flex w-full items-end justify-between pt-3">
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
