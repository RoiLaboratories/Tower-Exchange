"use client";

import { summarizeAppErrorMessage } from "@/lib/error-display";
import { cn } from "@/lib/utils";

type ErrorBadgeProps = {
  message: string | null | undefined;
  fallback?: string;
  centered?: boolean;
  className?: string;
};

export function ErrorBadge({
  message,
  fallback = "Something went wrong.",
  centered = false,
  className,
}: ErrorBadgeProps) {
  if (!message) {
    return null;
  }

  const compactMessage = summarizeAppErrorMessage(message, fallback);

  return (
    <p
      title={message}
      aria-label={message}
      className={cn(
        "inline-flex max-w-full items-center rounded-full border border-red-400/15 bg-red-500/[0.08] px-3 py-1.5 text-[clamp(0.66rem,1.7vw,0.76rem)] font-medium leading-none text-red-300",
        centered && "mx-auto",
        className,
      )}
    >
      <span className="block max-w-full truncate">{compactMessage}</span>
    </p>
  );
}
