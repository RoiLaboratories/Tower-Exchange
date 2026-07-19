"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useRouter, usePathname } from "next/navigation";

export default function PromotionalSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isVisible, setIsVisible] = useState(false);
  const [active, setActive] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);
  const [isDismissing, setIsDismissing] = useState(false);
  const [dismissedSlides, setDismissedSlides] = useState<string[]>([]);

  const slides = [
    {
      id: "cirbtc-trade",
      heroImage: "/assets/TradecircBTC.svg",
      imageWidthClass: "w-[100px]",
      title: "Trade $cirBTC on Tower",
      description: "cirBTC, Circle's wrapped Bitcoin backed 1:1 by real BTC, is now available for trading on Tower.",
      ctaText: "Trade cirBTC",
      action: () => {
        router.push("/?select=cirBTC");
        setTimeout(() => {
          const event = new CustomEvent("select-sell-token", { detail: { symbol: "cirBTC" } });
          window.dispatchEvent(event);
        }, 50);
      }
    },
    {
      id: "cirbtc-dca",
      heroImage: "/assets/DCAwithcirBTC.svg",
      imageWidthClass: "w-[125px]",
      title: "DCA with $cirBTC",
      description: "You can now automate $cirBTC purchases with Recurring Orders on Tower.",
      ctaText: "Try it Now",
      action: () => {
        router.push("/recurring-orders?tab=create-buy&payToken=cirBTC");
      }
    }
  ];

  const visibleSlides = slides.filter((slide) => !dismissedSlides.includes(slide.id));

  useEffect(() => {
    // Check if the user has already dismissed this promotion
    const legacyDismissed = localStorage.getItem("tower-cirbtc-promo-dismissed") === "true";
    if (legacyDismissed) {
      setDismissedSlides(slides.map((s) => s.id));
      return;
    }

    const dismissed: string[] = [];
    slides.forEach((slide) => {
      if (localStorage.getItem(`tower-promo-dismissed-${slide.id}`) === "true") {
        dismissed.push(slide.id);
      }
    });
    setDismissedSlides(dismissed);

    const allDismissed = slides.every((slide) => dismissed.includes(slide.id));
    if (!allDismissed) {
      setIsVisible(true);
      // Trigger the slide-in and fade-in transition after the element mounts
      const timer = setTimeout(() => {
        setActive(true);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, []);

  // Autoplay slideshow: changes slide every 5 seconds.
  // Re-creating the interval when activeSlide/isVisible changes resets the 5s timer upon manual interaction.
  useEffect(() => {
    if (!isVisible || isDismissing || visibleSlides.length <= 1) return;
    const interval = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % visibleSlides.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [isVisible, isDismissing, activeSlide, visibleSlides.length]);

  // Adjust active slide if it's out of bounds
  useEffect(() => {
    if (activeSlide >= visibleSlides.length && visibleSlides.length > 0) {
      setActiveSlide(visibleSlides.length - 1);
    }
  }, [activeSlide, visibleSlides.length]);

  const handleCloseSlide = (slideId: string) => {
    const remainingSlides = slides.filter(
      (slide) => !dismissedSlides.includes(slide.id) && slide.id !== slideId
    );

    if (remainingSlides.length === 0) {
      // Last slide closed: trigger whole-sidebar dismissal animation
      setActive(false);
      setIsDismissing(true);
      setTimeout(() => {
        setIsVisible(false);
        setDismissedSlides((prev) => {
          const next = [...prev, slideId];
          localStorage.setItem(`tower-promo-dismissed-${slideId}`, "true");
          return next;
        });
      }, 300);
    } else {
      // Just close this slide, update active slide if needed
      setDismissedSlides((prev) => {
        const next = [...prev, slideId];
        localStorage.setItem(`tower-promo-dismissed-${slideId}`, "true");
        return next;
      });

      const currentVisible = slides.filter((slide) => !dismissedSlides.includes(slide.id));
      const dismissedIndexInVisible = currentVisible.findIndex((s) => s.id === slideId);

      if (activeSlide >= remainingSlides.length) {
        setActiveSlide(remainingSlides.length - 1);
      } else if (activeSlide === dismissedIndexInVisible) {
        if (activeSlide > 0) {
          setActiveSlide(activeSlide - 1);
        }
      }
    }
  };

  const isTradePage = pathname === "/" || pathname === "/swap" || pathname === "/bridge";

  if (!isVisible || !isTradePage || visibleSlides.length === 0) return null;

  // Build CSS classes dynamically for the outer fixed positioning wrapper
  const outerWrapperClasses = [
    "promotional-sidebar",
    // Base/Mobile/Tablet layout: Inline/relative layout positioned below main page content
    "relative w-full max-w-md mx-auto z-[9999] p-4 flex flex-col font-inter transition-all duration-300 ease-out select-none",
    
    // Desktop layout: fixed on the bottom-right, 301px wide, floating above the footer
    "xl:fixed xl:bottom-24 xl:top-auto xl:right-6 xl:left-auto xl:w-[301px] xl:p-0 xl:max-w-none xl:mx-0",
    
    // Animation/Transition states for mount and dismiss
    active
      ? "opacity-100 translate-y-0 xl:translate-x-0"
      : "opacity-0 translate-y-4 xl:translate-x-5 max-xl:translate-y-full"
  ].join(" ");

  const cardStyle = {
    boxShadow: "0 10px 35px rgba(0,0,0,.45), inset 0 1px rgba(255,255,255,.04)"
  };

  return (
    <div
      className={outerWrapperClasses}
      role="complementary"
      aria-label="cirBTC Promotions"
    >
      {/* Cards Viewport: masks the horizontal sliding wrapper */}
      <div className="relative w-full h-[195px] xl:h-[335px] overflow-hidden rounded-2xl">
        
        {/* Sliding wrapper: moves the entire cards side by side */}
        <div
          className="flex h-full transition-transform duration-1000 ease-in-out"
          style={{ transform: `translateX(-${activeSlide * 100}%)` }}
        >
          {visibleSlides.map((slide) => (
            <div
              key={slide.id}
              className="relative w-full h-full bg-[#191A1C] border border-white/[0.08] p-4 flex flex-col justify-between rounded-2xl shrink-0"
              style={cardStyle}
            >
              {/* Close Button - specific to this card */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleCloseSlide(slide.id);
                }}
                className="absolute top-[10px] right-[10px] w-[30px] h-[30px] inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 text-gray-300 transition-colors hover:bg-white/10 hover:text-white z-10"
                aria-label="Close promotion"
              >
                <X size={16} />
              </button>

              {/* Horizontal row layout on mobile/tablet, vertical stack on desktop */}
              <div className="flex flex-row xl:flex-col gap-4 items-start w-full">
                {/* Hero Image Container */}
                <div className={`h-[100px] ${slide.imageWidthClass} xl:w-full xl:h-[140px] rounded-[12px] overflow-hidden select-none border border-white/[0.04] shrink-0`}>
                  <img
                    src={slide.heroImage}
                    alt={slide.title}
                    className="w-full h-full object-cover"
                  />
                </div>
                {/* Content text */}
                <div className="flex flex-col gap-1.5 flex-1 min-w-0 pr-8 xl:pr-0">
                  <h3 className="font-inter font-semibold text-[18px] leading-tight text-white m-0 tracking-tight">
                    {slide.title}
                  </h3>
                  <p className="text-[14px] leading-[1.3] text-white/72 m-0 mt-1 font-light">
                    {slide.description}
                  </p>
                </div>
              </div>
              {/* Button */}
              <button
                onClick={() => {
                  slide.action();
                  if (window.innerWidth < 1280) {
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }
                }}
                className="w-full h-10 mt-4 xl:mt-0 rounded-[999px] bg-[#74A8F4] hover:bg-[#8dc0ff] text-[#111111] font-inter font-semibold text-base flex items-center justify-center cursor-pointer border-none transition-all duration-[250ms] ease-in-out hover:-translate-y-[2px] active:translate-y-0 active:scale-[0.98] shadow-md"
              >
                {slide.ctaText}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Slide Indicators: positioned below and outside the card container */}
      {visibleSlides.length > 1 && (
        <div className="flex justify-end gap-1.5 mt-2 px-1">
          {visibleSlides.map((_, index) => (
            <button
              key={index}
              onClick={() => setActiveSlide(index)}
              className={`h-[5px] rounded-full transition-all duration-300 focus:outline-none cursor-pointer ${
                activeSlide === index ? "bg-white w-[28px]" : "bg-white/20 w-[14px] hover:bg-white/40"
              }`}
              aria-label={`Go to Slide ${index + 1}`}
              style={{ border: "none" }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
