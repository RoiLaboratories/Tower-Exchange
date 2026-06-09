"use client";

import { useState } from "react";
import Image from "next/image";
import { X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import badgeClaimedImage from "@/public/assets/badge claimed image.svg";
import badgeUnclaimedImage from "@/public/assets/badge unclaimed image.svg";
import starIcon from "@/public/assets/Star icon.svg";

type Badge = {
  id: string;
  name: string;
  alt: string;
  isClaimed: boolean;
  isInteractive: boolean;
};

const badges: Badge[] = [
  {
    id: "squire",
    name: "Squire",
    alt: "Squire badge",
    isClaimed: false,
    isInteractive: true,
  },
  {
    id: "badge-slot-2",
    name: "",
    alt: "Unclaimed badge",
    isClaimed: false,
    isInteractive: false,
  },
  {
    id: "badge-slot-3",
    name: "",
    alt: "Unclaimed badge",
    isClaimed: false,
    isInteractive: false,
  },
];

const getBadgeDescription = (isClaimed: boolean) =>
  isClaimed
    ? "You've taken your first step on Tower.\nYou're a real user."
    : "This badge is for real users who have\ntaken their first step on Tower.";

const BadgeDetailsModal = ({
  badge,
  onClose,
}: {
  badge: Badge | null;
  onClose: () => void;
}) => (
  <AnimatePresence>
    {badge && (
      <>
        <motion.button
          type="button"
          aria-label="Close badge details"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label={`${badge.name} badge details`}
          initial={{ opacity: 0, y: 18, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 18, scale: 0.98 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          className="fixed inset-0 z-[91] flex items-center justify-center px-4 py-6"
        >
          <div className="relative w-full max-w-[580px] rounded-[28px] border border-white/5 bg-[#191A1C] px-8 pb-10 pt-16 shadow-2xl sm:px-10">
            <button
              type="button"
              onClick={onClose}
              aria-label="Close badge details"
              className="absolute right-8 top-8 inline-flex h-8 w-8 items-center justify-center rounded-full text-white transition-colors hover:bg-white/10"
            >
              <X size={21} strokeWidth={2} />
            </button>

            <div className="flex flex-col items-center text-center">
              <Image
                src={badgeClaimedImage}
                alt={`${badge.name} badge`}
                width={128}
                height={144}
                className="h-auto w-[128px] object-contain"
              />
              <h3 className="mt-3 text-2xl font-semibold leading-none text-white">
                {badge.name}
              </h3>
              <p className="mt-4 whitespace-pre-line text-center text-base font-medium leading-snug text-white sm:text-lg">
                {getBadgeDescription(badge.isClaimed)}
              </p>

              <div className="mt-6 inline-flex h-9 items-center justify-center rounded-full bg-white/[0.06] px-4 text-sm font-semibold text-white">
                Perks
              </div>

              <div className="mt-5 flex w-full items-center gap-4 rounded-[28px] border border-white/10 px-6 py-5 text-left sm:px-7">
                <Image
                  src={starIcon}
                  alt=""
                  width={14}
                  height={14}
                  className="shrink-0"
                />
                <p className="text-base font-medium leading-relaxed text-white sm:text-lg">
                  Squire Badge holders get a daily limit of 40 AI messages.
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </>
    )}
  </AnimatePresence>
);

const Badges = () => {
  const [selectedBadge, setSelectedBadge] = useState<Badge | null>(null);

  return (
    <>
      <motion.section
        key="badges"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.3 }}
        className="overflow-hidden rounded-2xl border border-white/5 bg-[#191A1C] px-6 py-8 sm:px-11 lg:min-h-[296px] lg:px-11 lg:py-12"
      >
        <div className="grid items-center gap-10 lg:grid-cols-[minmax(280px,1fr)_minmax(440px,0.95fr)]">
          <div className="max-w-[490px]">
            <h3 className="text-xl font-semibold text-white sm:text-[22px]">
              Collect Tower Badges
            </h3>
            <p className="mt-3 max-w-[460px] text-base leading-snug text-white sm:text-lg">
              Earn badges by completing milestones, participating in events, and
              engaging with the ecosystem.
            </p>
            <button
              type="button"
              disabled
              className="mt-7 inline-flex h-9 min-w-[162px] cursor-not-allowed items-center justify-center rounded-full bg-white/[0.06] px-6 text-base font-semibold text-[#5F656D]"
            >
              Claim Badge
            </button>
          </div>

          <div className="flex w-full justify-center lg:justify-end">
            <div className="grid w-full max-w-[430px] grid-cols-3 items-start gap-4 sm:gap-7 lg:max-w-[460px] lg:gap-10">
              {badges.map((badge) => {
                const badgeImage = badge.isClaimed
                  ? badgeClaimedImage
                  : badgeUnclaimedImage;
                const badgeContent = (
                  <>
                    <Image
                      src={badgeImage}
                      alt={badge.alt}
                      width={128}
                      height={144}
                      className="h-auto w-[70px] object-contain sm:w-[88px] lg:w-[104px]"
                    />
                    <div className="mt-4 h-8 text-center text-xl font-semibold leading-none text-white sm:text-2xl">
                      {badge.name}
                    </div>
                  </>
                );

                if (!badge.isInteractive) {
                  return (
                    <div
                      key={badge.id}
                      className="flex min-w-0 flex-col items-center"
                    >
                      {badgeContent}
                    </div>
                  );
                }

                return (
                  <button
                    key={badge.id}
                    type="button"
                    onClick={() => setSelectedBadge(badge)}
                    className="group flex min-w-0 flex-col items-center rounded-xl outline-none transition-transform hover:-translate-y-1 focus-visible:ring-2 focus-visible:ring-primary/70"
                    aria-label={`Open ${badge.name} badge details`}
                  >
                    {badgeContent}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </motion.section>

      <BadgeDetailsModal
        badge={selectedBadge}
        onClose={() => setSelectedBadge(null)}
      />
    </>
  );
};

export default Badges;
