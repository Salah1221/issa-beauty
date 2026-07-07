import ProductCategory from "./ProductCategory";
import {
  type CarouselApi,
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/common/ui/components/carousel";
import { Card, CardContent, CardFooter } from "@/common/ui/components/card";
import { Skeleton } from "@/common/ui/components/skeleton";
import Autoplay from "embla-carousel-autoplay";
import React, { useCallback, useEffect, useState } from "react";
import {
  BannerImage,
  ProductsByCategory,
  getBannerImages,
  getProductsByCategory,
} from "@/features/products/data/products";
import { useNavigate } from "react-router-dom";
import { Button } from "@/common/ui/components/button";
import { ArrowRight } from "lucide-react";
import { ikUrl } from "@/common/utils/utils";
import issaBeautyImg from "@/assets/issa_beauty.png";
import Seo from "@/common/seo/Seo";

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
  const [carouselApi, setCarouselApi] = useState<CarouselApi>();
  const [currentSlide, setCurrentSlide] = useState(0);
  // Track the banner fetch separately so we can reserve its space while loading
  // instead of injecting the carousel late (which shoves the page down → CLS).
  const [bannerLoading, setBannerLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    getProductsByCategory(controller.signal).then((result) => {
      if (result.type === "success") setProductsByCategory(result.data);
      if (result.type !== "canceled") setIsLoading(false);
    });

    getBannerImages(controller.signal).then((result) => {
      if (result.type === "success") setBannerImages(result.data);
      if (result.type !== "canceled") setBannerLoading(false);
    });

    return () => controller.abort();
  }, []);

  const onCarouselSelect = useCallback((api: CarouselApi) => {
    if (!api) return;
    setCurrentSlide(api.selectedScrollSnap());
  }, []);

  useEffect(() => {
    if (!carouselApi) return;
    onCarouselSelect(carouselApi);
    carouselApi.on("select", onCarouselSelect);
    return () => {
      carouselApi.off("select", onCarouselSelect);
    };
  }, [carouselApi, onCarouselSelect]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <Seo
        title="Issa Beauty"
        description="Shop carefully curated beauty and skincare at Issa Beauty, Tripoli, Lebanon — makeup, skincare and more, with cash on delivery."
      />
      {bannerLoading ? (
        // Reserve the banner's height up front so the carousel doesn't push the
        // page down when it arrives. Mirrors the carousel's box exactly (p-1 pad
        // + rounded card + aspect-video) so the swap causes no shift.
        <div className="mt-8">
          <div className="p-1">
            <Skeleton className="w-full aspect-video rounded-lg" />
          </div>
        </div>
      ) : (
        bannerImages.length > 0 && (
          <div className="mt-8">
            <Carousel
              className="w-full aspect-video"
              setApi={setCarouselApi}
              plugins={[
                Autoplay({
                  delay: 5000,
                }),
              ]}
            >
              <CarouselContent>
                {bannerImages.map((bannerImage, index) => (
                  <CarouselItem className="w-full" key={bannerImage.imageUrl}>
                    <div className="p-1">
                      <Card className="overflow-hidden">
                        <CardContent className="aspect-video p-0">
                          <img
                            src={ikUrl(bannerImage.imageUrl, "w-800,q-80,f-auto")}
                            alt=""
                            fetchPriority={index === 0 ? "high" : undefined}
                            loading={index === 0 ? "eager" : "lazy"}
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
            {bannerImages.length > 1 && (
              <div className="flex justify-center gap-2 mt-3" role="tablist" aria-label="Carousel slides">
                {bannerImages.map((_, index) => (
                  <button
                    key={index}
                    role="tab"
                    aria-selected={index === currentSlide}
                    aria-label={`Go to slide ${index + 1}`}
                    onClick={() => carouselApi?.scrollTo(index)}
                    className="flex items-center justify-center py-2 px-1 min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-full"
                  >
                    <span
                      className={`h-1.5 rounded-full transition-all duration-300 ${
                        index === currentSlide
                          ? "w-6 bg-primary"
                          : "w-1.5 bg-muted-foreground/40 hover:bg-muted-foreground/70"
                      }`}
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        )
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
