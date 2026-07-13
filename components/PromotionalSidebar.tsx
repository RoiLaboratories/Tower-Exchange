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

  useEffect(() => {
    // Check if the user has already dismissed this promotion
    const isDismissed = localStorage.getItem("tower-cirbtc-promo-dismissed");
    if (!isDismissed) {
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
    if (!isVisible || isDismissing) return;
    const interval = setInterval(() => {
      setActiveSlide((prev) => (prev === 0 ? 1 : 0));
    }, 5000);
    return () => clearInterval(interval);
  }, [isVisible, isDismissing, activeSlide]);

  const handleClose = () => {
    setActive(false);
    setIsDismissing(true);
    // Wait for the transition to finish before removing from the DOM
    setTimeout(() => {
      setIsVisible(false);
      localStorage.setItem("tower-cirbtc-promo-dismissed", "true");
    }, 300);
  };

  const slides = [
    {
      id: "cirbtc-trade",
      heroImage: "/assets/TradecircBTC.svg",
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
      title: "DCA with $cirBTC",
      description: "You can now automate $cirBTC purchases with Recurring Orders on Tower.",
      ctaText: "Try it Now",
      action: () => {
        window.location.href = "/recurring-orders";
      }
    }
  ];

  const isTradePage = pathname === "/" || pathname === "/swap" || pathname === "/bridge";

  if (!isVisible || !isTradePage) return null;

  // Build CSS classes dynamically for the outer fixed positioning wrapper
  const outerWrapperClasses = [
    // Base/Mobile layout: Bottom-aligned layout with side padding
    "fixed bottom-0 left-0 right-0 w-full z-[9999] p-4 flex flex-col font-inter transition-all duration-300 ease-out select-none",
    
    // Tablet layout: fixed on the bottom-right, 240px wide, floating above the footer
    "sm:bottom-24 sm:top-auto sm:right-6 sm:left-auto sm:w-[240px] sm:p-0",
    
    // Desktop layout: 301px wide
    "lg:w-[301px]",
    
    // Animation/Transition states for mount and dismiss
    active
      ? "opacity-100 translate-y-0 sm:translate-x-0"
      : "opacity-0 translate-y-4 sm:translate-x-5 max-sm:translate-y-full"
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
      {/* Mobile-only swipe/drag indicator bar sitting above the cards */}
      <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mb-2 block sm:hidden" />

      {/* Cards Viewport: masks the horizontal sliding wrapper */}
      <div className="relative w-full h-[335px] overflow-hidden rounded-2xl">
        
        {/* Sliding wrapper: moves the entire cards side by side */}
        <div
          className="flex w-[200%] h-full transition-transform duration-1000 ease-in-out"
          style={{ transform: `translateX(-${activeSlide * 50}%)` }}
        >
          {/* Card 0: Trade cirBTC */}
          <div
            className="w-1/2 h-full bg-[#171513] border border-white/[0.08] p-4 flex flex-col justify-between rounded-2xl shrink-0"
            style={cardStyle}
          >
            {/* Hero Image Container */}
            <div className="w-full h-[140px] rounded-[12px] overflow-hidden select-none border border-white/[0.04]">
              <img
                src={slides[0].heroImage}
                alt={slides[0].title}
                className="w-full h-full object-cover"
              />
            </div>
            {/* Content text */}
            <div className="flex flex-col gap-1.5 mt-2 flex-1">
              <h3 className="font-inter font-semibold text-[18px] leading-tight text-white m-0 mt-1 tracking-tight">
                {slides[0].title}
              </h3>
              <p className="text-[14px] leading-[1.3] text-white/72 m-0 mt-2 font-light">
                {slides[0].description}
              </p>
            </div>
            {/* Button */}
            <button
              onClick={slides[0].action}
              className="w-full h-10 rounded-[999px] bg-[#74A8F4] hover:bg-[#8dc0ff] text-[#111111] font-inter font-semibold text-base flex items-center justify-center cursor-pointer border-none transition-all duration-[250ms] ease-in-out hover:-translate-y-[2px] active:translate-y-0 active:scale-[0.98] shadow-md"
            >
              {slides[0].ctaText}
            </button>
          </div>

          {/* Card 1: DCA with cirBTC */}
          <div
            className="w-1/2 h-full bg-[#171513] border border-white/[0.08] p-4 flex flex-col justify-between rounded-2xl shrink-0"
            style={cardStyle}
          >
            {/* Hero Image Container */}
            <div className="w-full h-[140px] rounded-[12px] overflow-hidden select-none border border-white/[0.04]">
              <img
                src={slides[1].heroImage}
                alt={slides[1].title}
                className="w-full h-full object-cover"
              />
            </div>
            {/* Content text */}
            <div className="flex flex-col gap-1.5 mt-2 flex-1">
              <h3 className="font-inter font-semibold text-[18px] leading-tight text-white m-0 mt-1 tracking-tight">
                {slides[1].title}
              </h3>
              <p className="text-[14px] leading-[1.3] text-white/72 m-0 mt-2 font-light">
                {slides[1].description}
              </p>
            </div>
            {/* Button */}
            <button
              onClick={slides[1].action}
              className="w-full h-10 rounded-[999px] bg-[#74A8F4] hover:bg-[#8dc0ff] text-[#111111] font-inter font-semibold text-base flex items-center justify-center cursor-pointer border-none transition-all duration-[250ms] ease-in-out hover:-translate-y-[2px] active:translate-y-0 active:scale-[0.98] shadow-md"
            >
              {slides[1].ctaText}
            </button>
          </div>
        </div>

        {/* Static Close Button - overlays on top-right of active card's hero container */}
        <button
          onClick={handleClose}
          className="absolute top-[26px] right-[26px] w-[30px] h-[30px] inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 text-gray-300 transition-colors hover:bg-white/10 hover:text-white"
          aria-label="Close promotion"
        >
          <X size={16} />
        </button>
      </div>

      {/* Slide Indicators: positioned below and outside the card container */}
      <div className="flex justify-end gap-1.5 mt-2 px-1">
        <button
          onClick={() => setActiveSlide(0)}
          className={`h-[5px] rounded-full transition-all duration-300 focus:outline-none cursor-pointer ${
            activeSlide === 0 ? "bg-white w-[28px]" : "bg-white/20 w-[14px] hover:bg-white/40"
          }`}
          aria-label="Go to Slide 1"
          style={{ border: "none" }}
        />
        <button
          onClick={() => setActiveSlide(1)}
          className={`h-[5px] rounded-full transition-all duration-300 focus:outline-none cursor-pointer ${
            activeSlide === 1 ? "bg-white w-[28px]" : "bg-white/20 w-[14px] hover:bg-white/40"
          }`}
          aria-label="Go to Slide 2"
          style={{ border: "none" }}
        />
      </div>
    </div>
  );
}
