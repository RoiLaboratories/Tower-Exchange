"use client";

import { motion } from "framer-motion";
import type { LegalSection } from "@/lib/legal/parseLegalMarkdown";
import ThemeAwareImage from "@/components/ThemeAwareImage";
import {
  LegalSectionCard,
  LegalTableOfContents,
} from "@/components/legal/LegalContent";

interface LegalPageShellProps {
  pageType: "terms" | "privacy";
  lastUpdated: string | null;
  sections: LegalSection[];
  showTableOfContents?: boolean;
}

const LOGOS = {
  terms: {
    dark: "/assets/tower_terms_dark.svg",
    light: "/assets/tower_terms_light.svg",
  },
  privacy: {
    dark: "/assets/tower_privacy_dark.svg",
    light: "/assets/tower_privacy_light.svg",
  },
} as const;

export default function LegalPageShell({
  pageType,
  lastUpdated,
  sections,
  showTableOfContents = false,
}: LegalPageShellProps) {
  const logos = LOGOS[pageType];
  const contentSections = showTableOfContents
    ? sections.filter((section) => section.id !== "table-of-contents")
    : sections;

  return (
    <div className="relative min-h-[calc(100vh-80px)] w-full overflow-hidden bg-background font-sora text-foreground pb-24 px-4 sm:px-6 lg:px-8">
      <div className="absolute inset-0 w-full h-full pointer-events-none z-0 overflow-hidden">
        {/* Mobile: Centered Single Tower / Desktop: Left Leaning Tower */}
        <div className="absolute left-1/2 -translate-x-[72%] md:translate-x-0 md:left-[-180px] lg:left-[-220px] top-[180px] sm:top-[220px] md:top-[240px] w-[360px] sm:w-[420px] md:w-[480px] lg:w-[560px] max-h-[580px] opacity-75 select-none overflow-hidden [mask-image:linear-gradient(to_bottom,black_70%,transparent_100%)]">
          <img
            src="/assets/developer/developer-tower-background.svg"
            alt=""
            aria-hidden
            className="w-full h-auto object-contain object-left-top"
          />
        </div>

        {/* Desktop Right Leaning Tower (hidden on mobile) */}
        <div className="hidden md:block absolute right-[-180px] lg:right-[-220px] top-[240px] w-[480px] lg:w-[560px] max-h-[580px] opacity-75 select-none overflow-hidden [mask-image:linear-gradient(to_bottom,black_70%,transparent_100%)]">
          <img
            src="/assets/developer/developer-tower-background.svg"
            alt=""
            aria-hidden
            className="w-full h-auto object-contain object-right-top scale-x-[-1]"
          />
        </div>

        <div className="absolute left-1/2 top-[520px] -translate-x-1/2 w-[600px] h-[350px] bg-primary opacity-15 blur-[140px] rounded-full" />
        <div className="absolute left-1/2 bottom-[40px] -translate-x-1/2 w-[1100px] h-[220px] bg-primary opacity-20 blur-[160px] rounded-full" />
      </div>

      <main className="relative z-10 max-w-[1011px] mx-auto w-full pt-6 sm:pt-10">
        <motion.header
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center px-2 sm:px-4"
        >
          <div className="mx-auto flex max-w-[720px] flex-col items-center">
            <ThemeAwareImage
              darkSrc={logos.dark}
              lightSrc={logos.light}
              alt={pageType === "terms" ? "Terms and Conditions" : "Privacy Policy"}
              width={720}
              height={80}
              priority
              className="h-auto w-full max-w-[620px]"
            />

            {lastUpdated ? (
              <p className="mt-5 text-sm text-muted-foreground light:text-slate-500">
                Last Updated:{" "}
                <span className="text-muted-foreground light:text-slate-700">{lastUpdated}</span>
              </p>
            ) : null}
          </div>
        </motion.header>

        <div className="mt-10 sm:mt-12 space-y-[34px]">
          {showTableOfContents ? (
            <motion.div
              initial={{ opacity: 0, y: 25 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <LegalTableOfContents sections={sections} />
            </motion.div>
          ) : null}

          {contentSections.map((section, index) => (
            <motion.div
              key={section.id}
              initial={{ opacity: 0, y: 25 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.15 + index * 0.05 }}
            >
              <LegalSectionCard section={section} />
            </motion.div>
          ))}
        </div>
      </main>
    </div>
  );
}
