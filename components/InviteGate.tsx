"use client";

import {
  type FormEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2 } from "lucide-react";

import { ErrorBadge } from "@/components/ui/error-badge";
import { useRainbowKitAuth } from "@/lib/use-rainbowkit-auth";
import { cn } from "@/lib/utils";

const ACCESS_SESSION_KEY = "towerInviteAccessSession";
const ACCESS_STORAGE_KEY = "towerInviteAccessGranted";
const DISCORD_INVITE_URL = "https://discord.gg/ftXUD6qa4J";
const TELEGRAM_INVITE_URL = "https://t.me/TowerExchangeCommunity";

const getInviteErrorLabel = (message?: string | null) => {
  const normalized = message?.trim().toLowerCase() ?? "";

  if (!normalized) {
    return "Invalid invite code.";
  }

  if (normalized.includes("required")) {
    return "Enter an invite code.";
  }

  if (normalized.includes("usage limit")) {
    return "Invite code limit reached.";
  }

  if (normalized.includes("empty response")) {
    return "Please try again.";
  }

  if (
    normalized.includes("unable to validate") ||
    normalized.includes("unexpected error")
  ) {
    return "Unable to verify code.";
  }

  return message && message.length <= 28 ? message : "Invalid invite code.";
};

type InviteGateProps = {
  children: ReactNode;
};

