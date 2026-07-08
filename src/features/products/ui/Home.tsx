import ProductCategory from "./ProductCategory";
import { Card, CardFooter } from "@/common/ui/components/card";
import { Skeleton } from "@/common/ui/components/skeleton";
import React, { Suspense, useEffect, useState } from "react";
import {
  BannerImage,
  ProductsByCategory,
  getBannerImages,
  getProductsByCategory,
} from "@/features/products/data/products";
import { useNavigate } from "react-router-dom";
import { Button } from "@/common/ui/components/button";
import { ArrowRight } from "lucide-react";
import issaBeautyImg from "@/assets/issa_beauty.png";
import Seo from "@/common/seo/Seo";

// Lazy so embla-carousel is only fetched when banners actually exist (this shop
// currently has none), keeping it out of the critical landing-page bundle.
const BannerCarousel = React.lazy(() => import("./BannerCarousel"));

export const SkeletonProductCategory = () => (
  <div className="my-8">
    <Skeleton className="h-8 w-1/4 mb-4" />
    <div className="relative">
      <div className="flex overflow-x-auto space-x-4 pb-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <Card
            key={index}
            className="flex-shrink-0 w-[260px] sm:w-[280px] overflow-hidden"
          >
            <Skeleton className="w-full h-[200px] mb-4 rounded-none" />
            <CardFooter className="p-4 flex flex-col items-start">
              <Skeleton className="h-4 w-3/4 mb-4" />
              <Skeleton className="h-4 w-1/2" />
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  </div>
);

const AllProductsSection: React.FC = () => {
  const navigate = useNavigate();

  return (
    <Card className="my-12 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-10 lg:py-12 flex items-center justify-between">
        <div>
          <h2 className="text-xl md:text-3xl font-bold text-foreground mb-2">
            Explore Our Full Catalog
          </h2>
          <p className="text-sm md:text-base text-foreground/80 mb-4">
            Discover all our amazing products in one place
          </p>
          <Button
            variant="default"
            size="lg"
            onClick={() => navigate("/products")}
            className="font-semibold"
          >
            View All Products
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
        <div className="hidden lg:block relative">
          <div className="absolute top-1/2 -translate-y-1/2 right-[-50px] w-[400px] aspect-square">
            <img
              src={issaBeautyImg}
              alt="Product collage"
              loading="lazy"
              className="rounded-lg"
            />
          </div>
        </div>
      </div>
    </Card>
  );
};

const Home: React.FC = () => {
  const [productsByCategory, setProductsByCategory] =
    useState<ProductsByCategory>({});
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const [bannerImages, setBannerImages] = useState<BannerImage[]>([]);

  useEffect(() => {
    const controller = new AbortController();

    getProductsByCategory(controller.signal).then((result) => {
      if (result.type === "success") setProductsByCategory(result.data);
      if (result.type !== "canceled") setIsLoading(false);
    });

    getBannerImages(controller.signal).then((result) => {
      if (result.type === "success") setBannerImages(result.data);
    });

    return () => controller.abort();
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <Seo
        title="Issa Beauty"
        description="Shop carefully curated beauty and skincare at Issa Beauty, Tripoli, Lebanon — makeup, skincare and more, with cash on delivery."
      />
      {bannerImages.length > 0 && (
        <Suspense fallback={null}>
          <BannerCarousel images={bannerImages} />
        </Suspense>
      )}
      <AllProductsSection />
      {isLoading ? (
        <>
          <SkeletonProductCategory />
          <SkeletonProductCategory />
          <SkeletonProductCategory />
        </>
      ) : (
        Object.entries(productsByCategory).map(([category, products]) => (
          <ProductCategory
            key={category}
            title={category}
            products={products}
            onMoreClick={() => navigate(`/products?category=${category}`)}
          />
        ))
      )}
    </div>
  );
};

export default Home;
