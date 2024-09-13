import { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { homeLoader, HomeLoaderData, Product } from "./utilities";
import axios from "axios";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Copy, ArrowLeft, CircleCheck } from "lucide-react";
import ProductCategory from "./ProductCategory";
import { SkeletonProductCategory } from "./Home";

const ProductPage = () => {
  const { productId } = useParams<{ productId: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [productsByCategory, setProductsByCategory] = useState<HomeLoaderData>(
    {}
  );
  const [imgLoaded, setImgLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [urlCopied, setUrlCopied] = useState(false);
  const navigate = useNavigate();

  const fetchProduct = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/products/${productId}`);
      const data = response.data;
      if (!data.success) throw new Error("Error in server");
      setProduct(data.data);
    } catch (error) {
      console.error("Error fetching product:", error);
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    if (productId) {
      fetchProduct();
    }
  }, [productId, fetchProduct]);

  useEffect(() => {
    homeLoader().then((data) => {
      setProductsByCategory(data);
    });
  });

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(window.location.href);
    setUrlCopied(true);
    setTimeout(() => setUrlCopied(false), 2000);
  };

  const handleWhatsAppShare = () => {
    const url = encodeURIComponent(window.location.href);
    window.open(`https://wa.me/?text=${url}`, "_blank");
  };

  const handleFacebookShare = () => {
    const url = encodeURIComponent(window.location.href);
    window.open(
      `https://www.facebook.com/messages/t/your-facebook-page-id?text=${url}`,
      "_blank"
    );
  };

  const handleReturn = () => {
    navigate(-1);
  };

  const handleImageLoad = () => {
    setImgLoaded(true);
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Button onClick={handleReturn} variant="ghost" className="mt-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-40 my-8">
          <Skeleton className="w-full" style={{ aspectRatio: 1 }} />
          <div className="space-y-4 self-center">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-7 w-1/4" />
            <div className="flex flex-wrap gap-2 mt-4">
              <Skeleton className="h-9 w-[123px]" />
              <Skeleton className="h-9 w-[190px]" />
              <Skeleton className="h-9 w-[190px]" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Button onClick={handleReturn} variant="ghost" className="mt-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <h1 className="text-2xl font-bold my-8">Product not found</h1>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <Button onClick={handleReturn} variant="ghost" className="mt-4">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back
      </Button>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-40 my-8">
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            {imgLoaded ? (
              <img
                src={product.imageUrl}
                alt={product.name}
                className="w-full h-auto object-cover"
                style={{ aspectRatio: 1 }}
                onLoad={handleImageLoad}
              />
            ) : (
              <Skeleton className="w-full h-auto" style={{ aspectRatio: 1 }} />
            )}
          </CardContent>
        </Card>
        <div className="space-y-4 self-center">
          <h1 className="text-3xl md:text-5xl font-bold">{product.name}</h1>
          <Badge variant="secondary">{product.category}</Badge>
          <p className="text-muted-foreground">{product.description}</p>
          <div className="text-2xl md:text-3xl font-bold">
            ${product.price.toFixed(2)}
            {product.discountPercentage && product.discountPercentage > 0 && (
              <span className="ml-2 text-sm line-through text-gray-500">
                $
                {(
                  product.price /
                  (1 - product.discountPercentage / 100)
                ).toFixed(2)}
              </span>
            )}
          </div>
          {product.discountPercentage && product.discountPercentage > 0 && (
            <Badge className="font-bold">
              {product.discountPercentage}% OFF
            </Badge>
          )}
          <div className="flex flex-wrap gap-2 mt-4">
            <Button onClick={handleCopyUrl} variant="outline">
              {!urlCopied ? (
                <>
                  <Copy className="mr-2 h-4 w-4" />
                  Copy URL
                </>
              ) : (
                <>
                  <CircleCheck className="mr-2 h-4 w-4" />
                  Copied
                </>
              )}
            </Button>
            <Button onClick={handleWhatsAppShare} variant="outline">
              <svg
                role="img"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
                className="mr-2 h-4 w-4"
              >
                <title>WhatsApp</title>
                <path
                  d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"
                  fill="hsl(var(--foreground))"
                />
              </svg>
              Share on WhatsApp
            </Button>
            <Button onClick={handleFacebookShare} variant="outline">
              <svg
                role="img"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
                className="mr-2 h-4 w-4"
              >
                <title>Messenger</title>
                <path
                  d="M.001 11.639C.001 4.949 5.241 0 12.001 0S24 4.95 24 11.639c0 6.689-5.24 11.638-12 11.638-1.21 0-2.38-.16-3.47-.46a.96.96 0 00-.64.05l-2.39 1.05a.96.96 0 01-1.35-.85l-.07-2.14a.97.97 0 00-.32-.68A11.39 11.389 0 01.002 11.64zm8.32-2.19l-3.52 5.6c-.35.53.32 1.139.82.75l3.79-2.87c.26-.2.6-.2.87 0l2.8 2.1c.84.63 2.04.4 2.6-.48l3.52-5.6c.35-.53-.32-1.13-.82-.75l-3.79 2.87c-.25.2-.6.2-.86 0l-2.8-2.1a1.8 1.8 0 00-2.61.48z"
                  fill="hsl(var(--foreground))"
                />
              </svg>
              Share on Messenger
            </Button>
          </div>
        </div>
      </div>
      {productsByCategory[`${product.category}`] ? (
        <ProductCategory
          title={`Similar Products`}
          products={productsByCategory[`${product.category}`]}
          onMoreClick={() => {}}
        />
      ) : (
        <SkeletonProductCategory />
      )}
    </div>
  );
};

export default ProductPage;
