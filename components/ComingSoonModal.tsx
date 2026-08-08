"use client";

import { AnimatePresence, motion, type Variants } from "framer-motion";
import { ArrowRight, Droplets, Sparkles, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";

interface ComingSoonModalProps {
  isOpen: boolean;
  onClose?: () => void;
  title?: string;
  description?: string;
  feature?: string;
  ctaLabel?: string;
  ctaPath?: string;
}

const panelVariants: Variants = {
  hidden: { opacity: 0, scale: 0.88, y: 32 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 340,
      damping: 28,
      mass: 0.8,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.92,
    y: 16,
    transition: { duration: 0.22 },
  },
};

const contentVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.12 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 14 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4 },
  },
};

export default function ComingSoonModal({
  isOpen,
  title = "Coming Soon",
  description = "We're building something powerful. Liquidity pools are on the way — stay tuned for seamless yield and LP management on Tower.",
  feature = "Pool",
  ctaLabel = "Back to Trade",
  ctaPath = "/",
}: ComingSoonModalProps) {
  const router = useRouter();

  const handleDismiss = () => {
    router.push(ctaPath);
  };

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <AnimatePresence mode="wait">
      {isOpen && (
        <motion.div
          key="coming-soon-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/65 px-4 backdrop-blur-sm"
          onClick={handleDismiss}
        >
          <motion.div
            variants={panelVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="relative w-full max-w-md overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#1d1d1f]/95 shadow-2xl backdrop-blur-md"
            onClick={(event) => event.stopPropagation()}
          >
            {/* Ambient glow */}
            <motion.div
              className="pointer-events-none absolute -top-24 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full bg-primary/20 blur-3xl"
              animate={{ opacity: [0.4, 0.7, 0.4], scale: [1, 1.08, 1] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
              className="pointer-events-none absolute -bottom-16 -right-10 h-36 w-36 rounded-full bg-primary/10 blur-2xl"
              animate={{ opacity: [0.3, 0.55, 0.3], x: [0, -8, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
            />

            <button
              type="button"
              onClick={handleDismiss}
              className="absolute right-4 top-4 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground"
              aria-label="Close"
            >
              <X size={16} />
            </button>

            <motion.div
              variants={contentVariants}
              initial="hidden"
              animate="visible"
              className="relative px-6 pb-6 pt-10 text-center"
            >
              <motion.div variants={itemVariants} className="mb-5 flex justify-center">
                <motion.div
                  className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10"
                  animate={{ y: [0, -4, 0] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                >
                  <Droplets className="h-8 w-8 text-primary" />
                  <motion.span
                    className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary/20"
                    animate={{ rotate: [0, 12, -12, 0], scale: [1, 1.1, 1] }}
                    transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                  >
                    <Sparkles className="h-3 w-3 text-primary" />
                  </motion.span>
                </motion.div>
              </motion.div>

              <motion.span
                variants={itemVariants}
                className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-medium uppercase tracking-widest text-primary"
              >
                <motion.span
                  className="h-1.5 w-1.5 rounded-full bg-primary"
                  animate={{ opacity: [1, 0.4, 1], scale: [1, 0.85, 1] }}
                  transition={{ duration: 1.6, repeat: Infinity }}
                />
                {feature}
              </motion.span>

              <motion.h2
                variants={itemVariants}
                className="mb-3 text-2xl font-semibold tracking-tight text-foreground"
              >
                {title}
              </motion.h2>

              <motion.p
                variants={itemVariants}
                className="mb-8 text-sm leading-relaxed text-muted-foreground"
              >
                {description}
              </motion.p>

              <motion.div variants={itemVariants} className="flex flex-col gap-2 sm:flex-row sm:justify-center">
                <motion.button
                  type="button"
                  onClick={handleDismiss}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-black transition-colors hover:bg-primary/90"
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                >
                  {ctaLabel}
                  <ArrowRight className="h-4 w-4" />
                </motion.button>
                <motion.button
                  type="button"
                  onClick={handleDismiss}
                  className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-6 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-white/10"
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                >
                  Got it
                </motion.button>
              </motion.div>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
