"use client";
import { useEffect, useMemo, useState, useRef } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { usePrivy } from "@privy-io/react-auth";
import TokenTicker from "@/components/TokenTicker";
import Positions from "@/components/Positions";
import Activities from "@/components/Activities";
import { ARC_ADD_NETWORK_PARAMS, ARC_CHAIN_HEX } from "@/lib/arcNetwork";
import { uploadProfilePicture, saveProfileData, loadProfileData } from "@/lib/profileService";

const Profile = () => {
  const [activeTab, setActiveTab] = useState("positions");
  const { authenticated, user } = usePrivy();
  const [chainId, setChainId] = useState<string | null>(null);
  const [totalPortfolioValue, setTotalPortfolioValue] = useState("$0.00");
  const [profilePictureUrl, setProfilePictureUrl] = useState<string | null>(null);
  const [isUploadingProfile, setIsUploadingProfile] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !(window as any).ethereum) return;
    const { ethereum } = window as any;

    const handleChainChanged = (newChainId: string) => {
      setChainId(newChainId);
    };

    ethereum
      .request?.({ method: "eth_chainId" })
      .then((id: string) => setChainId(id))
      .catch(() => setChainId(null));

    ethereum.on?.("chainChanged", handleChainChanged);
    return () => ethereum.removeListener?.("chainChanged", handleChainChanged);
  }, []);

  // Load profile picture when user address changes
  useEffect(() => {
    if (user?.wallet?.address) {
      const savedProfilePicture = loadProfileData(user.wallet.address);
      if (savedProfilePicture) {
        setProfilePictureUrl(savedProfilePicture);
      }
    }
  }, [user?.wallet?.address]);

  const isOnArcTestnet = chainId === ARC_CHAIN_HEX;
  const displayAddress = useMemo(() => {
    const addr = user?.wallet?.address;
    if (!addr) return null;
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  }, [user?.wallet?.address]);

  const handleAddArcNetwork = async () => {
    if (typeof window === "undefined" || !(window as any).ethereum) return;
    try {
      await (window as any).ethereum.request({
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
                  />
                ) : (
                  <Image
                    src="/assets/Profile logo.svg"
                    alt="Profile"
                    width={96}
                    height={96}
                    className="w-full h-full object-cover"
                  />
                )}
              </div>

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
              {uploadError && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="mb-3 p-3 bg-red-500/20 border border-red-500/50 rounded-lg"
                >
                  <p className="text-red-400 text-xs">{uploadError}</p>
                </motion.div>
              )}

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
                <div className="mb-3 flex items-center gap-2">
                  <span className="text-xs text-amber-300">
                    Switch/add Arc Testnet
                  </span>
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
          className="flex items-center gap-4 mb-8 rounded-xl p-1 w-fit "
          style={{
            backgroundColor: "hsl(220, 20%, 10%)",
            border: "1px solid hsl(220, 15%, 18%)",
          }}
        >
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setActiveTab("positions")}
            className={`px-6 py-3 rounded-lg font-medium transition-all ${
              activeTab === "positions"
                ? "text-white"
                : "text-gray-400 hover:text-white"
            }`}
            style={
              activeTab === "positions"
                ? { backgroundColor: "hsl(220, 20%, 14%)" }
                : {}
            }
          >
            Positions
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setActiveTab("activities")}
            className={`px-6 py-3 rounded-lg font-medium transition-all ${
              activeTab === "activities"
                ? "text-white"
                : "text-gray-400 hover:text-white"
            }`}
            style={
              activeTab === "activities"
                ? { backgroundColor: "hsl(220, 20%, 14%)" }
                : {}
            }
          >
            Activities
          </motion.button>
        </motion.div>

        {/* Content Section */}
        <AnimatePresence mode="wait">
          {activeTab === "positions" ? (
            <Positions 
              walletAddress={user?.wallet?.address || null}
              onTotalValueChange={setTotalPortfolioValue}
            />
          ) : (
            <Activities
              isWalletConnected={authenticated}
              walletAddress={user?.wallet?.address || null}
            />
          )}
        </AnimatePresence>
      </main>
    </div>
  );
};

export default Profile;
