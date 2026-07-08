import { useCallback, useEffect, useState } from "react";
import {
  type CarouselApi,
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/common/ui/components/carousel";
import { Card, CardContent } from "@/common/ui/components/card";
import Autoplay from "embla-carousel-autoplay";
import { ikUrl } from "@/common/utils/utils";
import { BannerImage } from "@/features/products/data/products";

// Extracted from Home and lazy-loaded so embla-carousel + autoplay stay out of
// the critical landing-page bundle; only fetched when banner images exist.
export default function BannerCarousel({ images }: { images: BannerImage[] }) {
  const [carouselApi, setCarouselApi] = useState<CarouselApi>();
  const [currentSlide, setCurrentSlide] = useState(0);

  const onSelect = useCallback((api: CarouselApi) => {
    if (!api) return;
    setCurrentSlide(api.selectedScrollSnap());
  }, []);

  useEffect(() => {
    if (!carouselApi) return;
    onSelect(carouselApi);
    carouselApi.on("select", onSelect);
    return () => {
      carouselApi.off("select", onSelect);
    };
  }, [carouselApi, onSelect]);

  return (
    <div className="mt-8">
      <Carousel
        className="w-full aspect-video"
        setApi={setCarouselApi}
        plugins={[Autoplay({ delay: 5000 })]}
      >
        <CarouselContent>
          {images.map((bannerImage, index) => (
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
      {images.length > 1 && (
        <div
          className="flex justify-center gap-2 mt-3"
          role="tablist"
          aria-label="Carousel slides"
        >
          {images.map((_, index) => (
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
  );
}
