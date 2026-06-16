"use client";
import { useEffect, useMemo, useState, useRef } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import TokenTicker from "@/components/TokenTicker";
import Positions from "@/components/Positions";
import Activities from "@/components/Activities";
import Badges from "@/components/Badges";
import { ARC_ADD_NETWORK_PARAMS, ARC_CHAIN_HEX } from "@/lib/arcNetwork";
import { uploadProfilePicture, saveProfileData, loadProfileData } from "@/lib/profileService";
import { AppErrorModal } from "@/components/AppErrorModal";
import { useRainbowKitAuth } from "@/lib/use-rainbowkit-auth";
import badgeClaimedImage from "@/public/assets/badge claimed image.svg";
import {
  fetchSquireBadgeStatus,
  type SquireBadgeStatus,
} from "@/lib/squireBadge";

  type EthereumWindow = Window & {
  ethereum?: {
    request?: (args: {
      method: string;
      params?: unknown[];
    }) => Promise<unknown>;
    on?: (event: string, handler: (chainId: string) => void) => void;
    removeListener?: (event: string, handler: (chainId: string) => void) => void;
  };
};

type ProfileTab = "positions" | "activities" | "badges";

const profileTabs: Array<{ id: ProfileTab; label: string }> = [
  { id: "positions", label: "Positions" },
  { id: "activities", label: "Activities" },
  { id: "badges", label: "Badges" },
];

