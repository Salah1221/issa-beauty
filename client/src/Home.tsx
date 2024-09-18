import ProductCategory from "./ProductCategory";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import Autoplay from "embla-carousel-autoplay";
import React, { useEffect, useState } from "react";
import {
  BannerImage,
  HomeLoaderData,
  bannerImagesLoader,
  homeLoader,
} from "./utilities";
import { useNavigate } from "react-router-dom";
import { Button } from "./components/ui/button";
import { ArrowRight } from "lucide-react";

export const SkeletonProductCategory = () => (
  <div className="my-8">
    <Skeleton className="h-8 w-1/4 mb-4" />
    <div className="relative">
      <div className="flex overflow-x-auto space-x-4 pb-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <Card key={index} className="flex-shrink-0">
            <Skeleton
              className="w-full h-[200px] mb-4 rounded-b-none"
              style={{ aspectRatio: 300 / 200 }}
            />
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
              src="src/assets/issa_beauty.png"
              alt="Product collage"
              className="rounded-lg"
            />
          </div>
        </div>
      </div>
    </Card>
  );
};

const Home: React.FC = () => {
  const [productsByCategory, setProductsByCategory] = useState<HomeLoaderData>(
    {}
  );
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const [bannerImages, setBannerImages] = useState<BannerImage[]>([]);

  useEffect(() => {
    homeLoader().then((data) => {
      setProductsByCategory(data);
      if (data) setIsLoading(false);
    });

    bannerImagesLoader().then((data) => {
      setBannerImages(data);
    });
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <Carousel
        className="w-full mt-8 aspect-video"
        plugins={[
          Autoplay({
            delay: 2000,
          }),
        ]}
      >
        <CarouselContent>
          {bannerImages.map((bannerImage, index) => (
            <CarouselItem className="w-full" key={index}>
              <div className="p-1">
                <Card className="overflow-hidden">
                  <CardContent className="aspect-video p-0">
                    <img
                      src={bannerImage.imageUrl}
                      alt=""
                      className="object-cover w-full h-full"
                    />
                  </CardContent>
                </Card>
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        <div className="absolute top-1/2 -translate-y-1/2 left-20 hidden sm:block">
          <CarouselPrevious />
        </div>
        <div className="absolute top-1/2 -translate-y-1/2 right-20 hidden sm:block">
          <CarouselNext />
        </div>
      </Carousel>
      <AllProductsSection />
      {isLoading ? (
        <>
          <SkeletonProductCategory />
          <SkeletonProductCategory />
          <SkeletonProductCategory />
        </>
      ) : (
        Object.entries(productsByCategory).map(([category, products], i) => (
          <ProductCategory
            key={i}
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