export default function InviteGate({ children }: InviteGateProps) {
  const [inviteCode, setInviteCode] = useState("");
  const [hasAccess, setHasAccess] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return (
      window.sessionStorage.getItem(ACCESS_SESSION_KEY) === "granted" ||
      window.localStorage.getItem(ACCESS_STORAGE_KEY) === "granted"
    );
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConnectingWallet, setIsConnectingWallet] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isCheckingRegistration, setIsCheckingRegistration] = useState(false);
  const { authenticated, login, user, ready } = useRainbowKitAuth();

  const clearStoredAccess = () => {
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(ACCESS_SESSION_KEY);
      window.localStorage.removeItem(ACCESS_STORAGE_KEY);
    }
  };

  const grantAccess = () => {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(ACCESS_SESSION_KEY, "granted");
      window.localStorage.setItem(ACCESS_STORAGE_KEY, "granted");
    }

    setHasAccess(true);
    setInviteCode("");
    setSubmitError(null);
    setIsSubmitting(false);
    setIsConnectingWallet(false);
  };

  // Keep the gate open until invite access has been granted and a wallet is connected.
  // This preserves the intended flow:
  // 1. New users enter an invite code first.
  // 2. After access is granted, they connect their wallet from the gate card.
  const shouldGate = ready && (!authenticated || !hasAccess);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const previousInviteGateState = document.body.dataset.inviteGateOpen;

    if (shouldGate) {
      document.body.style.overflow = "hidden";
      document.body.dataset.inviteGateOpen = "true";
    }

    return () => {
      document.body.style.overflow = previousOverflow;
      if (previousInviteGateState) {
        document.body.dataset.inviteGateOpen = previousInviteGateState;
      } else {
        delete document.body.dataset.inviteGateOpen;
      }
    };
  }, [shouldGate]);

  const isAccessButtonDisabled = useMemo(() => {
    return !inviteCode.trim() || isSubmitting || isCheckingRegistration;
  }, [inviteCode, isSubmitting, isCheckingRegistration]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isAccessButtonDisabled) {
      return;
    }

    setSubmitError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/invite/redeem", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code: inviteCode,
          walletAddress: user?.wallet?.address ?? null,
        }),
      });

      const result = (await response.json()) as {
        success?: boolean;
        message?: string;
      };

      if (!response.ok || !result.success) {
        setIsSubmitting(false);
        setSubmitError(getInviteErrorLabel(result.message));
        return;
      }

      grantAccess();
    } catch (error) {
      console.error("Failed to redeem invite code:", error);
      setIsSubmitting(false);
      setSubmitError(getInviteErrorLabel("Unable to validate invite code right now."));
    }
  };

  const handleConnectWallet = async () => {
    if (authenticated || isConnectingWallet) {
      return;
    }

    setIsConnectingWallet(true);

    try {
      await login();
    } catch (error) {
      console.error("Failed to connect wallet from invite gate:", error);
    } finally {
      setIsConnectingWallet(false);
    }
  };

  // Check if a connected wallet already has access through an invite redemption
  // or through legacy Privy-era app activity.
  useEffect(() => {
    const checkWalletRegistration = async () => {
      if (!authenticated || !user?.wallet?.address) {
        return;
      }

      setIsCheckingRegistration(true);
      try {
        const response = await fetch("/api/auth/check-wallet", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            walletAddress: user.wallet.address,
          }),
        });

        const result = (await response.json()) as {
          success?: boolean;
          isRegistered?: boolean;
        };

        if (result.success && result.isRegistered) {
          grantAccess();
          return;
        }

        // If wallet not registered, reset hasAccess to show invite form.
        if (result.success && result.isRegistered === false) {
          clearStoredAccess();
          setHasAccess(false);
          setInviteCode("");
        }
      } catch (error) {
        console.error("Failed to check wallet registration:", error);
      } finally {
        setIsCheckingRegistration(false);
      }
    };

    checkWalletRegistration();
  }, [authenticated, user?.wallet?.address]);

  return (
    <>
      <div
        className={cn(
          "min-h-screen transition-all duration-300",
          shouldGate && "pointer-events-none select-none",
        )}
      >
        {children}
      </div>

      <AnimatePresence>
        {shouldGate && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22 }}
              className="fixed inset-0 z-[150] bg-[linear-gradient(180deg,rgba(4,4,5,0.12)_0%,rgba(4,4,5,0.18)_14%,rgba(4,4,5,0.26)_38%,rgba(4,4,5,0.32)_100%)] backdrop-blur-[10px]"
            />

            <div className="fixed inset-0 z-[160] overflow-y-auto px-4 py-6 sm:px-6 sm:py-10">
              <div className="flex min-h-full items-center justify-center">
                <motion.section
                  initial={{ opacity: 0, y: 24, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 24, scale: 0.96 }}
                  transition={{ duration: 0.26, ease: "easeOut" }}
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="invite-gate-title"
                  className="relative w-full max-w-[26.5rem] overflow-hidden rounded-[1.6rem] border border-white/[0.04] bg-[#191A1C] text-white shadow-[0_30px_90px_rgba(0,0,0,0.72)]"
                >
                  <div className="relative aspect-[488/193] w-full overflow-hidden bg-[#121213]">
                    <div className="absolute inset-0 opacity-[0.085] [background-image:radial-gradient(circle,rgba(255,255,255,0.92)_0.65px,transparent_0.7px)] [background-size:7px_7px]" />
                    <div className="absolute left-1/2 top-[-7.45rem] h-[26.8rem] w-[26.8rem] -translate-x-[61.5%] rounded-full border border-[#21242a]/70" />
                    <div className="absolute left-1/2 top-[-3.35rem] h-[18.7rem] w-[18.7rem] -translate-x-[61.5%] rounded-full border border-[#1b1f25]/72" />
                    <div className="absolute left-1/2 top-[-0.85rem] h-[13.1rem] w-[13.1rem] -translate-x-[61.5%] rounded-full border border-[#171a20]/75" />

                    <Image
                      src="/assets/invite-tower.png"
                      alt="Tower artwork"
                      width={164}
                      height={164}
                      className="pointer-events-none absolute right-0 top-[0.2rem] h-[8.35rem] w-auto opacity-[0.42]"
                      style={{
                        WebkitMaskImage:
                          "linear-gradient(180deg, rgba(0,0,0,1) 0%, rgba(0,0,0,0.94) 36%, rgba(0,0,0,0.24) 100%)",
                        maskImage:
                          "linear-gradient(180deg, rgba(0,0,0,1) 0%, rgba(0,0,0,0.94) 36%, rgba(0,0,0,0.24) 100%)",
                      }}
                    />

                    <div className="absolute inset-y-0 right-0 w-[26%] bg-gradient-to-l from-[#121213]/96 via-[#121213]/18 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 h-[36%] bg-gradient-to-t from-[#121213] via-[#121213]/90 to-transparent" />
                    <div className="absolute right-[4.9rem] top-0 h-[64%] w-[4.8rem] opacity-[0.045] [background-image:radial-gradient(circle,rgba(255,255,255,0.92)_0.65px,transparent_0.7px)] [background-size:7px_7px]" />

                    <div className="absolute left-[47.6%] top-[55.5%] z-10 flex -translate-x-1/2 -translate-y-1/2 items-center gap-[0.65rem]">
                      <Image
                        src="/assets/Tower Logo.svg"
                        alt="Tower logo"
                        width={33}
                        height={33}
                        className="h-[2.05rem] w-[2.05rem] object-contain"
                      />
                      <span
                        className="relative top-[0.08rem] text-[1.66rem] leading-none font-semibold tracking-[-0.035em] text-white"
                        style={{ fontFamily: "var(--font-cinzel)" }}
                      >
                        Tower
                      </span>
                    </div>
                  </div>

                  <div className="px-4 pb-6 pt-4 text-center sm:px-6 sm:pb-7 sm:pt-5">
                    <div className="space-y-2.5">
                      <h1
                        id="invite-gate-title"
                        className="text-[1.25rem] font-semibold leading-[1.08] tracking-[-0.04em] text-white sm:text-[1.35rem] whitespace-nowrap"
                      >
                        Tower is invite-only
                      </h1>
                      <p className="mx-auto whitespace-nowrap text-[0.68rem] leading-5 text-[#6E7178] sm:max-w-[21rem] sm:text-[0.8rem] sm:leading-6">
                        Beta access requires an invite from an existing user
                      </p>
                    </div>

                    <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
                      <label className="invite-gate-input-shell block overflow-hidden rounded-sm border border-white/[0.08] bg-[#121213] shadow-[inset_0_1px_0_rgba(255,255,255,0.02)] transition-colors focus-within:border-white/[0.08]">
                        <span className="sr-only">Invite code</span>
                        <input
                          type="text"
                          value={inviteCode}
                          onChange={(event) => {
                            setInviteCode(event.target.value.toUpperCase());
                            if (submitError) {
                              setSubmitError(null);
                            }
                          }}
                          placeholder="Enter your invite code"
                          autoComplete="one-time-code"
                          autoFocus
                          aria-invalid={submitError ? "true" : "false"}
                          aria-describedby={
                            submitError ? "invite-code-error" : undefined
                          }
                          className="invite-gate-input h-[2.8rem] w-full rounded-sm border border-transparent bg-transparent px-5 text-center text-[0.85rem] text-white caret-[#7BB8FF] shadow-none outline-none ring-0 transition placeholder:text-[#6E7178] focus:border-transparent focus:shadow-none focus:outline-none focus:ring-0 focus-visible:border-transparent focus-visible:shadow-none focus-visible:outline-none focus-visible:ring-0"
                          style={{
                            WebkitAppearance: "none",
                            appearance: "none",
                            boxShadow: "none",
                            outline: "none",
                          }}
                        />
                      </label>

                      {submitError ? (
                        <div id="invite-code-error">
                          <ErrorBadge
                            message={submitError}
                            fallback="Invalid invite code."
                            centered
                            className="border-[#ff8c8c]/18 bg-[#2a1518]/80 text-[#ff9a9a]"
                          />
                        </div>
                      ) : null}

                      <button
                        type="submit"
                        disabled={isAccessButtonDisabled}
                        className={cn(
                          "inline-flex h-[3.25rem] w-full items-center justify-center gap-2 rounded-full text-[0.98rem] font-medium transition-all",
                          isAccessButtonDisabled
                            ? "cursor-not-allowed bg-[#2B2D31] text-[#5F636C]"
                            : "bg-primary text-black hover:opacity-90",
                        )}
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>Checking code</span>
                          </>
                        ) : (
                          <span>Access Tower</span>
                        )}
                      </button>
                    </form>

                    <div className="mt-5 space-y-3">
                      <p className="mx-auto whitespace-nowrap text-[0.62rem] leading-4 text-white sm:max-w-[21rem] sm:text-[0.76rem] sm:leading-5">
                        <span>Don&apos;t have an invite code? Join </span>
                        <a
                          href={DISCORD_INVITE_URL}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary underline decoration-primary underline-offset-4 transition-colors hover:text-[#9cccff] hover:decoration-[#9cccff]"
                        >
                          Discord
                        </a>
                        <span> or </span>
                        <a
                          href={TELEGRAM_INVITE_URL}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary underline decoration-primary underline-offset-4 transition-colors hover:text-[#9cccff] hover:decoration-[#9cccff]"
                        >
                          Telegram
                        </a>
                        <span> to get one</span>
                      </p>
                      {!authenticated ? (
                        <p className="mx-auto max-w-[21rem] text-[0.8rem] leading-6 text-[#7B7E85]">
                          Already used your code?{" "}
                          <button
                            type="button"
                            onClick={handleConnectWallet}
                            disabled={isConnectingWallet}
                            className="text-primary underline decoration-primary underline-offset-4 transition-colors hover:text-[#9cccff] hover:decoration-[#9cccff] disabled:cursor-wait disabled:opacity-60"
                          >
                            Connect Wallet
                          </button>
                        </p>
                      ) : isCheckingRegistration ? (
                        <p className="mx-auto max-w-[21rem] text-[0.8rem] leading-6 text-[#7B7E85]">
                          Checking wallet access...
                        </p>
                      ) : null}
                    </div>
                  </div>
                </motion.section>
              </div>
            </div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