const Profile = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<ProfileTab>("positions");
  const { authenticated, user } = useRainbowKitAuth();
  const [chainId, setChainId] = useState<string | null>(null);
  const [totalPortfolioValue, setTotalPortfolioValue] = useState("$0.00");
  const [profilePictureUrl, setProfilePictureUrl] = useState<string | null>(null);
  const [profileImageError, setProfileImageError] = useState(false);
  const [isUploadingProfile, setIsUploadingProfile] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [squireBadgeStatus, setSquireBadgeStatus] =
    useState<SquireBadgeStatus | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const requestedTab = searchParams.get("tab");
  const requestedBadgeId = searchParams.get("badge");

  useEffect(() => {
    const ethereum = typeof window === "undefined" ? undefined : (window as EthereumWindow).ethereum;
    if (!ethereum) return;

    const handleChainChanged = (newChainId: string) => {
      setChainId(newChainId);
    };

    ethereum
      .request?.({ method: "eth_chainId" })
      .then((id) => setChainId(typeof id === "string" ? id : null))
      .catch(() => setChainId(null));

    ethereum.on?.("chainChanged", handleChainChanged);
    return () => ethereum.removeListener?.("chainChanged", handleChainChanged);
  }, []);

  // Load profile picture when user address changes
  useEffect(() => {
    const loadProfile = async () => {
      if (user?.wallet?.address) {
        const savedProfilePicture = await loadProfileData(user.wallet.address);
        setProfilePictureUrl(savedProfilePicture);
        setProfileImageError(false);
        return;
      }

      setProfilePictureUrl(null);
      setProfileImageError(false);
    };

    loadProfile();
  }, [user?.wallet?.address]);

  useEffect(() => {
    if (
      requestedTab === "positions" ||
      requestedTab === "activities" ||
      requestedTab === "badges"
    ) {
      setActiveTab(requestedTab);
    }
  }, [requestedTab]);

  useEffect(() => {
    const walletAddress = user?.wallet?.address?.trim().toLowerCase();

    if (!walletAddress) {
      setSquireBadgeStatus(null);
      return;
    }

    let cancelled = false;

    const loadSquireBadgeStatus = async () => {
      try {
        const { response, result } = await fetchSquireBadgeStatus(walletAddress);

        if (cancelled || !response.ok || !result.success || !result.badge) {
          if (!cancelled) {
            setSquireBadgeStatus(null);
          }
          return;
        }

        setSquireBadgeStatus(result.badge);
      } catch (error) {
        console.error("Failed to load profile badge state:", error);

        if (!cancelled) {
          setSquireBadgeStatus(null);
        }
      }
    };

    void loadSquireBadgeStatus();

    return () => {
      cancelled = true;
    };
  }, [user?.wallet?.address]);

  const isOnArcTestnet = chainId === ARC_CHAIN_HEX;
  const displayAddress = useMemo(() => {
    const addr = user?.wallet?.address;
    if (!addr) return null;
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  }, [user?.wallet?.address]);
  const hasClaimedSquireBadge = squireBadgeStatus?.isClaimed === true;

  const handleTabChange = (tab: ProfileTab) => {
    setActiveTab(tab);

    const nextSearchParams = new URLSearchParams(searchParams.toString());
    nextSearchParams.set("tab", tab);

    if (tab !== "badges") {
      nextSearchParams.delete("badge");
    } else if (requestedBadgeId) {
      nextSearchParams.set("badge", requestedBadgeId);
    }

    router.replace(`/profile?${nextSearchParams.toString()}`, {
      scroll: false,
    });
  };

  const handleAddArcNetwork = async () => {
    const ethereum = typeof window === "undefined" ? undefined : (window as EthereumWindow).ethereum;
    if (!ethereum) return;
    try {
      await ethereum.request?.({
        method: "wallet_addEthereumChain",
        params: ARC_ADD_NETWORK_PARAMS,
      });
    } catch (error) {
      console.error("Error adding Arc Testnet to wallet:", error);
    }
  };

  const handleProfilePictureChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file || !user?.wallet?.address) return;

    setIsUploadingProfile(true);
    setUploadError(null);

    try {
      const url = await uploadProfilePicture(file, user.wallet.address);
      setProfilePictureUrl(url);
      setProfileImageError(false);
      saveProfileData(user.wallet.address, url);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to upload profile picture";
      setUploadError(errorMessage);
      console.error("Profile picture upload error:", error);
    } finally {
      setIsUploadingProfile(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <>
      <AppErrorModal error={uploadError} onClose={() => setUploadError(null)} title="Upload failed" />
      <div className="text-white min-h-screen">
        {/* Token Ticker */}
        <TokenTicker />

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-6 py-12">
          {/* Profile Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          className="mb-12"
        >
          <h1 className="text-4xl font-bold mb-8">Profile</h1>

          <div className="flex items-center gap-6">
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="relative group"
            >
              <div className="w-24 h-24 rounded-full overflow-hidden bg-linear-to-br from-gray-700 to-gray-800 border-2 border-gray-600">
                {profilePictureUrl ? (
                  <Image
                    src={profilePictureUrl}
                    alt="Profile"
                    width={96}
                    height={96}
                    className="w-full h-full object-cover"
                    unoptimized={true}
                    onError={() => {
                      console.error("Failed to load profile image:", profilePictureUrl);
                      setProfileImageError(true);
                    }}
                  />
                ) : null}
                {!profilePictureUrl || profileImageError ? (
                  <Image
                    src="/assets/Profile logo.svg"
                    alt="Profile"
                    width={96}
                    height={96}
                    className="w-full h-full object-cover"
                  />
                ) : null}
              </div>

              {hasClaimedSquireBadge ? (
                <div className="pointer-events-none absolute -bottom-1 -right-1 z-10">
                  <Image
                    src={badgeClaimedImage}
                    alt="Claimed Squire badge"
                    width={30}
                    height={34}
                    className="h-auto w-[1.65rem] object-contain drop-shadow-[0_10px_18px_rgba(0,0,0,0.24)]"
                  />
                </div>
              ) : null}

              {/* Upload overlay button */}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingProfile}
                className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                title="Upload profile picture"
              >
                <motion.div
                  animate={{ opacity: isUploadingProfile ? 1 : 0 }}
                  className="text-white text-xs font-semibold text-center px-2"
                >
                  {isUploadingProfile ? "Uploading..." : "Click to upload"}
                </motion.div>
              </button>

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleProfilePictureChange}
                disabled={isUploadingProfile}
                className="hidden"
              />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <div className="flex items-center gap-3 mb-2">
                <p className="text-gray-200 font-semibold">
                  {authenticated ? "Connected" : "Not Connected"}
                </p>
                {displayAddress && (
                  <span className="text-xs text-gray-400 px-2 py-1 rounded-lg bg-white/5 border border-white/10">
                    {displayAddress}
                  </span>
                )}
              </div>

              {!isOnArcTestnet && (
                <div className="mb-3">
                  <button
                    onClick={handleAddArcNetwork}
                    className="text-xs px-3 py-1.5 rounded-lg bg-primary text-black font-semibold hover:opacity-90 transition"
                  >
                    Add Arc Testnet
                  </button>
                </div>
              )}

              <h2 className="text-5xl font-bold mb-2">{totalPortfolioValue}</h2>
              <p className="text-green-400 text-sm">
                +0.00% <span className="text-gray-500">($0.00)</span>
              </p>
            </motion.div>
          </div>
        </motion.div>

        {/* Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="flex w-fit items-center gap-1 rounded-xl p-1 mb-8 sm:gap-4"
          style={{
            backgroundColor: "hsl(220, 20%, 10%)",
            border: "1px solid hsl(220, 15%, 18%)",
          }}
        >
          {profileTabs.map((tab) => (
            <motion.button
              key={tab.id}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleTabChange(tab.id)}
              className={`rounded-lg px-4 py-3 font-medium transition-all sm:px-6 ${
                activeTab === tab.id
                  ? "text-white"
                  : "text-gray-400 hover:text-white"
              }`}
              style={
                activeTab === tab.id
                  ? { backgroundColor: "hsl(220, 20%, 14%)" }
                  : {}
              }
            >
              {tab.label}
            </motion.button>
          ))}
        </motion.div>

        {/* Content Section */}
        <AnimatePresence mode="wait">
          {activeTab === "positions" && (
            <Positions 
              walletAddress={user?.wallet?.address || null}
              onTotalValueChange={setTotalPortfolioValue}
            />
          )}
          {activeTab === "activities" && (
            <Activities
              isWalletConnected={authenticated}
              walletAddress={user?.wallet?.address || null}
            />
          )}
          {activeTab === "badges" && (
            <Badges
              isWalletConnected={authenticated}
              highlightedBadgeId={activeTab === "badges" ? requestedBadgeId : null}
              onSquireBadgeStatusChange={setSquireBadgeStatus}
              walletAddress={user?.wallet?.address || null}
            />
          )}
        </AnimatePresence>
      </main>
      </div>
    </>
  );
};

export default Profile;
