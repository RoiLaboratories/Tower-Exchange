"use client";

import Image, { type ImageProps, type StaticImageData } from "next/image";
import { useSyncExternalStore } from "react";

type ThemeAwareImageProps = Omit<ImageProps, "src"> & {
  darkSrc: string | StaticImageData;
  lightSrc: string | StaticImageData;
};

function subscribeThemeClass(onStoreChange: () => void) {
  const observer = new MutationObserver(onStoreChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
  return () => observer.disconnect();
}

function getThemeClassSnapshot(): "light" | "dark" {
  return document.documentElement.classList.contains("light") ? "light" : "dark";
}

function getServerSnapshot(): "light" | "dark" {
  return "dark";
}

export default function ThemeAwareImage({
  darkSrc,
  lightSrc,
  ...props
}: ThemeAwareImageProps) {
  const theme = useSyncExternalStore(
    subscribeThemeClass,
    getThemeClassSnapshot,
    getServerSnapshot,
  );

  return <Image {...props} src={theme === "light" ? lightSrc : darkSrc} />;
}
